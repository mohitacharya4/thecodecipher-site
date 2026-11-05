// HTML templates for the generated blog pages. Everything a crawler needs
// (text, links, metadata, JSON-LD) is in the HTML; JavaScript only adds motion.

export const SITE = {
  url: 'https://thecodecipher.com',
  name: 'The Code Cipher',
  orgId: 'https://thecodecipher.com/#org',
  description: 'The Code Cipher is a product engineering studio. We build our own private products, the Free Invoice Generator, Tabulo and Optipixa, and build mobile apps, web platforms and AI agents for businesses.',
  ogImage: 'https://thecodecipher.com/assets/og-image.png',
  chatEndpoint: 'https://thecodecipher-chat.thecodecipher-studio.workers.dev/chat',
  // Last time the hand-written homepage changed. Bump when editing index.html.
  updated: '2026-11-03',
};

const PLAIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CIPHER = 'QWERTYUIOPASDFGHJKLZXCVBNM';

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The site's substitution cipher, used for decorative covers.
export function encipher(text) {
  return String(text).replace(/[a-z]/gi, (ch) => {
    const c = CIPHER[PLAIN.indexOf(ch.toUpperCase())];
    return ch === ch.toUpperCase() ? c : c.toLowerCase();
  });
}

export function jsonLd(data) {
  // Escape "<" so a value can never close the script tag.
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, '\\u003c')}\n</script>`;
}

export function displayDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:wght@400;600&display=swap';

function head({ title, description, url, image, imageAlt, imageWidth, imageHeight, type, extra = '' }) {
  const imageSize = imageWidth && imageHeight
    ? `
  <meta property="og:image:width" content="${imageWidth}">
  <meta property="og:image:height" content="${imageHeight}">`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(url)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="${SITE.name}">
  <meta property="og:locale" content="en_US">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(image)}">${imageSize}
  <meta property="og:image:alt" content="${esc(imageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#E9ECEF" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0E1116" media="(prefers-color-scheme: dark)">
  <meta name="chat-endpoint" content="${SITE.chatEndpoint}">
  <link rel="alternate" type="application/rss+xml" title="${SITE.name} blog" href="/feed.xml">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
${extra}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${FONTS}">
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/blog.css">
</head>`;
}

function header() {
  return `  <a class="skip" href="#main">Skip to content</a>

  <header class="site-header">
   <div class="header-inner wrap">
    <a class="wordmark" href="/" aria-label="The Code Cipher, home">
      <img src="/assets/favicon.svg" alt="" width="28" height="28">
      <span>The Code Cipher</span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">
      <svg class="menu-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path class="menu-icon-open" d="M4 7h16M4 12h16M4 17h16"/><path class="menu-icon-close" d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <nav id="site-nav" aria-label="Main">
      <a href="/#products">Products</a>
      <a href="/#services">Services</a>
      <a href="/blog/" aria-current="page">Blog</a>
      <a href="/#contact">Contact</a>
      <a class="menu-cta button" href="/#contact">Get in touch</a>
    </nav>
    <a class="button button--small header-cta" href="/#contact">Get in touch</a>
   </div>
  </header>`;
}

function footer() {
  return `  <footer class="site-footer wrap">
    <span>© ${new Date().getUTCFullYear()} The Code Cipher</span>
    <span class="footer-links"><a href="/blog/">Blog</a> · <a href="/feed.xml">RSS</a></span>
  </footer>

  <script src="/decode.js" defer></script>
  <script src="/blog.js" defer></script>
  <script src="/chat.js" defer></script>
</body>
</html>
`;
}

