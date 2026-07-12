---
layout: archive
title: "Publications"
permalink: /publications/
author_profile: true
---

<div id="inspire-citations" data-author-id="1274148" data-author-bai="Shanshan.Cao.1" data-lang="en"></div>

{% if site.author.inspire-hep %}
  <div class="wordwrap">Full publication list available at <a href="{{site.author.inspire-hep}}">INSPIRE-HEP</a> </div>
{% endif %}

{% if site.author.googlescholar %}
  <div class="wordwrap">You can also find my publications at <a href="{{site.author.googlescholar}}">Google Scholar</a> </div>
{% endif %}



{% include base_path %}

{% comment %}

<!-- New style rendering if publication categories are defined -->
{% if site.publication_category %}
  {% for category in site.publication_category  %}
    {% assign title_shown = false %}
    {% for post in site.publications reversed %}
      {% if post.category != category[0] %}
        {% continue %}
      {% endif %}
      {% unless title_shown %}
        <h2>{{ category[1].title }}</h2><hr />
        {% assign title_shown = true %}
      {% endunless %}
      {% include archive-single.html %}
    {% endfor %}
  {% endfor %}
{% else %}
  {% for post in site.publications reversed %}
    {% include archive-single.html %}
  {% endfor %}
{% endif %}

{% endcomment %}


<br>
## My Review Articles  
(In case you are interested in an overview of jet phyiscs in high-energy nuclear collisions)
* A general overview on jet theory and phenomenology  
S. Cao, X.-N. Wang, *Jet quenching and medium response in high-energy heavy-ion collisions: a review*, Rept. Prog. Phys. 84 (2021) 2, 024301 ([link](https://inspirehep.net/literature/1779425))
* An overview on the QGP response to jet quenching    
S. Cao, G.-Y. Qin, *Medium response and jet–hadron correlations in relativistic heavy-ion collisions*, Ann. Rev. Nucl. Part. Sci. 73 (2023) 205-229 ([link](https://inspirehep.net/literature/2605844))
* An overview on Monte-Carlo simulations of jet-QGP interactions and model-to-data comparisons    
S. Cao, A. Majumder, R. Modarresi-Yazdi, I. Soudi, Y. Tachibana, *Jet quenching: From theory to simulation*, Int. J. Mod. Phys. E 33 (2024) 08, 2430002 ([link](https://inspirehep.net/literature/2748749)), a chapter of [Quark-Gluon Plasma 6](https://www.worldscientific.com/worldscibooks/10.1142/13884)

