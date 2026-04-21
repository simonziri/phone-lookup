export const runtime = "edge";

import phones from "../../../data/phones.json";

const ALLOWED_ORIGINS = [
  "https://www.tarro.com",
  "https://tarro.com",
  "https://tarr-001.webflow.io",
];

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "X-Phone-Token, Content-Type",
  };
}

function parseParams(paramString: string) {
  const result: Record<string, string> = {};
  if (!paramString) return result;
  paramString.split(",").forEach((pair) => {
    const [keyRaw, valRaw] = pair.split("=");
    if (keyRaw && valRaw) result[keyRaw.trim()] = valRaw.trim();
  });
  return result;
}

function findBestMatch(utmObj: Record<string, string>, entries: any[]) {
  let best = null;
  let bestScore = 0;
  entries.forEach((entry) => {
    if (entry.hide === true) return;
    const params = parseParams(entry.parameters);
    const keys = Object.keys(params);
    if (!keys.length) return;
    let allMatch = true;
    keys.forEach((k) => {
      const want = params[k].toLowerCase();
      const have = (utmObj[k] || "").toString().toLowerCase();
      if (!have.includes(want)) allMatch = false;
    });
    if (allMatch && keys.length > bestScore) {
      bestScore = keys.length;
      best = entry;
    }
  });
  return best;
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("Origin") || ALLOWED_ORIGINS[0];
  const allowed = ALLOWED_ORIGINS.find((o) => origin.startsWith(o)) ?? ALLOWED_ORIGINS[0];
  return new Response(null, { status: 204, headers: corsHeaders(allowed) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("Origin") || "";
  const referer = request.headers.get("Referer") || "";
  const allowed = ALLOWED_ORIGINS.find((o) => origin.startsWith(o)) ?? ALLOWED_ORIGINS[0];
  const headers = corsHeaders(allowed);

  const token = request.headers.get("X-Phone-Token");
  if (!token || token !== process.env.PHONE_TOKEN) {
    return new Response("Forbidden", { status: 403, headers });
  }

  const originOk =
    ALLOWED_ORIGINS.some((o) => origin.startsWith(o)) ||
    ALLOWED_ORIGINS.some((o) => referer.startsWith(o));
  if (!originOk) {
    return new Response("Forbidden", { status: 403, headers });
  }

  let utmObj: Record<string, string>;
  try {
    utmObj = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400, headers });
  }

  const match = findBestMatch(utmObj, phones as any[]);

  return Response.json(
    { number: match ? (match as any).number : null },
    { headers: { "Cache-Control": "no-store", ...headers } }
  );
}