function cover(post, { eager = false } = {}) {
  if (post.cover) {
    const size = post.coverWidth ? ` width="${post.coverWidth}" height="${post.coverHeight}"` : '';
    return `<img src="${esc(post.coverUrl)}" alt="${esc(post.coverAlt)}"${size} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  }
  // No cover: a typographic cover showing the title in the site's cipher.
  return `<span class="cipher-cover" aria-hidden="true"><span data-plain="${esc(post.title)}">${esc(encipher(post.title))}</span></span>`;
}

function meta(post) {
  const tag = post.tags[0] ? `<span>${esc(post.tags[0])}</span>` : '';
  return `<p class="post-card-meta"><time datetime="${post.date}">${displayDate(post.date)}</time>${tag}<span>${post.minutes} min read</span></p>`;
}

export function card(post, { featured = false, headingLevel = 3 } = {}) {
  const h = `h${headingLevel}`;
  const tags = post.tags.map((t) => esc(t)).join('|');
  return `<article class="post-card${featured ? ' post-card--featured' : ''}" data-tags="${tags}">
          <a class="post-card-link" href="${post.path}">
            <span class="post-card-cover">${cover(post)}</span>
            <span class="post-card-body">
              ${meta(post)}
              <${h} class="post-card-title">${esc(post.title)}</${h}>
              <span class="post-card-text">${esc(featured ? post.summary : post.description)}</span>
              <span class="post-card-more">Read the post <span aria-hidden="true">→</span></span>
            </span>
          </a>
        </article>`;
}

// The homepage "Writing" section, placed between the blog markers.
export function homeSection(posts) {
  if (!posts.length) return '';
  const [first, ...rest] = posts.slice(0, 3);
  return `<section id="writing" class="section wrap" aria-labelledby="writing-title">
      <h2 id="writing-title" class="eyebrow">Writing <span class="count">${posts.length}</span></h2>
      <p class="section-intro">Field notes from building our own products: what worked, what didn’t, and how to do it yourself. <a href="/blog/">Read all posts</a>.</p>
      <div class="writing-grid">
        ${card(first, { featured: true })}
        ${rest.map((p) => card(p)).join('\n        ')}
      </div>
    </section>`;
}

export function postPage(post, related) {
  const toc = post.toc.length > 1
    ? `<nav class="toc" aria-labelledby="toc-title">
          <p class="toc-title" id="toc-title">On this page</p>
          <ol>
            ${post.toc.map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join('\n            ')}
          </ol>
        </nav>`
    : '';

  const faq = post.faq.length
    ? `<section class="faq" aria-labelledby="faq">
            <h2 id="faq">Frequently asked questions</h2>
            ${post.faq.map((f) => `<details>
              <summary><h3>${esc(f.question)}</h3></summary>
              <div class="faq-answer">${f.answerHtml}</div>
            </details>`).join('\n            ')}
          </section>`
    : '';

  const updated = post.updated !== post.date
    ? ` · Updated <time datetime="${post.updated}">${displayDate(post.updated)}</time>`
    : '';

  const author = post.author === SITE.name
    ? { '@id': SITE.orgId }
    : { '@type': 'Person', name: post.author };

  const graph = [
    {
      '@type': 'BlogPosting',
      '@id': `${post.url}#article`,
      headline: post.title,
      description: post.description,
      abstract: post.summary,
      image: [post.cover ? post.coverAbs : SITE.ogImage],
      datePublished: post.date,
      dateModified: post.updated,
      author,
      publisher: { '@id': SITE.orgId },
      mainEntityOfPage: post.url,
      url: post.url,
      wordCount: post.words,
      keywords: post.tags.join(', ') || undefined,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE.url}/blog/#blog` },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.url}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE.url}/blog/` },
        { '@type': 'ListItem', position: 3, name: post.title, item: post.url },
      ],
    },
  ];
  if (post.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: post.faq.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answerText },
      })),
    });
  }

  const extra = [
    `  <meta property="article:published_time" content="${post.date}">`,
    `  <meta property="article:modified_time" content="${post.updated}">`,
    ...post.tags.map((t) => `  <meta property="article:tag" content="${esc(t)}">`),
    jsonLd({ '@context': 'https://schema.org', '@graph': graph }).replace(/^/gm, '  '),
  ].join('\n');

  return `${head({
    title: `${post.title} · ${SITE.name}`,
    description: post.description,
    url: post.url,
    image: post.cover ? post.coverAbs : SITE.ogImage,
    imageAlt: post.cover ? post.coverAlt : post.title,
    imageWidth: post.cover ? post.coverWidth : 1200,
    imageHeight: post.cover ? post.coverHeight : 630,
    type: 'article',
    extra,
  })}
<body class="blog-page">
  <div class="read-progress" aria-hidden="true"><span></span></div>
${header()}

  <main id="main">
    <article class="post">
      <header class="post-head wrap">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog/">Blog</a></nav>
        <p class="post-tags">${post.tags.map((t) => `<a href="/blog/#tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}<span>${post.minutes} min read</span></p>
        <h1 class="post-title" data-decode aria-label="${esc(post.title)}">${esc(post.title)}</h1>
        <p class="post-byline">By ${esc(post.author)} · <time datetime="${post.date}">${displayDate(post.date)}</time>${updated}</p>
      </header>

      ${post.cover ? `<figure class="post-cover wrap">${cover(post, { eager: true })}</figure>` : ''}

      <div class="post-layout wrap">
        <aside class="answer" aria-labelledby="answer-title">
          <p class="answer-label" id="answer-title">Short answer</p>
          <p class="answer-text">${esc(post.summary)}</p>
        </aside>
        ${toc}
        <div class="prose">
          ${post.html}
          ${faq}
        </div>
      </div>
    </article>

    <section class="post-cta wrap" aria-labelledby="cta-title">
      <div class="contact-card">
        <div class="contact-text">
          <p class="contact-line" id="cta-title">Want this built for your business?</p>
          <p class="contact-sub">We design, build and ship mobile apps, web platforms and AI agents. Tell us what you need and we reply within 24 hours.</p>
        </div>
        <div class="contact-actions">
          <a class="button button--light" href="https://cal.com/thecodecipher/15min" target="_blank" rel="noopener">Book a 15-min call <span aria-hidden="true">→</span><span class="visually-hidden"> (opens Cal.com in a new tab)</span></a>
          <a class="button button--on-band" href="/#contact">Get in touch <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </section>

    ${related.length ? `<section class="section wrap related" aria-labelledby="related-title">
      <h2 id="related-title" class="eyebrow">Keep reading</h2>
      <div class="post-grid">
        ${related.map((p) => card(p)).join('\n        ')}
      </div>
    </section>` : ''}
  </main>

