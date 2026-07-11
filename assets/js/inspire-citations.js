/**
 * INSPIRE-HEP Citation Summary
 * Fetches publication data from INSPIRE-HEP API and displays citation statistics
 */

(function() {
  'use strict';

  // Configuration
  const CACHE_KEY_PREFIX = 'inspire_citations_cache_v8';
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const API_BASE = 'https://inspirehep.net/api/literature';
  const DEFAULT_AUTHOR_BAI = '';
  const DEFAULT_AUTHOR_ID = '';

  // Translation labels
  const TRANSLATIONS = {
    en: {
      papers: 'Papers',
      citations: 'Citations',
      citationsPerPaper: 'Cites/Paper',
      hindex: 'h-index',
      highlyCited: 'Cited >100 ',
      topJournals: 'Top Journals',
      prl: 'PRL',
      prd: 'PRD',
      physRept: 'Phys.Rept.',
      sciBull: 'Sci.Bull.',
      jhep: 'JHEP',
      dataSource: 'Data from',
      inspireLink: 'INSPIREHEP',
      lastUpdated: 'Updated',
      refresh: 'Refresh',
      loading: 'Loading citation data...',
      errorMsg: 'Unable to load citation data. Please visit the full publication list.',
      retry: 'Retry',
      citable: 'Citable',
      published: 'Published',
      citationsPerYear: 'Citations per Year',
      googleScholar: 'Google Scholar'
    },
    zh: {
      papers: '论文',
      citations: '引用',
      citationsPerPaper: '篇均引用',
      hindex: 'h指数',
      highlyCited: '引用>100',
      topJournals: '顶级期刊',
      prl: 'PRL',
      prd: 'PRD',
      physRept: 'Phys.Rept.',
      sciBull: 'Sci.Bull.',
      jhep: 'JHEP',
      dataSource: '数据来自',
      inspireLink: 'INSPIREHEP',
      lastUpdated: '更新',
      refresh: '刷新',
      loading: '正在加载引用数据...',
      errorMsg: '无法加载引用数据，请访问完整论文列表。',
      retry: '重试',
      citable: '可引用',
      published: '已发表',
      citationsPerYear: '年度引用',
      googleScholar: 'Google Scholar'
    }
  };

  // Track current mode per container
  const containerModes = new WeakMap();

  /**
   * Read citation configuration from the container.
   */
  function getCitationConfig(container) {
    const authorId = container.getAttribute('data-author-id') || DEFAULT_AUTHOR_ID;
    const authorBai = container.getAttribute('data-author-bai') || DEFAULT_AUTHOR_BAI;
    const authorUrl = container.getAttribute('data-author-url') ||
      `https://inspirehep.net/authors/${authorId}`;

    return {
      authorId: authorId,
      authorBai: authorBai,
      authorUrl: authorUrl,
      cacheKey: `${CACHE_KEY_PREFIX}_${authorBai}`
    };
  }

  /**
   * Format number with thousand separators
   */
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Format decimal number
   */
  function formatDecimal(num, decimals = 1) {
    if (num === undefined || num === null || isNaN(num)) {
      return '0.0';
    }
    return num.toFixed(decimals);
  }

  /**
   * Format date based on language
   */
  function formatDate(date, lang) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
    return date.toLocaleDateString(locale, options);
  }

  /**
   * Render citations per year histogram
   * @param {Object} citationsByYear - Object with year keys and citation count values
   * @param {string} lang - Language code ('en' or 'zh')
   * @returns {string} HTML string for the histogram
   */
  function renderHistogram(citationsByYear, lang) {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

    if (!citationsByYear || Object.keys(citationsByYear).length === 0) {
      return '';
    }

    // Sort years and get last 8 years
    const years = Object.keys(citationsByYear)
      .map(y => parseInt(y))
      .sort((a, b) => a - b)
      .slice(-8);

    if (years.length === 0) {
      return '';
    }

    // Find max value for scaling
    const maxCitations = Math.max(...years.map(y => citationsByYear[y] || 0));

    // Generate bar HTML - citation count on top, year at bottom
    const barsHtml = years.map(year => {
      const count = citationsByYear[year] || 0;
      const heightPercent = maxCitations > 0 ? (count / maxCitations) * 100 : 0;

      return `
        <div class="histogram-bar-container">
          <span class="histogram-count">${formatNumber(count)}</span>
          <div class="histogram-bar-wrapper">
            <div class="histogram-bar" style="height: ${heightPercent}%"></div>
          </div>
          <span class="histogram-year">${year}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="citations-histogram">
        <div class="histogram-header">
          <span class="histogram-title">${t.citationsPerYear}</span>
          <span class="histogram-source">${t.googleScholar}</span>
        </div>
        <div class="histogram-chart">
          ${barsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Calculate h-index from citation counts
   */
  function calculateHIndex(citationCounts) {
    // Sort citations in descending order
    const sorted = citationCounts.slice().sort((a, b) => b - a);

    // Find largest h where h papers have >= h citations
    let hIndex = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] >= i + 1) {
        hIndex = i + 1;
      } else {
        break;
      }
    }

    return hIndex;
  }

  /**
   * Get journal title from publication
   * Handles cases where journal_title and material="publication" may be in different entries
   */
  function getJournalTitle(pub) {
    const pubInfo = pub.metadata.publication_info;
    if (!pubInfo || pubInfo.length === 0) {
      return null;
    }

    // First, try to find an entry with BOTH material="publication" AND journal_title
    let publication = pubInfo.find(info =>
      info.material === 'publication' && info.journal_title
    );

    if (publication) {
      return publication.journal_title;
    }

    // If not found, check if there's an entry with material="publication"
    // and get journal_title from any other entry
    const hasPublication = pubInfo.some(info => info.material === 'publication');
    if (hasPublication) {
      // Find any entry with journal_title
      const entryWithJournal = pubInfo.find(info => info.journal_title);
      if (entryWithJournal) {
        return entryWithJournal.journal_title;
      }
    }

    // Fallback: return first entry with journal_title
    const fallback = pubInfo.find(info => info.journal_title);
    return fallback ? fallback.journal_title : null;
  }

  /**
   * Count papers by top journals
   */
  function countTopJournals(publications) {
    const counts = {
      prl: 0,
      prd: 0,
      physRept: 0,
      sciBull: 0,
      jhep: 0
    };

    publications.forEach(pub => {
      const journal = getJournalTitle(pub);
      if (!journal) return;

      const journalLower = journal.toLowerCase();

      if (journalLower.includes('phys.rev.lett')) {
        counts.prl++;
      } else if (journalLower.includes('phys.rev.d')) {
        counts.prd++;
      } else if (journalLower.includes('phys.rept')) {
        counts.physRept++;
      } else if (journalLower.includes('sci.bull')) {
        counts.sciBull++;
      } else if (journalLower === 'jhep' || journalLower.includes('j.high energy phys')) {
        counts.jhep++;
      }
    });

    return counts;
  }

  /**
   * Fetch publications from INSPIRE-HEP API with optional type filter
   * @param {string} typeFilter - 'citable' or 'published'
   */
  async function fetchPublications(typeFilter, authorBai) {
    const fields = 'citation_count,citation_count_without_self_citations,publication_info,citeable';
    const size = 250;

    // Build query based on filter type
    let query;
    if (typeFilter === 'published') {
      query = `a ${authorBai} AND tc published`;
    } else {
      // citable - use tc citeable to match INSPIRE-HEP's definition
      query = `a ${authorBai} AND tc citeable`;
    }

    const url = `${API_BASE}?q=${encodeURIComponent(query)}&size=${size}&fields=${fields}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.hits.hits;
  }

  /**
   * Calculate metrics from publication data
   */
  function calculateMetricsFromPublications(publications) {
    const citationCounts = [];
    let totalCitations = 0;
    let totalCitationsWithoutSelf = 0;
    let highlyCitedCount = 0;

    publications.forEach(pub => {
      const citations = pub.metadata.citation_count || 0;
      const citationsWithoutSelf = pub.metadata.citation_count_without_self_citations || 0;

      citationCounts.push(citations);
      totalCitations += citations;
      totalCitationsWithoutSelf += citationsWithoutSelf;

      if (citations > 100) {
        highlyCitedCount++;
      }
    });

    const topJournals = countTopJournals(publications);
    const citationsPerPaper = publications.length > 0
      ? totalCitations / publications.length
      : 0;

    return {
      totalPapers: publications.length,
      totalCitations: totalCitations,
      totalCitationsWithoutSelf: totalCitationsWithoutSelf,
      citationsPerPaper: citationsPerPaper,
      hIndex: calculateHIndex(citationCounts),
      highlyCitedCount: highlyCitedCount,
      topJournals: topJournals
    };
  }

  /**
   * Fetch and calculate metrics for both modes
   */
  async function fetchAllMetrics(authorBai) {
    // Fetch both citable and published papers in parallel
    const [citablePubs, publishedPubs] = await Promise.all([
      fetchPublications('citable', authorBai),
      fetchPublications('published', authorBai)
    ]);

    return {
      citable: calculateMetricsFromPublications(citablePubs),
      published: calculateMetricsFromPublications(publishedPubs),
      timestamp: Date.now()
    };
  }

  /**
   * Get cached data if still valid
   */
  function getCachedData(cacheKey, allowExpired) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;

      if (allowExpired || age < CACHE_DURATION) {
        return data;
      }
    } catch (e) {
      console.error('Error reading cache:', e);
    }
    return null;
  }

  /**
   * Save data to cache
   */
  function setCachedData(cacheKey, data) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (e) {
      console.error('Error writing cache:', e);
    }
  }

  /**
   * Render citation summary HTML
   */
  function renderSummary(metrics, lang, container, mode) {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const config = getCitationConfig(container);
    const updateDate = formatDate(new Date(metrics.timestamp), lang);

    // Get metrics for current mode
    const modeMetrics = metrics[mode] || metrics.citable || metrics;

    // Provide defaults for backward compatibility with old cached data
    const citationsPerPaper = modeMetrics.citationsPerPaper || 0;
    const topJournals = modeMetrics.topJournals || { prl: 0, prd: 0, physRept: 0, sciBull: 0, jhep: 0 };

    // Parse citations by year data from container attribute
    let citationsByYear = null;
    const citationsByYearAttr = container.getAttribute('data-citations-by-year');
    if (citationsByYearAttr) {
      try {
        citationsByYear = JSON.parse(citationsByYearAttr);
      } catch (e) {
        console.error('[INSPIRE Citations] Error parsing citations by year:', e);
      }
    }

    // Generate histogram HTML if data available
    const histogramHtml = renderHistogram(citationsByYear, lang);

    const html = `
      <div class="citations-summary">
        <div class="citations-mode-switch">
          <button class="mode-btn ${mode === 'citable' ? 'active' : ''}" data-mode="citable">${t.citable}</button>
          <button class="mode-btn ${mode === 'published' ? 'active' : ''}" data-mode="published">${t.published}</button>
        </div>
        <div class="citations-grid">
          <div class="citation-stat">
            <span class="stat-value">${formatNumber(modeMetrics.totalPapers)}</span>
            <span class="stat-label">${t.papers}</span>
          </div>
          <div class="citation-stat">
            <span class="stat-value">${formatNumber(modeMetrics.totalCitations)}</span>
            <span class="stat-label">${t.citations}</span>
          </div>
          <div class="citation-stat">
            <span class="stat-value">${formatDecimal(citationsPerPaper)}</span>
            <span class="stat-label">${t.citationsPerPaper}</span>
          </div>
          <div class="citation-stat">
            <span class="stat-value">${formatNumber(modeMetrics.hIndex)}</span>
            <span class="stat-label">${t.hindex}</span>
          </div>
          <div class="citation-stat">
            <span class="stat-value">${formatNumber(modeMetrics.highlyCitedCount)}</span>
            <span class="stat-label">${t.highlyCited}</span>
          </div>

        </div>
        <div class="citations-footer">
          <small>${t.dataSource} <a href="${config.authorUrl}" target="_blank" rel="noopener">${t.inspireLink}</a> | ${t.lastUpdated}: ${updateDate} | <a href="#" class="citations-refresh">${t.refresh}</a></small>
        </div>
        ${histogramHtml}
      </div>
    `;

    container.innerHTML = html;

    // Store metrics in container for mode switching
    container._citationsMetrics = metrics;

    // Add mode switch click handlers
    const modeButtons = container.querySelectorAll('.mode-btn');
    modeButtons.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const newMode = this.getAttribute('data-mode');
        containerModes.set(container, newMode);
        renderSummary(metrics, lang, container, newMode);
      });
    });

    // Add refresh click handler
    const refreshLink = container.querySelector('.citations-refresh');
    if (refreshLink) {
      refreshLink.addEventListener('click', function(e) {
        e.preventDefault();
        loadCitations(container, true);
      });
    }
  }

  /**
   * Render loading state
   */
  function renderLoading(lang, container) {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
    container.innerHTML = `
      <div class="citations-loading">
        <span class="loading-spinner"></span> ${t.loading}
      </div>
    `;
  }

  /**
   * Render error state
   */
  function renderError(lang, container) {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
    container.innerHTML = `
      <div class="citations-error">
        <p>${t.errorMsg}</p>
        <small><a href="#" class="citations-retry">${t.retry}</a></small>
      </div>
    `;

    // Add retry click handler
    const retryLink = container.querySelector('.citations-retry');
    if (retryLink) {
      retryLink.addEventListener('click', function(e) {
        e.preventDefault();
        loadCitations(container, true);
      });
    }
  }

  /**
   * Main function to load and display citations
   */
  async function loadCitations(container, forceRefresh) {
    const lang = container.getAttribute('data-lang') || 'en';
    const defaultMode = container.getAttribute('data-mode') || 'citable';
    const config = getCitationConfig(container);

    // Get current mode or use default
    let mode = containerModes.get(container) || defaultMode;
    containerModes.set(container, mode);

    // Try to use cached data first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getCachedData(config.cacheKey, false);
      if (cached) {
        renderSummary(cached, lang, container, mode);
        return;
      }
    }

    // Show loading state
    renderLoading(lang, container);

    try {
      // Fetch fresh data from API for both modes
      const metrics = await fetchAllMetrics(config.authorBai);

      // Cache the results
      setCachedData(config.cacheKey, metrics);

      // Render the summary
      renderSummary(metrics, lang, container, mode);
    } catch (error) {
      console.error('Error fetching citations:', error);

      // Try stale cache as fallback when the API is unreachable.
      const staleCache = getCachedData(config.cacheKey, true);
      if (staleCache) {
        renderSummary(staleCache, lang, container, mode);
      } else {
        renderError(lang, container);
      }
    }
  }

  /**
   * Initialize citation containers on page load
   */
  function initCitations() {
    const containers = document.querySelectorAll('#inspire-citations');
    containers.forEach(function(container) {
      loadCitations(container, false);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCitations);
  } else {
    initCitations();
  }

})();
