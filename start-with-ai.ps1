$ErrorActionPreference = 'Stop'

Write-Host 'Введите ваш OpenAI API key. Он будет использоваться только этим процессом и не сохраняется в файле.' -ForegroundColor Green
$secureKey = Read-Host 'OpenAI API key' -AsSecureString
$apiKey = [System.Net.NetworkCredential]::new('', $secureKey).Password
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw 'API key не введён.' }
$env:OPENAI_API_KEY = $apiKey
$apiKey = $null
$secureKey = $null

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $nodePath = $nodeCommand.Source
} else {
  $nodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js не найден. Установите Node.js или проверьте путь к нему.' }

Write-Host 'Запускаю MealMate на http://localhost:4173/ — окно оставьте открытым.' -ForegroundColor Green
& $nodePath (Join-Path $PSScriptRoot 'dev-server.cjs')