${footer()}`;
}

export function blogIndexPage(posts) {
  const url = `${SITE.url}/blog/`;
  const description = 'Guides and field notes from The Code Cipher on building apps, web platforms, AI agents and getting found online.';
  const tags = [...new Set(posts.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b));
  const [first, ...rest] = posts;

  const graph = [
    {
      '@type': 'Blog',
      '@id': `${url}#blog`,
      name: `${SITE.name} blog`,
      description,
      url,
      publisher: { '@id': SITE.orgId },
      inLanguage: 'en',
    },
    {
      '@type': 'ItemList',
      itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: p.url, name: p.title })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.url}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: url },
      ],
    },
  ];

  const body = posts.length
    ? `${tags.length > 1 ? `<div class="tag-filter" role="group" aria-label="Filter by topic" hidden>
        <button type="button" class="chip" aria-pressed="true" data-tag="">All</button>
        ${tags.map((t) => `<button type="button" class="chip" aria-pressed="false" data-tag="${esc(t)}">${esc(t)}</button>`).join('\n        ')}
      </div>` : ''}
      <div class="post-grid post-grid--index">
        ${card(first, { featured: true, headingLevel: 2 })}
        ${rest.map((p) => card(p, { headingLevel: 2 })).join('\n        ')}
      </div>
      <p class="filter-empty" hidden>No posts on this topic yet.</p>`
    : '<p class="lede">The first posts are on their way.</p>';

  return `${head({
    title: `Blog · ${SITE.name}`,
    description,
    url,
    image: SITE.ogImage,
    imageAlt: `${SITE.name} blog`,
    type: 'website',
    extra: jsonLd({ '@context': 'https://schema.org', '@graph': graph }).replace(/^/gm, '  '),
  })}
<body class="blog-page">
${header()}

  <main id="main">
    <section class="blog-hero wrap">
      <p class="key" aria-hidden="true"><span class="key-label">blog</span><span>${esc(encipher('Field notes'))} → Field notes</span></p>
      <h1 class="blog-title" data-decode aria-label="Field notes from the studio.">Field notes from the studio.</h1>
      <p class="lede">How we build apps, web platforms and AI agents, and what we learn shipping them. Practical, specific and written to be useful.</p>
    </section>

    <section class="section wrap blog-list" aria-label="All posts">
      ${body}
    </section>
  </main>

${footer()}`;
}
