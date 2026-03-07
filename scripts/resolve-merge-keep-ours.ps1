# Resolve merge conflicts by keeping OUR (current branch) version.
# Run this when you're in the middle of a merge and want to keep your changes.
# Usage: .\scripts\resolve-merge-keep-ours.ps1

$files = @(
  "components/dashboards/AssistantSupervisorDashboard.tsx",
  "components/screens/DriverTripsScreen.tsx",
  "context/MockAppStoreContext.tsx"
)

foreach ($f in $files) {
  if (Test-Path $f) {
    git checkout --ours -- $f
    git add $f
    Write-Host "Kept ours: $f"
  }
}

Write-Host "Done. Run: git status"
Write-Host "Then commit: git commit -m `"Merge: keep local changes`""
