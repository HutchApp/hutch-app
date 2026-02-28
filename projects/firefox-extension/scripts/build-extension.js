const { build } = require('esbuild');
const { cpSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const srcDir = join(__dirname, '..', 'src');
const outDir = join(__dirname, '..', 'dist-extension');

async function main() {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'popup'), { recursive: true });
  mkdirSync(join(outDir, 'background'), { recursive: true });
  mkdirSync(join(outDir, 'icons'), { recursive: true });

  await build({
    entryPoints: [
      join(srcDir, 'background', 'background.ts'),
      join(srcDir, 'popup', 'popup.ts'),
    ],
    bundle: true,
    format: 'iife',
    outdir: outDir,
    outbase: srcDir,
    target: 'firefox91',
  });

  cpSync(join(srcDir, 'manifest.json'), join(outDir, 'manifest.json'));
  cpSync(join(srcDir, 'popup', 'popup.template.html'), join(outDir, 'popup', 'popup.template.html'));
  cpSync(join(srcDir, 'popup', 'popup.styles.css'), join(outDir, 'popup', 'popup.styles.css'));
  cpSync(join(srcDir, 'icons'), join(outDir, 'icons'), { recursive: true });

  console.log('Extension built to dist-extension/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
