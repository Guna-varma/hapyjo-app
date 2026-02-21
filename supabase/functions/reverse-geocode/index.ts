/**
 * Proxy for Nominatim reverse geocoding. Used by the web app to avoid CORS
 * (browsers block direct requests to nominatim.openstreetmap.org).
 * No auth required; anon key is enough.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "HapyJo/1.0 (GPS Camera; contact@hapyjo.com)";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function jsonResponse(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let lat: number;
  let lon: number;

  if (req.method === "GET") {
    const url = new URL(req.url);
    const latParam = url.searchParams.get("lat");
    const lonParam = url.searchParams.get("lon");
    if (latParam == null || lonParam == null) {
      return jsonResponse({ error: "Missing lat or lon query params" }, 400);
    }
    lat = parseFloat(latParam);
    lon = parseFloat(lonParam);
  } else {
    const body = await req.json().catch(() => ({}));
    const latParam = body.lat ?? body.latitude;
    const lonParam = body.lon ?? body.longitude;
    if (typeof latParam !== "number" || typeof lonParam !== "number") {
      return jsonResponse({ error: "Body must include lat and lon numbers" }, 400);
    }
    lat = latParam;
    lon = lonParam;
  }

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return jsonResponse({ error: "Invalid lat or lon" }, 400);
  }

  try {
    const url = `${NOMINATIM_BASE}?format=json&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return jsonResponse(
        { error: `Nominatim ${res.status}: ${res.statusText}` },
        res.status === 429 ? 429 : 502
      );
    }

    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        country?: string;
        postcode?: string;
      };
    };

    const addr = data.address ?? {};
    const city = addr.city ?? addr.town ?? addr.village;
    return jsonResponse(
      {
        display_name: data.display_name ?? `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
        city,
        state: addr.state,
        country: addr.country,
        postcode: addr.postcode,
      },
      200
    );
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Reverse geocode failed" },
      502
    );
  }
});
