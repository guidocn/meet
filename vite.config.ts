import path from 'path';
import { defineConfig } from '@lark-apaas/coding-preset-vite-react';
import type { PluginOption } from 'vite';

const isCloudflarePages = process.env.BUILD_TARGET === 'cloudflare';

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
        .replace(/<title>[^<]*{{appName}}[^<]*<\/title>/g, '<title>党支部义务电脑维修队</title>')
        .replace(/content="{{appName}}"/g, 'content="党支部义务电脑维修队"')
        .replace(/content="{{appDescription}}"/g, 'content=""')
        .replace(/content="{{appAvatar}}"/g, 'content=""')
        .replace(/href="{{appAvatar}}"/g, 'href="/favicon.svg"')
        .replace(/src="{{{appAvatar}}}"/g, 'src="/favicon.svg"')
        .replace(/src="{{appAvatar}}"/g, 'src="/favicon.svg"')
        .replace(/name:\s*"{{appName}}"/g, 'name: "招新面试叫号系统"')
        .replace(/avatar:\s*"{{{appAvatar}}}"/g, 'avatar: ""')
        .replace(/description:\s*"{{appDescription}}"/g, 'description: ""');
    },
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue;
        if (!file.code.includes('__BASENAME__')) continue;
        const original = file.code;
        file.code = file.code.replace(
          /typeof window[^&]*&&window\.__BASENAME__\s*\|\|\s*`[^`]*`/g,
          '"/"'
        );
        if (file.code !== original) {
          console.log(
            `[cloudflare-pages-fix] Fixed __BASENAME__ in ${file.fileName}`
          );
        }
      }
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
  base: isCloudflarePages ? '/' : undefined,
  build: {
    sourcemap: false, // 生产环境关闭sourcemap，大幅减少文件大小
  },
});
