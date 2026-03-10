const { build } = require('esbuild');
const { cpSync, mkdirSync } = require('node:fs');
const { join, dirname } = require('node:path');

const coreDir = dirname(require.resolve('browser-extension-core/package.json'));

const srcDir = join(__dirname, '..', 'src');
const outDir = join(__dirname, '..', 'dist-extension-compiled');

const serverUrl = process.env.HUTCH_SERVER_URL;
if (!serverUrl) {
  console.error('Error: HUTCH_SERVER_URL environment variable is required.\nSet it before building (e.g. HUTCH_SERVER_URL=https://hutch-app.com)');
  process.exit(1);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'popup'), { recursive: true });
  mkdirSync(join(outDir, 'background'), { recursive: true });
  mkdirSync(join(outDir, 'content'), { recursive: true });
  mkdirSync(join(outDir, 'icons'), { recursive: true });
  mkdirSync(join(outDir, 'icons-saved'), { recursive: true });

  await build({
    entryPoints: [
      join(srcDir, 'runtime', 'background', 'background.ts'),
      join(srcDir, 'runtime', 'popup', 'popup.ts'),
      join(srcDir, 'runtime', 'content', 'shortcut.ts'),
    ],
    bundle: true,
    format: 'iife',
    outdir: outDir,
    outbase: join(srcDir, 'runtime'),
    target: 'firefox91',
    alias: {
      'browser-extension-core': join(coreDir, 'src', 'index.ts'),
    },
    define: {
      '__SERVER_URL__': JSON.stringify(serverUrl),
    },
  });

  cpSync(join(srcDir, 'runtime', 'manifest.json'), join(outDir, 'manifest.json'));
  cpSync(join(srcDir, 'runtime', 'popup', 'popup.template.html'), join(outDir, 'popup', 'popup.template.html'));
  cpSync(join(srcDir, 'runtime', 'popup', 'popup.styles.css'), join(outDir, 'popup', 'popup.styles.css'));
  cpSync(join(srcDir, 'icons'), join(outDir, 'icons'), { recursive: true });
  cpSync(join(srcDir, 'icons-saved'), join(outDir, 'icons-saved'), { recursive: true });

  console.log('Extension built to dist-extension-compiled/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
