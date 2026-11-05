// Builds the deployable site into _site/: copies the hand-written pages,
// renders each Markdown post in content/posts/<slug>/index.md to static HTML,
// and generates the blog index, homepage "Writing" section, sitemap, RSS feed,
// llms.txt and robots.txt.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { Marked } from 'marked';
import { SITE, esc, homeSection, postPage, blogIndexPage } from './templates.mjs';

// Only these files and folders are published. Anything else in the repo stays private.
const PUBLIC = [
  'index.html', '404.html', 'style.css', 'blog.css', 'decode.js', 'chat.js', 'blog.js',
  'CNAME', '.nojekyll', 'assets', 'admin',
];

const START = '<!-- blog:start -->';
const END = '<!-- blog:end -->';

function isoDate(value, field, file) {
  if (value === undefined || value === null || value === '') return undefined;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new Error(`${file}: "${field}" is not a valid date (${value})`);
  return d.toISOString().slice(0, 10);
}

// Read an image's pixel size from its PNG or JPEG header, so pages can
// reserve space for it (no layout shift) and declare it for link previews.
export function imageSize(file) {
  const b = readFileSync(file);
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const length = b.readUInt16BE(i + 2);
      // SOF0-SOF15 hold the frame size; C4 (DHT), C8 (JPG) and CC (DAC) do not.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      }
      i += 2 + length;
    }
  }
  return null;
}

function slugify(text) {
  return text.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}

function plainText(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function renderMarkdown(markdown) {
  const toc = [];
  const used = new Map();
  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        // Posts own the page's only h1, so body headings start at h2.
        const level = Math.max(depth, 2);
        let id = slugify(inner);
        const n = used.get(id) || 0;
        used.set(id, n + 1);
        if (n) id = `${id}-${n + 1}`;
        if (level === 2) toc.push({ id, text: plainText(inner) });
        return `<h${level} id="${id}">${inner}</h${level}>\n`;
      },
      image({ href, title, text }) {
        const t = title ? ` title="${esc(title)}"` : '';
        return `<img src="${esc(href)}" alt="${esc(text)}"${t} loading="lazy" decoding="async">`;
      },
    },
  });
  return { html: md.parse(markdown), toc };
}

