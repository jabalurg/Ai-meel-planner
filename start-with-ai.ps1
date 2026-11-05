$ErrorActionPreference = 'Stop'

Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
Write-Host 'Enter your Gemini API key for AI menus, or press Enter to use the free local planner.' -ForegroundColor Green
$secureKey = Read-Host 'Gemini API key' -AsSecureString
$apiKey = [System.Net.NetworkCredential]::new('', $secureKey).Password
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
  Write-Host 'Starting without an API key. Meal plans will use local recipes.' -ForegroundColor Yellow
} else {
  $env:GEMINI_API_KEY = $apiKey
}
$apiKey = $null
$secureKey = $null

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $nodePath = $nodeCommand.Source
} else {
  $nodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js was not found. Install it or check the configured path.' }

Write-Host 'Starting MealMate at http://localhost:4173/ - keep this window open.' -ForegroundColor Green
& $nodePath (Join-Path $PSScriptRoot 'dev-server.cjs')
