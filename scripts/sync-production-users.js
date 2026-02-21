/**
 * Sync 8 Production RBAC users: set passwords in Auth and role/name in public.profiles.
 * Run: node scripts/sync-production-users.js
 * Requires .env: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Users (already in Auth from Dashboard): passwords and profiles are updated to match below.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    });
  }
}

loadEnv();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const PRODUCTION_USERS = [
  { email: 'admin@hapyjo.com', password: 'Admin@123', role: 'admin', name: 'Admin' },
  { email: 'owner@hapyjo.com', password: 'HpY!Ow9#R4vT2K', role: 'owner', name: 'Owner' },
  { email: 'accountant@hapyjo.com', password: 'Hj$Ac7@L5pQ9X', role: 'accountant', name: 'Accountant' },
  { email: 'headsupervisor@hapyjo.com', password: 'Hs#Hd8!V3mW6P', role: 'head_supervisor', name: 'Head Supervisor' },
  { email: 'asstsupervisor@hapyjo.com', password: 'Ha!As5#T7pL2Z', role: 'assistant_supervisor', name: 'Assistant Supervisor' },
  { email: 'surveyor@hapyjo.com', password: 'Hy$Sv4@Q9kN1M', role: 'surveyor', name: 'Surveyor' },
  { email: 'drivertruck@hapyjo.com', password: 'Ht!Dt6#X2bC8F', role: 'driver_truck', name: 'Driver Truck' },
  { email: 'drivermachine@hapyjo.com', password: 'Hm@Dm3!P9sR5Y', role: 'driver_machine', name: 'Driver Machine' },
];

async function main() {
  const results = [];
  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const authUsers = listData?.users || [];

  for (const spec of PRODUCTION_USERS) {
    const emailLower = spec.email.toLowerCase();
    const existing = authUsers.find((u) => u.email && u.email.toLowerCase() === emailLower);

    if (existing) {
      const { error: pwErr } = await supabase.auth.admin.updateUserById(existing.id, { password: spec.password });
      if (pwErr) {
        console.error(`[${spec.email}] Password update failed:`, pwErr.message);
        results.push({ email: spec.email, password: spec.password, role: spec.role, status: 'password_failed' });
        continue;
      }
      const { error: profileErr } = await supabase.from('profiles').upsert(
        { id: existing.id, email: spec.email, name: spec.name, role: spec.role, active: true },
        { onConflict: 'id' }
      );
      if (profileErr) {
        console.error(`[${spec.email}] Profile upsert failed:`, profileErr.message);
        results.push({ email: spec.email, password: spec.password, role: spec.role, status: 'profile_failed' });
        continue;
      }
      results.push({ email: spec.email, password: spec.password, role: spec.role, status: 'ok' });
      console.log(`OK: ${spec.email} -> role=${spec.role}, password set, profile updated`);
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: spec.email,
        password: spec.password,
        email_confirm: true,
        user_metadata: { role: spec.role, name: spec.name },
      });
      if (createErr) {
        console.error(`[${spec.email}] Create failed:`, createErr.message);
        results.push({ email: spec.email, password: spec.password, role: spec.role, status: 'create_failed' });
        continue;
      }
      const userId = created.user?.id;
      if (userId) {
        await supabase.from('profiles').upsert(
          { id: userId, email: spec.email, name: spec.name, role: spec.role, active: true },
          { onConflict: 'id' }
        );
        results.push({ email: spec.email, password: spec.password, role: spec.role, status: 'created' });
        console.log(`Created: ${spec.email} -> role=${spec.role}`);
      }
    }
  }

  console.log('\n========== PRODUCTION RBAC USERS (login with these) ==========\n');
  console.log('Email\t\t\t\t\tPassword\t\t\tRole');
  console.log('----\t\t\t\t\t--------\t\t\t----');
  results.forEach((r) => {
    console.log(`${r.email}\t\t${r.password}\t\t${r.role}\t${r.status !== 'ok' && r.status !== 'created' ? ' [' + r.status + ']' : ''}`);
  });
  console.log('\n==============================================================\n');
  console.log('Log in to the app with each account to verify RBAC and flows.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
