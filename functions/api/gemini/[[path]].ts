/**
 * Gemini API Proxy - 將前端的 Gemini API 請求轉發到 Google，API Key 僅存在於後端
 * GEMINI_API_KEY 需在 Cloudflare Dashboard 的 Secrets 中設定
 */

interface Env {
  GEMINI_API_KEY: string;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

export const onRequest: PagesFunction<Env> = async (context) => {
  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY is not configured. Please add it in Cloudflare Dashboard > Settings > Bindings > Secrets.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const pathParam = context.params.path as string | string[];
  const path = Array.isArray(pathParam) ? pathParam.join('/') : pathParam || '';
  const url = new URL(context.request.url);
  const queryString = url.searchParams.toString();

  const targetUrl = `${GEMINI_BASE}/${path}${queryString ? `?${queryString}&` : '?'}key=${apiKey}`;

  // 只允許對 Gemini API 的請求
  if (!path.startsWith('v1') && !path.startsWith('v1beta')) {
    return new Response(JSON.stringify({ error: 'Invalid Gemini API path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const headers = new Headers(context.request.headers);
    headers.delete('Authorization');
    headers.delete('Cookie');
    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');

    const res = await fetch(targetUrl, {
      method: context.request.method,
      headers,
      body: context.request.method !== 'GET' && context.request.method !== 'HEAD' ? context.request.body : undefined,
    });

    const responseHeaders = new Headers(res.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type');

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('Gemini proxy error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to proxy request to Gemini API' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 處理 CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
};
