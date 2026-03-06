param(
  [string]$Remote = "origin",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

Write-Host "[sync] Repo: $(Get-Location)"
Write-Host "[sync] Target: $Remote/$Branch"

try {
  Write-Host "[sync] Step 1/4: fetch --all --prune"
  git fetch --all --prune

  Write-Host "[sync] Step 2/4: pull --ff-only $Remote $Branch"
  git pull --ff-only $Remote $Branch

  Write-Host "[sync] Step 3/4: push $Remote $Branch"
  git push $Remote $Branch

  Write-Host "[sync] Step 4/4: status"
  git status --short --branch

  Write-Host "[sync] Done. Local, GitHub, and Lovable-linked repo should now be in sync."
}
catch {
  Write-Error "[sync] Failed: $($_.Exception.Message)"
  exit 1
}
