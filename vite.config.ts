import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Security Shield Plugin:
 * Intercepts and blocks any direct HTTP attempts to access sensitive files
 * (such as license keys, sql schemas, .env files, markdown docs, python engine files, etc.)
 */
function securityShieldPlugin(): Plugin {
  return {
    name: 'security-shield',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = (req.url || '').split('?')[0].toLowerCase();

        // Sensitive extensions that must never be served over HTTP
        const blockedExtensions = [
          '.txt',
          '.sql',
          '.env',
          '.md',
          '.py',
          '.csv',
          '.log',
          '.key',
          '.pem',
          '.cert',
          '.sh',
          '.bat',
          '.yml',
          '.yaml',
        ];

        const isSensitiveFile =
          blockedExtensions.some((ext) => rawUrl.endsWith(ext)) ||
          rawUrl.includes('/supabase/') ||
          rawUrl.includes('/local-engine/') ||
          rawUrl.includes('license_key') ||
          rawUrl.includes('recharge_code') ||
          rawUrl === '/package.json' ||
          rawUrl === '/package-lock.json' ||
          rawUrl === '/tsconfig.json' ||
          rawUrl === '/tsconfig.app.json' ||
          rawUrl === '/tsconfig.node.json';

        if (isSensitiveFile) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'text/plain');
          res.end('403 Forbidden: Direct access to this file is strictly denied.');
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    securityShieldPlugin(),
  ],
  server: {
    fs: {
      deny: [
        '**/LICENSE_KEYS*',
        '**/*.txt',
        '**/*.sql',
        '**/*.md',
        '**/.env*',
        '**/supabase/**',
        '**/local-engine/**',
        '**/*.csv',
        '**/package.json',
        '**/package-lock.json',
      ],
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
});
