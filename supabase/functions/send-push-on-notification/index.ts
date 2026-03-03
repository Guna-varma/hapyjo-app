/**
 * Sends real-time push notifications to mobile devices when a row is inserted
 * into public.notifications. Invoke via Database Webhook (INSERT on notifications).
 * Permissions: targets users by target_role from profiles (same as RLS).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: {
    id?: string;
    target_role?: string;
    title?: string;
    body?: string;
    link_id?: string;
    link_type?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = (await req.json()) as WebhookPayload;
    if (payload.type !== "INSERT" || payload.table !== "notifications" || !payload.record) {
      return jsonResponse({ ok: true, message: "Ignored: not a notification INSERT" }, 200);
    }

    const { target_role, title, body, link_id, link_type } = payload.record;
    if (!target_role || !title || !body) {
      return jsonResponse({ ok: true, message: "Missing target_role/title/body" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server config missing" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user ids with this role (permissions from users/profiles)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", target_role)
      .eq("active", true);

    const userIds = (profiles ?? []).map((p) => p.id);
    if (userIds.length === 0) {
      return jsonResponse({ ok: true, sent: 0, message: "No users with role" }, 200);
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .in("user_id", userIds);

    const expoTokens = (tokens ?? [])
      .map((t) => t.expo_push_token)
      .filter((t): t is string => typeof t === "string" && t.startsWith("ExpoPushToken["));

    if (expoTokens.length === 0) {
      return jsonResponse({ ok: true, sent: 0, message: "No push tokens" }, 200);
    }

    const messages = expoTokens.map((to) => ({
      to,
      title: String(title),
      body: String(body),
      sound: "default" as const,
      channelId: "default",
      data: {
        linkId: link_id ?? undefined,
        linkType: link_type ?? undefined,
        notificationId: payload.record?.id,
      },
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      const text = await res.text();
      return jsonResponse(
        { error: "Expo push failed", status: res.status, detail: text },
        502
      );
    }

    const result = await res.json();
    return jsonResponse({
      ok: true,
      sent: expoTokens.length,
      expoResult: result,
    }, 200);
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});
