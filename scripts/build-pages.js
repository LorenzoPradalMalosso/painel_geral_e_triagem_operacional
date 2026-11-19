const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
const source = path.join(root, 'src', 'client');
const files = ['app.js', 'ui.js', 'styles.css'];
const platformFiles = ['_headers', '_redirects', '_routes.json'];

async function build() {
  await fs.mkdir(path.join(output, 'monitor'), { recursive: true });
  for (const name of files) await fs.copyFile(path.join(source, name), path.join(output, name));
  for (const name of platformFiles) await fs.copyFile(path.join(root, 'pages', name), path.join(output, name));
  const html = await fs.readFile(path.join(source, 'index.html'), 'utf8');
  await fs.writeFile(path.join(output, 'index.html'), html.replace('<script type="module" src="/app.js"></script>', '<script type="module" src="/app.js"></script>'));
  await fs.writeFile(path.join(output, 'monitor', 'index.html'), html);
}

build().catch(error => { console.error(error); process.exitCode = 1; });
