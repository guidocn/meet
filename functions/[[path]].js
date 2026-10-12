export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method !== 'GET') {
    return next();
  }

  if (path.startsWith('/api/')) {
    return next();
  }

  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html') || !path.includes('.')) {
    const asset = await env.ASSETS.fetch(new URL('/index.html', request.url).toString());
    return new Response(asset.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  }

  return next();
}
