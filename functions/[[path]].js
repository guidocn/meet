// Cloudflare Pages SPA 兜底：所有非 API 非静态资源的 GET 请求返回 index.html
// 已同时配置 _redirects 作为静态兜底，本函数作为第二重保险

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache',
};

// 从 ASSETS 绑定读取 index.html（Cloudflare Pages 标准方式）
async function tryReadFromAssets(env, request) {
  if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== 'function') return null;
  try {
    const indexUrl = new URL('/index.html', request.url).toString();
    const res = await env.ASSETS.fetch(indexUrl);
    if (!res || !res.ok) return null;
    const html = await res.text();
    if (!html || html.length === 0) return null;
    return html;
  } catch (err) {
    return null;
  }
}

// 兜底：直接构造最小可运行的 HTML 骨架
// 即使 ASSETS 绑定异常也能让页面渲染，不会白屏/404
function buildMinimalIndexHtml() {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>招新面试叫号系统</title>
  <link rel="icon" href="/favicon.svg" />
  <script>window.__platform__ = {}; window.__BASENAME__ = "/";</script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/index.js"></script>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env, next } = context;

  // 只处理 GET
  if (request.method !== 'GET') return next();

  const url = new URL(request.url);
  const path = url.pathname;

  // API 直接放行
  if (path.startsWith('/api/')) return next();

  // 带扩展名的静态资源直接放行
  const lastSegment = path.split('/').pop() || '';
  if (lastSegment.includes('.')) return next();

  // 其余所有路径（/、/console、/login 等）都返回 index.html
  const html = await tryReadFromAssets(env, request);

  if (html) {
    return new Response(html, { status: 200, headers: HTML_HEADERS });
  }

  // ASSETS 读取失败时返回最小骨架（极端降级，避免404）
  return new Response(buildMinimalIndexHtml(), {
    status: 200,
    headers: HTML_HEADERS,
  });
}
