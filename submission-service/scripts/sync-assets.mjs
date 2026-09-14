import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const publicRoot = new URL('../public/', import.meta.url);
await mkdir(new URL('guide/', publicRoot), { recursive: true });
await mkdir(new URL('guide-assets/', publicRoot), { recursive: true });
const copies = new Map([
  ['assets/icon.png', 'icon.png'],
  ['assets/contrib/rlebench-harbor-template.zip', 'rlebench-harbor-template.zip'],
  ['contribute/contribute.css', 'guide/contribute.css'],
  ['styles.css', 'guide-assets/styles.css'],
  ['homepage-header.css', 'guide-assets/homepage-header.css'],
  ['navigation.css', 'guide-assets/navigation.css'],
  ['navigation.js', 'guide-assets/navigation.js'],
  ['run/run.css', 'guide-assets/run.css'],
  ['run/run.js', 'guide-assets/run.js']
]);
for (const [from, to] of copies) await copyFile(new URL(from, root), new URL(to, publicRoot));
const guide = await readFile(new URL('contribute/index.html', root), 'utf8');
const html = guide.replace(/(href|src)="([^"]+)"/g, (match, attribute, value) => {
  if (value.startsWith('#') || /^[a-z]+:/i.test(value)) return match;
  const url = new URL(value, 'https://rle-bench.github.io/contribute/');
  const path = url.pathname.slice(1);
  const mapped = copies.get(path) || (path === 'assets/favicon-64.png' ? 'icon.png' : null);
  const target = mapped ? `/${mapped}${url.search}${url.hash}` : path === 'contribute/' ? '/guide/' : url.href;
  return `${attribute}="${target}"`;
}).replace(/<script>try\{const t=localStorage[^\n]*?<\/script>/, '<script src="/theme.js"></script>')
  .replace('</head>', '<meta name="robots" content="noindex, nofollow"/>\n</head>');
await writeFile(new URL('guide/index.html', publicRoot), html);
