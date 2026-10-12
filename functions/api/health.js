export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    const result = {
      status: 'ok',
      time: new Date().toISOString(),
      db: false,
    };

    try {
      if (env.DB) {
        const row = await env.DB.prepare('SELECT 1 as ok').first();
        result.db = row && row.ok === 1;
      }
    } catch (err) {
      result.db = false;
      result.dbError = String(err.message || err);
    }

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return new Response(JSON.stringify({ message: 'Not Found' }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