export function loadPosts(root) {
  const dir = join(root, 'content', 'posts');
  if (!existsSync(dir)) return [];
  const posts = [];
  for (const slug of readdirSync(dir)) {
    const file = join(dir, slug, 'index.md');
    if (!existsSync(file)) continue;
    const { data, content } = matter(readFileSync(file, 'utf8'));
    if (data.draft) continue;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(`${file}: folder name "${slug}" must be lowercase words joined by hyphens`);
    }
    for (const field of ['title', 'description', 'summary', 'date']) {
      if (!data[field]) throw new Error(`${file}: "${field}" is required`);
    }
    if (data.cover && !data.cover_alt) {
      throw new Error(`${file}: "cover_alt" (image description) is required when there is a cover image`);
    }

    const date = isoDate(data.date, 'date', file);
    const updated = isoDate(data.updated, 'updated', file) || date;
    const { html, toc } = renderMarkdown(content);
    const words = content.split(/\s+/).filter(Boolean).length;
    const path = `/blog/${slug}/`;
    const md = new Marked({ gfm: true });
    const faq = (data.faq || [])
      .filter((f) => f && f.question && f.answer)
      .map((f) => {
        const answerHtml = md.parse(String(f.answer));
        return { question: String(f.question), answerHtml, answerText: plainText(answerHtml) };
      });

    const coverFile = data.cover ? join(dir, slug, String(data.cover).replace(/^\.?\//, '')) : '';
    if (coverFile && !existsSync(coverFile)) throw new Error(`${file}: cover image "${data.cover}" not found`);
    const size = coverFile ? imageSize(coverFile) : null;

    posts.push({
      slug,
      coverWidth: size ? size.width : 0,
      coverHeight: size ? size.height : 0,
      dir: join(dir, slug),
      title: String(data.title),
      description: String(data.description),
      summary: String(data.summary),
      author: data.author ? String(data.author) : SITE.name,
      date,
      updated: updated < date ? date : updated,
      tags: (data.tags || []).map(String),
      cover: data.cover ? String(data.cover) : '',
      coverAlt: data.cover_alt ? String(data.cover_alt) : '',
      coverUrl: data.cover ? `${path}${String(data.cover).replace(/^\.?\//, '')}` : '',
      coverAbs: data.cover ? `${SITE.url}${path}${String(data.cover).replace(/^\.?\//, '')}` : '',
      faq,
      html,
      toc,
      words,
      minutes: Math.max(1, Math.round(words / 220)),
      path,
      url: `${SITE.url}${path}`,
    });
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

function relatedTo(post, posts) {
  const others = posts.filter((p) => p !== post);
  const score = (p) => p.tags.filter((t) => post.tags.includes(t)).length;
  return others
    .map((p, i) => ({ p, s: score(p), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, 3)
    .map((x) => x.p);
}

function sitemap(posts) {
  const latest = posts.reduce((m, p) => (p.updated > m ? p.updated : m), '');
  const home = latest > SITE.updated ? latest : SITE.updated;
  const urls = [
    { loc: `${SITE.url}/`, lastmod: home },
    { loc: `${SITE.url}/blog/`, lastmod: latest || SITE.updated },
    ...posts.map((p) => ({ loc: p.url, lastmod: p.updated })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`).join('\n')}
</urlset>
`;
}

function rfc822(iso) {
  return new Date(`${iso}T00:00:00Z`).toUTCString();
}

function feed(posts, today) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE.name)} blog</title>
    <link>${SITE.url}/blog/</link>
    <atom:link href="${SITE.url}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Guides and field notes from ${esc(SITE.name)}.</description>
    <language>en</language>
    <lastBuildDate>${rfc822(today)}</lastBuildDate>
${posts.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${p.url}</link>
      <guid isPermaLink="true">${p.url}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <description>${esc(p.summary)}</description>
${p.tags.map((t) => `      <category>${esc(t)}</category>`).join('\n')}
    </item>`).join('\n')}
  </channel>
</rss>
`;
}

// llms.txt (llmstxt.org): a plain-text map of the site for AI assistants.
function llms(posts) {
  return `# ${SITE.name}

> ${SITE.description}

Contact: thecodecipher@gmail.com · Book a call: https://cal.com/thecodecipher/15min

## Pages

- [Home](${SITE.url}/): products, services and contact
- [Blog](${SITE.url}/blog/): guides and field notes
- [Free Invoice Generator](https://invoicegenerator.thecodecipher.com/): free web app that makes invoice PDFs on any device, no sign-up, nothing uploaded
- [Tabulo](https://tabulo.thecodecipher.com/): multi-tab calculator for Android
- [Optipixa](https://optipixa.thecodecipher.com/): photo compressor for Android that hits exact file sizes offline

## Blog posts

${posts.map((p) => `- [${p.title}](${p.url}): ${p.summary}`).join('\n')}
`;
}

function robots() {
  return `User-agent: *
Allow: /
Disallow: /admin/

Sitemap: ${SITE.url}/sitemap.xml
`;
}

function injectHome(html, posts) {
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start < 0 || end < start) throw new Error(`index.html must contain ${START} and ${END}`);
  let out = `${html.slice(0, start + START.length)}\n    ${homeSection(posts)}\n    ${html.slice(end)}`;
  if (!out.includes('application/rss+xml')) {
    out = out.replace('</head>', `  <link rel="alternate" type="application/rss+xml" title="${SITE.name} blog" href="/feed.xml">\n</head>`);
  }
  return out;
}

// Add ?v=<content hash> to stylesheet and script links in every page, so a
// release is picked up at once instead of after the browser cache expires.
const VERSIONED = ['style.css', 'blog.css', 'decode.js', 'chat.js', 'blog.js'];

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

function versionAssets(out) {
  const versions = VERSIONED
    .filter((name) => existsSync(join(out, name)))
    .map((name) => [name, createHash('sha256').update(readFileSync(join(out, name))).digest('hex').slice(0, 8)]);
  for (const file of htmlFiles(out)) {
    let html = readFileSync(file, 'utf8');
    for (const [name, v] of versions) {
      const re = new RegExp(`((?:href|src)=")(/?${name.replace(/\./g, '\\.')})(")`, 'g');
      html = html.replace(re, `$1$2?v=${v}$3`);
    }
    writeFileSync(file, html);
  }
}

export function build({ root, out, today = new Date().toISOString().slice(0, 10) }) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  for (const name of PUBLIC) {
    const src = join(root, name);
    if (existsSync(src)) cpSync(src, join(out, name), { recursive: true });
  }

  const posts = loadPosts(root);

  for (const post of posts) {
    const dest = join(out, 'blog', post.slug);
    mkdirSync(dest, { recursive: true });
    // Copy the post's images and other files, but not its Markdown source.
    for (const f of readdirSync(post.dir)) {
      if (f === 'index.md') continue;
      cpSync(join(post.dir, f), join(dest, f), { recursive: true });
    }
    writeFileSync(join(dest, 'index.html'), postPage(post, relatedTo(post, posts)));
  }

  mkdirSync(join(out, 'blog'), { recursive: true });
  writeFileSync(join(out, 'blog', 'index.html'), blogIndexPage(posts));
  writeFileSync(join(out, 'index.html'), injectHome(readFileSync(join(root, 'index.html'), 'utf8'), posts));
  writeFileSync(join(out, 'sitemap.xml'), sitemap(posts));
  writeFileSync(join(out, 'feed.xml'), feed(posts, today));
  writeFileSync(join(out, 'llms.txt'), llms(posts));
  writeFileSync(join(out, 'robots.txt'), robots());
  versionAssets(out);

  return posts;
}

// Run directly: node build/build.mjs
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const posts = build({ root, out: join(root, '_site') });
  console.log(`Built ${posts.length} post${posts.length === 1 ? '' : 's'} into _site/`);
}

