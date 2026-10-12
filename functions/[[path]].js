const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache',
};

async function readIndexHtml(context) {
  const { request, env } = context;
  const indexUrl = new URL('/index.html', request.url).toString();

  const assets = env ? env.ASSETS : undefined;
  if (assets && typeof assets.fetch === 'function') {
    try {
      const res = await assets.fetch(indexUrl);
      if (res && res.ok) {
        const html = await res.text();
        if (html && html.length > 0) return html;
      }
    } catch (err) {
      // 继续尝试下一种读取方式
    }
  }

  try {
    const res = await fetch(indexUrl, { headers: { Accept: 'text/html' } });
    if (res && res.ok) {
      const html = await res.text();
      if (html && html.length > 0) return html;
    }
  } catch (err) {
    // 读取失败，交由调用方降级
  }

  return null;
}

export async function onRequest(context) {
  const { request, next } = context;

  if (request.method !== 'GET') {
    return next();
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (path.startsWith('/api/')) {
    return next();
  }

  const lastSegment = path.split('/').pop() || '';
  if (lastSegment.includes('.')) {
    return next();
  }

  const html = await readIndexHtml(context);
  if (!html) {
    return next();
  }

  return new Response(html, { status: 200, headers: HTML_HEADERS });
}