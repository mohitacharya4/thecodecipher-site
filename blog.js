// Blog enhancements. Every post and link is already in the HTML; this only
// adds a reading-progress bar, the active table-of-contents entry and the
// topic filter on the blog index.

// Reading progress across the article body.
(function () {
  var bar = document.querySelector('.read-progress');
  var article = document.querySelector('.prose');
  if (!bar || !article) return;
  var ticking = false;
  function update() {
    ticking = false;
    var rect = article.getBoundingClientRect();
    var total = rect.height - window.innerHeight * 0.6;
    var done = total > 0 ? (-rect.top + window.innerHeight * 0.2) / total : 1;
    bar.style.setProperty('--progress', Math.min(1, Math.max(0, done)).toFixed(4));
  }
  function request() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  update();
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
})();

// Highlight the section being read in the table of contents.
(function () {
  var links = document.querySelectorAll('.toc a[href^="#"]');
  if (!links.length || !('IntersectionObserver' in window)) return;
  var byId = {};
  var headings = [];
  links.forEach(function (a) {
    var h = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (h) { byId[h.id] = a; headings.push(h); }
  });
  var visible = {};
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
    // The active heading is the last one that has scrolled above the middle of the screen.
    var active = headings[0];
    headings.forEach(function (h) {
      if (h.getBoundingClientRect().top < window.innerHeight * 0.4) active = h;
    });
    links.forEach(function (a) { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
    if (active && byId[active.id]) {
      byId[active.id].classList.add('is-active');
      byId[active.id].setAttribute('aria-current', 'location');
    }
  }, { rootMargin: '0px 0px -55% 0px' });
  headings.forEach(function (h) { observer.observe(h); });
})();

// Topic filter on the blog index. Shareable as /blog/#tag=Topic.
(function () {
  var group = document.querySelector('.tag-filter');
  if (!group) return;
  var chips = group.querySelectorAll('.chip');
  var cards = document.querySelectorAll('.blog-list .post-card');
  var empty = document.querySelector('.filter-empty');
  group.hidden = false;

  function apply(tag) {
    var shown = 0;
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.tag === tag)); });
    cards.forEach(function (card) {
      var match = !tag || card.dataset.tags.split('|').indexOf(tag) >= 0;
      card.hidden = !match;
      if (match) shown++;
    });
    if (empty) empty.hidden = shown > 0;
  }

  function fromHash() {
    var m = location.hash.match(/^#tag=(.+)$/);
    var tag = m ? decodeURIComponent(m[1]) : '';
    var known = Array.prototype.some.call(chips, function (c) { return c.dataset.tag === tag; });
    apply(known ? tag : '');
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var tag = chip.dataset.tag;
      history.replaceState(null, '', tag ? '#tag=' + encodeURIComponent(tag) : location.pathname);
      apply(tag);
    });
  });
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
