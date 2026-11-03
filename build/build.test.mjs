import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from './build.mjs';

let root, out;

function post(slug, front, body = '## First heading\n\nSome text.\n\n## Second heading\n\nMore text.') {
  const dir = join(root, 'content', 'posts', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.md'), `---\n${front}\n---\n\n${body}\n`);
  return dir;
}

function jsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return blocks.flatMap((m) => {
    const data = JSON.parse(m[1]);
    return data['@graph'] || [data];
  });
}

before(() => {
  root = mkdtempSync(join(tmpdir(), 'tcc-site-'));
  out = join(root, '_site');
  writeFileSync(join(root, 'index.html'),
    '<html><head><title>Home</title></head><body><nav><a href="#x">X</a></nav><main>\n<!-- blog:start -->\n<!-- blog:end -->\n</main></body></html>');
  writeFileSync(join(root, 'style.css'), 'body{}');
  writeFileSync(join(root, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'assets', 'logo.png'), 'x');
  writeFileSync(join(root, 'secret-notes.txt'), 'should not be published');

  const a = post('older-post', [
    'title: "How to shrink a photo to 50 KB"',
    'description: "A step-by-step guide to hitting an exact file size."',
    'summary: "Set a target size, then lower quality until the file fits."',
    'date: 2026-10-01',
    'tags: [Photos, Guides]',
    'cover: cover.jpg',
    'cover_alt: "A phone showing a photo at 49 KB"',
    'faq:',
    '  - question: "Does it upload my photo?"',
    '    answer: "No. Everything runs **on your phone**."',
  ].join('\n'));
  writeFileSync(join(a, 'cover.jpg'), 'img');

  post('newer-post', [
    'title: "Why exact decimal math matters <really>"',
    'description: "Floating point surprises & how to avoid them."',
    'summary: "Binary floats cannot store 0.1 exactly."',
    'date: 2026-10-20',
    'updated: 2026-10-25',
    'tags: [Guides]',
  ].join('\n'));

  post('secret-draft', [
    'title: "Unfinished"',
    'description: "x"',
    'summary: "x"',
    'date: 2026-10-30',
    'draft: true',
  ].join('\n'));

  build({ root, out, today: '2026-11-03' });
});

test('drafts are not published anywhere', () => {
  assert.equal(existsSync(join(out, 'blog', 'secret-draft')), false);
  for (const f of ['index.html', 'sitemap.xml', 'feed.xml', 'llms.txt', 'blog/index.html']) {
    assert.doesNotMatch(readFileSync(join(out, f), 'utf8'), /Unfinished|secret-draft/, f);
  }
});

test('only allow-listed site files are copied', () => {
  assert.ok(existsSync(join(out, 'style.css')));
  assert.ok(existsSync(join(out, 'assets', 'logo.png')));
  assert.equal(existsSync(join(out, 'secret-notes.txt')), false);
  assert.equal(existsSync(join(out, 'content')), false);
});

test('each post is complete static HTML with SEO metadata', () => {
  const html = readFileSync(join(out, 'blog', 'older-post', 'index.html'), 'utf8');
  assert.match(html, /<title>How to shrink a photo to 50 KB · The Code Cipher<\/title>/);
  assert.match(html, /<meta name="description" content="A step-by-step guide to hitting an exact file size.">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/thecodecipher.com\/blog\/older-post\/">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/thecodecipher.com\/blog\/older-post\/cover.jpg">/);
  assert.match(html, /Set a target size, then lower quality until the file fits\./, 'short answer in raw HTML');
  assert.match(html, /<h2 id="first-heading">First heading<\/h2>/);
  assert.match(html, /href="#second-heading"/, 'table of contents');
  assert.match(html, /<strong>on your phone<\/strong>/, 'FAQ answer rendered');
  assert.ok(existsSync(join(out, 'blog', 'older-post', 'cover.jpg')), 'post images copied');
});

