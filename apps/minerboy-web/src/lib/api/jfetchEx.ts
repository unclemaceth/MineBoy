// Enhanced fetch with header logging for debugging 409s
const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mineboy-g5xo.onrender.com";

export async function jfetchEx(url: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    credentials: 'include',
    headers: { 
      'content-type': 'application/json', 
      ...(init.headers || {}), 
      'x-debug': '1' 
    },
  });
  
  const text = await res.text();
  let json: any; 
  try { 
    json = JSON.parse(text); 
  } catch { 
    json = text; 
  }
  
  const headers = Object.fromEntries(res.headers.entries());
  
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`);
    err.status = res.status; 
    err.info = json; 
    err.headers = headers;
    throw err;
  }
  
  return { json, headers };
}
