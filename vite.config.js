import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Writes dist/sw.js with the exact list of built files baked in, so the whole
 * app is cached on the very first visit and opens with no network afterwards.
 * The cache name is a hash of the contents: any new build replaces the old cache.
 */
function serviceWorker() {
  return {
    name: 'life-os-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const hash = createHash('sha256');
      const urls = new Set(['./', './index.html']);

      for (const [fileName, item] of Object.entries(bundle)) {
        if (fileName.endsWith('.map')) continue;
        urls.add(`./${fileName}`);
        hash.update(fileName).update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const fileName of readdirSync('public').sort()) {
        urls.add(`./${fileName}`);
        hash.update(fileName).update(readFileSync(`public/${fileName}`));
      }

      const source = readFileSync('src/sw.template.js', 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify([...urls].sort(), null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so the build works at a domain root or in a sub-folder.
  base: './',
  plugins: [react(), tailwindcss(), serviceWorker()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  test: { environment: 'node', include: ['src/**/*.test.js'] },
});
