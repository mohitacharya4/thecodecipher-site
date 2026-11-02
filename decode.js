// Hero signature: the headline loads as a substitution cipher and decodes
// letter by letter, lighting up each pair in the key as it is used.
(function () {
  var PLAIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var CIPHER = 'QWERTYUIOPASDFGHJKLZXCVBNM';
  var START_DELAY = 400;
  var STEP = 55;

  var keyEl = document.getElementById('key-pairs');
  var headline = document.getElementById('headline');
  if (!keyEl || !headline) return;

  var pairs = {};
  PLAIN.split('').forEach(function (p, i) {
    var span = document.createElement('span');
    span.textContent = p + '→' + CIPHER[i];
    keyEl.appendChild(span);
    pairs[p] = span;
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function isLetter(ch) {
    return PLAIN.indexOf(ch.toUpperCase()) >= 0;
  }

  function encode(ch) {
    var c = CIPHER[PLAIN.indexOf(ch.toUpperCase())];
    return ch === ch.toUpperCase() ? c : c.toLowerCase();
  }

  // Hide the headline until the display font is ready, so letter widths are
  // measured with the real glyphs.
  headline.style.visibility = 'hidden';
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fontsReady.then(run, run);

  function run() {
    // Wrap each word (so lines still break between words) and each letter.
    var text = headline.textContent;
    var letters = [];
    headline.textContent = '';
    text.split(/\s+/).forEach(function (part, w) {
      if (w > 0) headline.appendChild(document.createTextNode(' '));
      var word = document.createElement('span');
      word.className = 'word';
      word.setAttribute('aria-hidden', 'true');
      part.split('').forEach(function (ch) {
        var c = document.createElement('span');
        c.className = 'ch';
        c.textContent = ch;
        word.appendChild(c);
        if (isLetter(ch)) letters.push({ el: c, plain: ch });
      });
      headline.appendChild(word);
    });

    // Lock each letter to the width of its plain glyph so lines don't jump.
    letters.forEach(function (l) {
      l.el.style.width = l.el.getBoundingClientRect().width + 'px';
    });
    letters.forEach(function (l) {
      l.el.textContent = encode(l.plain);
      l.el.classList.add('enc');
    });
    headline.style.visibility = '';

    letters.forEach(function (l, i) {
      setTimeout(function () {
        l.el.textContent = l.plain;
        l.el.classList.remove('enc');
        var pair = pairs[l.plain.toUpperCase()];
        pair.classList.add('hit');
        setTimeout(function () { pair.classList.remove('hit'); }, 500);
      }, START_DELAY + i * STEP);
    });
  }
})();

// Show a divider under the sticky header once the page scrolls.
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;
  function update() { header.classList.toggle('is-stuck', window.scrollY > 4); }
  update();
  window.addEventListener('scroll', update, { passive: true });
})();

// Scroll motion: sections and cards rise into view as you reach them, and each
// section label decodes from cipher text the first time it appears.
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var PLAIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var CIPHER = 'QWERTYUIOPASDFGHJKLZXCVBNM';
  var STEP = 45;

  function encode(ch) {
    var i = PLAIN.indexOf(ch.toUpperCase());
    if (i < 0) return ch;
    return ch === ch.toUpperCase() ? CIPHER[i] : CIPHER[i].toLowerCase();
  }

  // Decode the label's own text, leaving child elements like the count alone.
  function decode(label) {
    var node = label.firstChild;
    if (!node || node.nodeType !== 3) return;
    var plain = node.nodeValue;
    label.setAttribute('aria-label', label.textContent.replace(/\s+/g, ' ').trim());
    var chars = plain.split('');
    node.nodeValue = chars.map(encode).join('');
    chars.forEach(function (ch, i) {
      setTimeout(function () {
        node.nodeValue = plain.slice(0, i + 1) + chars.slice(i + 1).map(encode).join('');
        if (i === chars.length - 1) label.removeAttribute('aria-label');
      }, 150 + i * STEP);
    });
  }

  var groups = [
    '.section .eyebrow',
    '.section-intro',
    '.products > .product',
    '.next',
    '.services > .service',
    '.services-cta',
    '.principles > div',
    '.contact-card'
  ];

  var fold = window.innerHeight;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      observer.unobserve(el);
      if (el.classList.contains('eyebrow')) decode(el);
      if (el.classList.contains('reveal')) el.classList.add('is-in');
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

  groups.forEach(function (selector) {
    document.querySelectorAll(selector).forEach(function (el, i) {
      // Only hide what is still below the fold, so nothing already on screen flickers.
      if (el.getBoundingClientRect().top < fold) return;
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', Math.min(i, 4) * 80 + 'ms');
      // Once it has arrived, hand transitions back to the hover styles.
      el.addEventListener('transitionend', function done(e) {
        if (e.target !== el || e.propertyName !== 'opacity') return;
        el.classList.remove('reveal', 'is-in');
        el.style.removeProperty('--reveal-delay');
        el.removeEventListener('transitionend', done);
      });
      observer.observe(el);
    });
  });
})();
