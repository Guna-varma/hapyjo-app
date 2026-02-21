# Run from project root. Requires Supabase CLI: npm i -g supabase
# Link once: supabase link --project-ref YOUR_PROJECT_REF
# SUPABASE_SERVICE_ROLE_KEY is provided automatically in production; do not set via CLI.

$ErrorActionPreference = "Stop"
$projectRef = "dobfzbdwyimicxzcssiw"

Write-Host "Linking project (if not already linked)..." -ForegroundColor Cyan
supabase link --project-ref $projectRef 2>$null; if (-not $?) { Write-Host "Link may already exist. Continuing." }

Write-Host "Pushing database migrations..." -ForegroundColor Cyan
supabase db push
if (-not $?) { exit 1 }

Write-Host "Deploying Edge Functions..." -ForegroundColor Cyan
supabase functions deploy create_user_by_owner --no-verify-jwt
supabase functions deploy reset_user_password --no-verify-jwt
if (-not $?) { exit 1 }

Write-Host "Done." -ForegroundColor Green
Write-Host "SUPABASE_SERVICE_ROLE_KEY is auto-injected in production (do not set via CLI)." -ForegroundColor Gray
Write-Host "Create first login: node scripts/seed-auth-users.js  (admin@hapyjo.com / HapyjoAdmin2025!)" -ForegroundColor Yellow
Write-Host "If gps-images bucket is missing, create it in Dashboard > Storage > New bucket (public, name: gps-images)." -ForegroundColor Yellow
