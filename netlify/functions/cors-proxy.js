// Amarillo ATS — CORS Proxy Function
// Fetches external URLs server-side to bypass CORS restrictions.
// Used by Signal Engine for scraping corporate sites and Google News.

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const url = event.queryStringParameters?.url;
  if (!url) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing url parameter' }) };
  }

  // Basic validation
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid protocol' }) };
    }
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL' }) };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AmarilloATS/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
      },
      redirect: 'follow',
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || 'text/html';
    const body = await response.text();

    // Limit response size to 500KB
    const truncated = body.length > 500000 ? body.substring(0, 500000) : body;

    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': contentType,
        'X-Proxy-Status': String(response.status),
      },
      body: truncated,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Fetch failed: ' + (e.message || 'timeout') }),
    };
  }
};
