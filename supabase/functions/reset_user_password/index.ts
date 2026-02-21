import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VALID_ROLES = ["admin", "owner", "head_supervisor"];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: object, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...headers },
  });
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let s = "";
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: profile } = await anonClient.from("profiles").select("role").eq("id", caller.id).single();
    const role = profile?.role as string | undefined;
    if (!role || !VALID_ROLES.includes(role)) {
      return jsonResponse({ error: "Forbidden: only admin, owner, or head_supervisor can reset passwords" }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    if (!userId) {
      return jsonResponse({ error: "user_id is required" }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profileRow } = await adminClient.from("profiles").select("email").eq("id", userId).single();
    const email = (profileRow as { email?: string } | null)?.email ?? null;

    const temporaryPassword = generatePassword();
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, { password: temporaryPassword });

    if (updateError) {
      return jsonResponse({ error: "Password reset failed: " + updateError.message }, 400);
    }

    return jsonResponse({
      email: email ?? undefined,
      temporary_password: temporaryPassword,
      message: "Password reset. Share the new temporary password with the user.",
    }, 200);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
