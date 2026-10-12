export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 非 GET 直接放行
  if (request.method !== 'GET') {
    return next();
  }

  // API 请求直接放行，交给对应 API Function 处理
  if (path.startsWith('/api/')) {
    return next();
  }

  // 带文件扩展名的静态资源直接放行
  const lastSegment = path.split('/').pop() || '';
  if (lastSegment.includes('.')) {
    return next();
  }

  // 其余所有路径（包括 /、/console、/login、/signin、/interview、/results 等）
  // 统一返回 index.html，由前端路由接管
  try {
    const indexUrl = new URL('/index.html', request.url).toString();
    const res = await env.ASSETS.fetch(indexUrl);

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
    return next();
  }
}
