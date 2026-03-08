const { build } = require('esbuild');
const { cpSync, mkdirSync, renameSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const isDev = process.argv.includes('--dev');
const srcDir = join(__dirname, '..', 'src');
const outDir = join(__dirname, '..', 'dist-extension');

const backgroundEntry = isDev
  ? join(srcDir, 'runtime', 'background', 'background-dev.ts')
  : join(srcDir, 'runtime', 'background', 'background.ts');

const serverUrl = isDev
  ? 'http://127.0.0.1:3000'
  : 'https://hutch-app.com';

async function main() {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'popup'), { recursive: true });
  mkdirSync(join(outDir, 'background'), { recursive: true });
  mkdirSync(join(outDir, 'content'), { recursive: true });
  mkdirSync(join(outDir, 'icons'), { recursive: true });
  mkdirSync(join(outDir, 'icons-saved'), { recursive: true });

  await build({
    entryPoints: [
      join(srcDir, 'runtime', 'popup', 'popup.ts'),
      join(srcDir, 'runtime', 'content', 'shortcut.ts'),
    ],
    bundle: true,
    format: 'iife',
    outdir: outDir,
    outbase: join(srcDir, 'runtime'),
    target: 'firefox91',
    define: {},
  });

  await build({
    entryPoints: [backgroundEntry],
    bundle: true,
    format: 'iife',
    outfile: join(outDir, 'background', 'background.js'),
    target: 'firefox91',
    define: {
      HUTCH_SERVER_URL: JSON.stringify(serverUrl),
    },
  });

  cpSync(join(srcDir, 'runtime', 'manifest.json'), join(outDir, 'manifest.json'));
  cpSync(join(srcDir, 'runtime', 'popup', 'popup.template.html'), join(outDir, 'popup', 'popup.template.html'));
  cpSync(join(srcDir, 'runtime', 'popup', 'popup.styles.css'), join(outDir, 'popup', 'popup.styles.css'));
  cpSync(join(srcDir, 'icons'), join(outDir, 'icons'), { recursive: true });
  cpSync(join(srcDir, 'icons-saved'), join(outDir, 'icons-saved'), { recursive: true });

  console.log(`Extension built to dist-extension/ (${isDev ? 'dev' : 'production'} mode)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
