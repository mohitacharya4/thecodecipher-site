// Website assistant: a small chat panel that answers questions about
// The Code Cipher. Questions go to our Cloudflare Worker (private repo
// thecodecipher-chat), which calls Claude. Quick replies are answered here, at no cost.
(function () {
  var meta = document.querySelector('meta[name="chat-endpoint"]');
  var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var ENDPOINT = isLocal ? 'http://localhost:8787/chat' : (meta && meta.content) || '';
  var EMAIL = 'thecodecipher@gmail.com';
  var MAX_CHARS = 500;
  var FALLBACK = "Sorry, I can't answer right now. Please email " + EMAIL + " and we'll reply within 24 hours.";

  var GREETING = "Hi! Ask me anything about The Code Cipher, our apps Tabulo and Optipixa, or our services.";
  var QUICK = [
    {
      q: 'What services do you offer?',
      a: 'We offer five services: digital marketing, mobile app development for iOS and Android, AI voice and chat agents for business, large-scale web applications, and technical consultation for new or legacy projects. Ask about any of them for more detail.'
    },
    {
      q: 'Tell me about your apps',
      a: 'Tabulo is a calculator with tabs: keep several calculations open and link results between them. Optipixa shrinks photos to the exact size online forms ask for, right on your phone. Both are private, ad-free, work offline and are in closed testing on Android.'
    },
    {
      q: 'How do I start a project?',
      a: 'Email ' + EMAIL + ' with a few lines on what you need, your timeline and a rough budget. We reply within 24 hours.'
    }
  ];

  var history = []; // { role, content } sent to the Worker
  var busy = false;

  // ---- Build the UI -------------------------------------------------------
  var launcher = el('button', 'chat-launcher', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'chat-panel' });
  launcher.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>';
  launcher.appendChild(el('span', 'chat-launcher-label', null, 'Ask us'));

  var panel = el('section', 'chat-panel', { id: 'chat-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'chat-title', hidden: '' });

  var head = el('div', 'chat-head');
  var titleWrap = el('div', 'chat-title-wrap');
  titleWrap.appendChild(el('h2', 'chat-title', { id: 'chat-title' }, 'Ask The Code Cipher'));
  titleWrap.appendChild(el('p', 'chat-sub', null, 'AI assistant · answers can be wrong'));
  var closeBtn = el('button', 'chat-close', { type: 'button', 'aria-label': 'Close chat' });
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  head.appendChild(titleWrap);
  head.appendChild(closeBtn);

  var log = el('div', 'chat-log', { role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', tabindex: '0', 'aria-label': 'Conversation' });

  var chips = el('div', 'chat-chips', { role: 'group', 'aria-label': 'Suggested questions' });
  QUICK.forEach(function (item) {
    var chip = el('button', 'chat-chip', { type: 'button' }, item.q);
    chip.addEventListener('click', function () { askQuick(item); });
    chips.appendChild(chip);
  });

  var form = el('form', 'chat-form');
  var input = el('textarea', 'chat-input', {
    rows: '1', maxlength: String(MAX_CHARS), placeholder: 'Type your question…', 'aria-label': 'Your question',
    enterkeyhint: 'send'
  });
  var send = el('button', 'chat-send', { type: 'submit', 'aria-label': 'Send' });
  send.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  form.appendChild(input);
  form.appendChild(send);

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(chips);
  panel.appendChild(form);
  document.body.appendChild(panel);
  document.body.appendChild(launcher);

  addMessage('assistant', GREETING);

  // ---- Behaviour ----------------------------------------------------------
  launcher.addEventListener('click', function () { panel.hidden ? open() : close(); });
  closeBtn.addEventListener('click', close);
  panel.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  input.addEventListener('input', autosize);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit ? form.requestSubmit() : submit(e);
    }
  });
  form.addEventListener('submit', submit);

  function open() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('chat-open');
    input.focus();
    scrollToEnd();
  }

  function close() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('chat-open');
    launcher.focus();
  }

  function askQuick(item) {
    if (busy) return;
    chips.hidden = true;
    addMessage('user', item.q);
    addMessage('assistant', item.a);
    history.push({ role: 'user', content: item.q }, { role: 'assistant', content: item.a });
    input.focus();
  }

  function submit(e) {
    if (e) e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    chips.hidden = true;
    input.value = '';
    autosize();
    addMessage('user', text);
    history.push({ role: 'user', content: text });
    ask();
  }

  function ask() {
    busy = true;
    send.disabled = true;
    var typing = addTyping();

    if (!ENDPOINT) {
      finish(FALLBACK, false);
      return;
    }

    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { controller && controller.abort(); }, 20000);

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-6) }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (r) {
        finish((r.data && r.data.reply) || FALLBACK, r.ok);
      })
      .catch(function () { finish(FALLBACK, false); })
      .then(function () { clearTimeout(timer); });

    function finish(reply, ok) {
      typing.remove();
      addMessage('assistant', reply);
      if (ok) {
        history.push({ role: 'assistant', content: reply });
      } else {
        // Drop the unanswered question so the next request still alternates roles.
        history.pop();
      }
      busy = false;
      send.disabled = false;
    }
  }

  // ---- Rendering ----------------------------------------------------------
  function addMessage(role, text) {
    var msg = el('div', 'chat-msg chat-msg--' + role);
    msg.appendChild(el('span', 'visually-hidden', null, role === 'user' ? 'You: ' : 'Assistant: '));
    appendLinked(msg, text);
    log.appendChild(msg);
    scrollToEnd();
    return msg;
  }

  function addTyping() {
    var t = el('div', 'chat-msg chat-msg--assistant chat-typing', { 'aria-label': 'Assistant is typing' });
    t.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(t);
    scrollToEnd();
    return t;
  }

  // Adds text to a node, turning our email address and our own site links into
  // links. Everything else stays plain text (never parsed as HTML).
  function appendLinked(node, text) {
    var re = /([A-Za-z0-9._%+-]+@gmail\.com|https:\/\/(?:[a-z0-9-]+\.)?thecodecipher\.com[^\s)]*)/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var match = m[0].replace(/[.,;:!?]+$/, '');
      var a = document.createElement('a');
      if (match.indexOf('@') > -1) {
        if (match.toLowerCase() !== EMAIL) { node.appendChild(document.createTextNode(m[0])); last = re.lastIndex; continue; }
        a.href = 'mailto:' + EMAIL;
      } else {
        a.href = match;
      }
      a.textContent = match;
      node.appendChild(a);
      if (match.length < m[0].length) node.appendChild(document.createTextNode(m[0].slice(match.length)));
      last = re.lastIndex;
    }
    if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
  }

  function scrollToEnd() { log.scrollTop = log.scrollHeight; }

  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    input.style.overflowY = input.scrollHeight > 140 ? 'auto' : 'hidden';
  }

  function el(tag, cls, attrs, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text) node.textContent = text;
    return node;
  }
})();
