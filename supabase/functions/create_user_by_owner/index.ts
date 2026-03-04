import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VALID_ROLES = ["admin", "owner", "head_supervisor"];
const APP_ROLES = [
  "admin",
  "owner",
  "head_supervisor",
  "accountant",
  "assistant_supervisor",
  "surveyor",
  "driver_truck",
  "driver_machine",
];

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
      return jsonResponse({ error: "Forbidden: only admin, owner, or head_supervisor can create users" }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : null;
    const roleParam = typeof body.role === "string" && APP_ROLES.includes(body.role) ? body.role : "driver_truck";
    const siteId = typeof body.site_id === "string" ? body.site_id.trim() || null : null;

    if (!email) {
      return jsonResponse({ error: "email is required" }, 400);
    }
    if (!email.endsWith("@hapyjo.com")) {
      return jsonResponse({ error: "Only @hapyjo.com internal emails are allowed" }, 400);
    }

    const temporaryPassword = generatePassword();
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { role: roleParam, name: name || email.split("@")[0], source: "hapyjo" },
    });

    if (createError) {
      return jsonResponse({ error: createError.message }, 400);
    }
    if (!newUser.user) {
      return jsonResponse({ error: "User creation failed" }, 500);
    }

    const userId = newUser.user.id;
    const displayName = name || newUser.user.email?.split("@")[0] || "User";

    const updateProfile = () =>
      adminClient.from("profiles").update({
        name: displayName,
        phone: phone ?? null,
        role: roleParam,
        active: true,
        source: "hapyjo",
      }).eq("id", userId);

    let profileError = (await updateProfile()).error;
    if (profileError) {
      await new Promise((r) => setTimeout(r, 300));
      profileError = (await updateProfile()).error;
    }
    if (profileError) {
      return jsonResponse({ error: "Profile update failed: " + profileError.message }, 500);
    }

    if (siteId) {
      const { data: siteExists } = await adminClient.from("sites").select("id").eq("id", siteId).maybeSingle();
      if (!siteExists) {
        return jsonResponse({ error: "Site not found: " + siteId }, 400);
      }
      const { error: assignError } = await adminClient.from("site_assignments").upsert(
        { site_id: siteId, user_id: userId, role: roleParam, vehicle_ids: [] },
        { onConflict: "site_id,user_id" }
      );
      if (assignError) {
        return jsonResponse({ error: "Site assignment failed: " + assignError.message }, 500);
      }
    }

    return jsonResponse({
      user_id: userId,
      email: newUser.user.email,
      temporary_password: temporaryPassword,
      message: "User created. Share the temporary password with the user; they can sign in with email and this password and change it in Settings.",
    }, 200);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
