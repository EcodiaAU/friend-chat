// Test runner. Bundles the TSX test with esbuild (already a devDependency, so the
// suite adds no new package) and runs it on node. `npm test` is the gate; there is
// no test framework and no watcher, by design: the widget ships to four apps and the
// suite has to be runnable from a cold clone with nothing but `npm i`.
import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(here, '.tmp');

const entries = ['renderReply.test.tsx'];

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

for (const entry of entries) {
  const outfile = resolve(outdir, entry.replace(/\.tsx?$/, '.mjs'));
  await build({
    entryPoints: [resolve(here, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    jsx: 'automatic',
    // react + react-dom resolve from node_modules at run time; bundling them in
    // would drag CJS interop into the output for no gain.
    external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/server'],
    logLevel: 'warning',
  });
  await import(pathToFileURL(outfile).href);
}
