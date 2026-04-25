import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Vite plugin that fixes two LDraw file-serving problems:
 *
 * PROBLEM 1 — Double-prefix sub-part paths
 *   LDraw part files (e.g. 3001.dat) reference sub-parts with absolute-ish
 *   paths like "PARTS\S\3001s01.dat". LDrawLoader normalises this to
 *   "parts/s/3001s01.dat" and then prepends its own subdir ("parts/"),
 *   producing "/ldraw/parts/parts/s/3001s01.dat". The file is actually at
 *   "/ldraw/parts/s/3001s01.dat".
 *   Fix: rewrite /ldraw/{subA}/{subB}/... → /ldraw/{subB}/... when subA
 *   and subB are both known LDraw subdirs (parts, p, models).
 *
 * PROBLEM 2 — SPA fallback serves index.html for missing .dat files
 *   Vite returns 200 + index.html for any unmatched request. LDrawLoader
 *   receives <!DOCTYPE and crashes with "Unknown line type '<!DOCTYPE'".
 *   Fix: after any path rewriting, if the file still doesn't exist, return
 *   a real 404 so LDrawLoader can fall through to the next candidate path.
 *
 * configureServer (without `return`) adds middleware BEFORE Vite's own
 * static-file handler and SPA fallback.
 */
function ldrawDatPlugin() {
  const SUBDIRS = ['parts', 'p', 'models'];

  return {
    name: 'ldraw-dat',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !/\.dat(\?.*)?$/i.test(req.url)) return next();

        let urlPath = decodeURIComponent(req.url.split('?')[0]);
        const lower = urlPath.toLowerCase();
        const base = '/ldraw/';

        if (lower.startsWith(base)) {
          const afterBase = lower.slice(base.length);   // e.g. "parts/parts/s/3001s01.dat"
          const origAfterBase = urlPath.slice(base.length);

          for (const s1 of SUBDIRS) {
            if (afterBase.startsWith(s1 + '/')) {
              const afterS1lower = afterBase.slice(s1.length + 1);  // e.g. "parts/s/3001s01.dat"
              const origAfterS1 = origAfterBase.slice(s1.length + 1);

              for (const s2 of SUBDIRS) {
                if (afterS1lower.startsWith(s2 + '/')) {
                  // Double-prefix: rewrite /ldraw/{s1}/{s2}/... → /ldraw/{s2}/...
                  urlPath = base + origAfterS1;
                  req.url = urlPath;
                  break;
                }
              }
              break;
            }
          }
        }

        // Check whether the (possibly rewritten) path exists in public/.
        const publicDir = join(__dirname, 'public');
        const filePath = join(publicDir, urlPath.split('?')[0]);

        if (!existsSync(filePath)) {
          // LDrawLoader tries subdirs in order (parts → p → models). If the
          // requested subdir doesn't have the file but another one does, silently
          // rewrite to the correct subdir so the browser never sees a 404.
          const lower2 = urlPath.toLowerCase();
          if (lower2.startsWith('/ldraw/')) {
            const afterBase2 = urlPath.slice('/ldraw/'.length); // e.g. "parts/stud4.dat"
            for (const s1 of SUBDIRS) {
              if (afterBase2.toLowerCase().startsWith(s1 + '/')) {
                const filename = afterBase2.slice(s1.length + 1); // e.g. "stud4.dat"
                for (const s2 of SUBDIRS) {
                  if (s2 === s1) continue;
                  const alt = join(publicDir, 'ldraw', s2, filename);
                  if (existsSync(alt)) {
                    // Redirect internally — rewrite URL so Vite serves it
                    req.url = '/ldraw/' + s2 + '/' + filename;
                    return next();
                  }
                }
                break;
              }
            }
          }
          // Truly not found anywhere — return 404 so LDrawLoader stops trying
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end('LDraw part not found');
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), ldrawDatPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
