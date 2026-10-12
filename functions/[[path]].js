export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 非 GET 直接放行
  if (request.method !== 'GET') {
    return next();
  }

  // API 请求直接放行，交给具体的 API Function 处理
  if (path.startsWith('/api/')) {
    return next();
  }

  // 纯静态资源（带扩展名的文件）直接放行
  const lastSegment = path.split('/').pop() || '';
  if (lastSegment.includes('.')) {
    return next();
  }

  // 根路径也直接放行（由 Pages 静态服务返回 index.html）
  if (path === '/' || path === '') {
    return next();
  }

  // 判断是否接受 HTML（浏览器导航请求会带 text/html）
  const accept = request.headers.get('accept') || '';
  if (!accept.includes('text/html') && !accept.includes('*/*')) {
    return next();
  }

  // SPA 路由兜底：返回 index.html
  try {
    const res = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString(), {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
      },
    }));

    if (!res.ok) {
      return next();
    }

    const html = await res.text();
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    // 兜底失败时降级到 next()
    return next();
  }
}
