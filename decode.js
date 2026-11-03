// Hero signature: the headline loads as a substitution cipher and decodes
// letter by letter, lighting up each pair in the key as it is used.
// Blog titles marked [data-decode] get the same effect, without the key.
(function () {
  var PLAIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var CIPHER = 'QWERTYUIOPASDFGHJKLZXCVBNM';
  var START_DELAY = 400;
  var STEP = 55;

  var keyEl = document.getElementById('key-pairs');
  var headline = document.getElementById('headline') || document.querySelector('[data-decode]');
  if (!headline) return;
  // Long titles decode faster so the effect never drags.
  var letterCount = headline.textContent.replace(/[^a-z]/gi, '').length;
  if (letterCount > 30) STEP = Math.max(18, Math.round(1600 / letterCount));

  var pairs = {};
  if (keyEl) {
    PLAIN.split('').forEach(function (p, i) {
      var span = document.createElement('span');
      span.textContent = p + '→' + CIPHER[i];
      keyEl.appendChild(span);
      pairs[p] = span;
    });
  }

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
        if (!pair) return;
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
    '.writing-grid > .post-card',
    '.post-grid > .post-card',
    '.faq',
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

// Cipher covers on post cards: the enciphered title decodes into the real one
// when the card is hovered or focused, and re-encodes when the pointer leaves.
// On touch screens, where there is no hover, it decodes once as it scrolls in.
(function () {
  var covers = document.querySelectorAll('.cipher-cover [data-plain]');
  if (!covers.length) return;

  var PLAIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var CIPHER = 'QWERTYUIOPASDFGHJKLZXCVBNM';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function encode(ch) {
    var i = PLAIN.indexOf(ch.toUpperCase());
    if (i < 0) return ch;
    return ch === ch.toUpperCase() ? CIPHER[i] : CIPHER[i].toLowerCase();
  }

  function run(el, toPlain) {
    clearInterval(el._decodeTimer);
    var plain = el.getAttribute('data-plain');
    var target = toPlain ? plain : plain.split('').map(encode).join('');
    el.parentNode.classList.toggle('is-plain', toPlain);
    if (reduce) { el.textContent = target; return; }

    var current = el.textContent.split('');
    var order = [];
    for (var i = 0; i < target.length; i++) {
      if (current[i] !== target[i]) order.push(i);
    }
    if (!order.length) return;
    // Decode left to right; re-encode right to left, twice as fast.
    if (!toPlain) order.reverse();
    var step = Math.max(12, Math.min(35, Math.round(700 / order.length)));
    if (!toPlain) step = Math.max(6, Math.round(step / 2));

    var k = 0;
    el._decodeTimer = setInterval(function () {
      var j = order[k++];
      current[j] = target[j];
      el.textContent = current.join('');
      if (k >= order.length) clearInterval(el._decodeTimer);
    }, step);
  }

  covers.forEach(function (el) {
    var card = el.closest('.post-card');
    if (!card) return;

    if (canHover) {
      card.addEventListener('mouseenter', function () { run(el, true); });
      card.addEventListener('mouseleave', function () {
        if (!card.contains(document.activeElement)) run(el, false);
      });
      card.addEventListener('focusin', function () { run(el, true); });
      card.addEventListener('focusout', function () {
        if (!card.matches(':hover')) run(el, false);
      });
      return;
    }

    if (reduce || !('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setTimeout(function () { run(el, true); }, 250);
      });
    }, { threshold: 0.6 });
    observer.observe(el);
  });
})();
