import path from 'path';
import { defineConfig } from '@lark-apaas/coding-preset-vite-react';
import type { PluginOption } from 'vite';

function cloudflarePagesFix(): PluginOption {
  return {
    name: 'cloudflare-pages-fix',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/window\.__BASENAME__\s*=\s*"{{basename}}"/g, 'window.__BASENAME__ = "/"')
        .replace(/window\.appId\s*=\s*"{{appId}}"/g, 'window.appId = ""')
        .replace(/window\.userId\s*=\s*"{{userId}}"/g, 'window.userId = ""')
        .replace(/window\.tenantId\s*=\s*"{{tenantId}}"/g, 'window.tenantId = ""')
        .replace(/window\.userName\s*=\s*"{{userName}}"/g, 'window.userName = ""')
        .replace(/window\.csrfToken\s*=\s*"{{csrfToken}}"/g, 'window.csrfToken = ""')
        .replace(/window\.ENVIRONMENT\s*=\s*"{{environment}}"/g, 'window.ENVIRONMENT = "production"')
        .replace(/name:\s*"{{appName}}"/g, 'name: ""')
        .replace(/avatar:\s*"{{{appAvatar}}}"/g, 'avatar: ""')
        .replace(/description:\s*"{{appDescription}}"/g, 'description: ""');
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
    },
  },
  plugins: [cloudflarePagesFix()],
});