test('post HTML escapes titles and descriptions', () => {
  const html = readFileSync(join(out, 'blog', 'newer-post', 'index.html'), 'utf8');
  assert.match(html, /<title>Why exact decimal math matters &lt;really&gt; · The Code Cipher<\/title>/);
  assert.match(html, /content="Floating point surprises &amp; how to avoid them."/);
});

test('post JSON-LD has BlogPosting, BreadcrumbList and FAQPage', () => {
  const graph = jsonLd(readFileSync(join(out, 'blog', 'older-post', 'index.html'), 'utf8'));
  const article = graph.find((n) => n['@type'] === 'BlogPosting');
  assert.equal(article.headline, 'How to shrink a photo to 50 KB');
  assert.equal(article.datePublished, '2026-10-01');
  assert.equal(article.dateModified, '2026-10-01');
  assert.equal(article.publisher['@id'], 'https://thecodecipher.com/#org');
  assert.equal(article.mainEntityOfPage, 'https://thecodecipher.com/blog/older-post/');
  assert.deepEqual(article.image, ['https://thecodecipher.com/blog/older-post/cover.jpg']);
  assert.ok(graph.find((n) => n['@type'] === 'BreadcrumbList'));
  const faq = graph.find((n) => n['@type'] === 'FAQPage');
  assert.equal(faq.mainEntity[0].name, 'Does it upload my photo?');
  assert.equal(faq.mainEntity[0].acceptedAnswer.text, 'No. Everything runs on your phone.');
});

test('posts without an FAQ have no FAQPage, and updated sets dateModified', () => {
  const graph = jsonLd(readFileSync(join(out, 'blog', 'newer-post', 'index.html'), 'utf8'));
  assert.equal(graph.find((n) => n['@type'] === 'FAQPage'), undefined);
  assert.equal(graph.find((n) => n['@type'] === 'BlogPosting').dateModified, '2026-10-25');
});

test('homepage gets the latest posts in plain HTML, newest first', () => {
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const newer = html.indexOf('/blog/newer-post/');
  const older = html.indexOf('/blog/older-post/');
  assert.ok(newer > 0 && older > newer);
  assert.match(html, /<link rel="alternate" type="application\/rss\+xml"/);
  assert.match(html, /href="\/blog\/"/);
});

test('blog index lists every post with ItemList JSON-LD', () => {
  const html = readFileSync(join(out, 'blog', 'index.html'), 'utf8');
  assert.match(html, /\/blog\/newer-post\//);
  assert.match(html, /\/blog\/older-post\//);
  const list = jsonLd(html).find((n) => n['@type'] === 'ItemList');
  assert.equal(list.itemListElement.length, 2);
});

test('sitemap, feed, llms.txt and robots are generated', () => {
  const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/thecodecipher.com\/blog\/older-post\/<\/loc>\s*<lastmod>2026-10-01<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/thecodecipher.com\/blog\/newer-post\/<\/loc>\s*<lastmod>2026-10-25<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/thecodecipher.com\/blog\/<\/loc>/);
  assert.match(readFileSync(join(out, 'feed.xml'), 'utf8'), /<title>Why exact decimal math matters &lt;really&gt;<\/title>/);
  assert.match(readFileSync(join(out, 'llms.txt'), 'utf8'), /\[How to shrink a photo to 50 KB\]\(https:\/\/thecodecipher.com\/blog\/older-post\/\)/);
  assert.match(readFileSync(join(out, 'robots.txt'), 'utf8'), /Disallow: \/admin\//);
});

test('a cover image without alt text fails the build', () => {
  const r = mkdtempSync(join(tmpdir(), 'tcc-alt-'));
  writeFileSync(join(r, 'index.html'), '<head></head><!-- blog:start --><!-- blog:end -->');
  const dir = join(r, 'content', 'posts', 'no-alt');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.md'), '---\ntitle: T\ndescription: D\nsummary: S\ndate: 2026-10-01\ncover: c.jpg\n---\nBody');
  assert.throws(() => build({ root: r, out: join(r, '_site') }), /cover_alt/);
});
