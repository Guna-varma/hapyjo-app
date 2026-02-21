/**
 * Seed auth users for production: create Owner@hapyjo.rw and set random passwords for all.
 * Run: node scripts/seed-auth-users.js
 * Requires .env: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Output: list of email + password for login testing.
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

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let s = '';
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

loadEnv();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const OWNER_EMAIL = 'Owner@hapyjo.rw';
const ADMIN_EMAIL = 'admin@hapyjo.com';
const ADMIN_DEFAULT_PASSWORD = 'HapyjoAdmin2025!';

async function main() {
  const credentials = [];

  // 1) Ensure admin@hapyjo.com exists (fixed password for first login)
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const adminUser = existingUsers?.users?.find((u) => u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  let adminId = adminUser?.id;

  if (!adminId) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'owner', name: 'Admin' },
    });
    if (error) {
      console.error('Create admin@hapyjo.com failed:', error.message);
    } else {
      adminId = created.user?.id;
      credentials.push({ email: ADMIN_EMAIL, password: ADMIN_DEFAULT_PASSWORD, role: 'owner' });
      console.log('Created admin@hapyjo.com (use this to log in and create more users)');
    }
  } else {
    const { error: pwErr } = await supabase.auth.admin.updateUserById(adminId, { password: ADMIN_DEFAULT_PASSWORD });
    if (!pwErr) {
      credentials.push({ email: ADMIN_EMAIL, password: ADMIN_DEFAULT_PASSWORD, role: 'owner' });
      console.log('admin@hapyjo.com already exists. Password reset to default.');
    }
  }
  if (adminId) {
    await supabase.from('profiles').update({ role: 'owner', name: 'Admin', active: true }).eq('id', adminId);
  }

  // 2) Ensure Owner@hapyjo.rw exists (optional)
  const ownerUser = existingUsers?.users?.find((u) => u.email && u.email.toLowerCase() === OWNER_EMAIL.toLowerCase());
  let ownerId = ownerUser?.id;
  if (!ownerId) {
    const pw = randomPassword();
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: pw,
      email_confirm: true,
      user_metadata: { role: 'owner', name: 'Owner' },
    });
    if (!error && created?.user?.id) {
      ownerId = created.user.id;
      credentials.push({ email: OWNER_EMAIL, password: pw, role: 'owner' });
      console.log('Created Owner@hapyjo.rw');
    }
  }
  if (ownerId) {
    await supabase.from('profiles').update({ role: 'owner', name: 'Owner', active: true }).eq('id', ownerId);
  }

  // 3) List all auth users and set random passwords (so we can give you a list)
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const users = list?.users || [];

  for (const u of users) {
    if (!u.email) continue;
    const already = credentials.find((c) => c.email.toLowerCase() === u.email.toLowerCase());
    if (already) continue;
    const pw = randomPassword();
    const { error } = await supabase.auth.admin.updateUserById(u.id, { password: pw });
    if (error) {
      console.error('Update password failed for', u.email, error.message);
      continue;
    }
    const profile = await supabase.from('profiles').select('role').eq('id', u.id).single();
    credentials.push({
      email: u.email,
      password: pw,
      role: profile.data?.role || '—',
    });
  }

  // 4) Print credentials
  console.log('\n========== LOGIN CREDENTIALS (save securely) ==========\n');
  console.log('Email\t\t\t\tPassword\t\tRole');
  console.log('----\t\t\t\t--------\t\t----');
  credentials.forEach((c) => {
    console.log(`${c.email}\t\t${c.password}\t${c.role}`);
  });
  console.log('\n========================================================\n');
  console.log('Use these to log in at the app. Update .env with EXPO_PUBLIC_SUPABASE_URL and anon key for the app.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
