<#
.SYNOPSIS
  丞相验收脚本 — 输入 commit hash，输出一行结论。省 token 核心件。
.DESCRIPTION
  自动跑：git show --stat + pytest(截尾) + node --check(前端改动) + 禁区检查。
  丞相只看最后 [裁决] 一行，不吞工具全文。
.EXAMPLE
  pwsh server/scripts/丞相验收.ps1 -Hash ab6a68a
#>
param(
  [Parameter(Mandatory=$true)][string]$Hash,
  [switch]$SkipTests  # 只对账不跑测试（纯文档卡用）
)
$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $repo

$warn = @()   # 黄：可疑，人看
$fail = @()   # 红：硬伤

# 1) commit 存在性 + 改动清单
$stat = git show $Hash --stat --format="%s" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "[裁决] ❌ FAIL: commit $Hash 不存在"; exit 1 }
$subject = ($stat | Select-Object -First 1)
$files = git show $Hash --name-only --format="" 2>&1 | Where-Object { $_ -and $_.Trim() }

# 2) 禁区/串营检查：一营碰 server 或二营碰 nantang-mobile = 黄旗人工判
$touchServer = ($files | Where-Object { $_ -like 'server/*' }).Count
$touchMobile = ($files | Where-Object { $_ -like 'nantang-mobile/*' }).Count
if ($touchServer -gt 0 -and $touchMobile -gt 0) { $warn += "跨营改动(server+mobile 同 commit)，需人工确认卡面范围" }

# 3) 前端改动 → node --check
$jsFiles = $files | Where-Object { $_ -like 'nantang-mobile/js/*.js' }
foreach ($js in $jsFiles) {
  if (Test-Path $js) {
    node --check $js 2>$null
    if ($LASTEXITCODE -ne 0) { $fail += "node --check 失败: $js" }
  }
}
# 3b) 前端改 js 必升 ?v=（缓存铁律）——仅提示，不拦
if ($jsFiles.Count -gt 0) {
  $indexTouched = ($files | Where-Object { $_ -eq 'nantang-mobile/index.html' }).Count
  if ($indexTouched -eq 0) { $warn += "改了 js 但未动 index.html，请人工确认 ?v= 是否已升" }
}

# 4) 后端改动 → pytest（截尾，只认汇总行）
$pyResult = "跳过"
if (-not $SkipTests -and $touchServer -gt 0) {
  Push-Location "$repo\server"
  $env:JWT_SECRET='test-secret-key-for-ci-32bytes-long'
  $out = & "..\.venv\Scripts\python.exe" -m pytest tests/ -q -p no:cacheprovider 2>&1
  $summary = $out | Select-String -Pattern '\d+ passed|\d+ failed|\d+ error' | Select-Object -Last 1
  Pop-Location
  $pyResult = if ($summary) { $summary.ToString().Trim() } else { "无汇总行(异常)" }
  if ($pyResult -match 'failed|error') { $fail += "pytest: $pyResult" }
}

# ── 裁决（丞相只看这几行）──
Write-Host ""
Write-Host "──────────── 丞相验收 · $Hash ────────────"
Write-Host "commit : $subject"
Write-Host "改动   : $($files.Count) 文件 (server=$touchServer, mobile=$touchMobile)"
Write-Host "pytest : $pyResult"
Write-Host "node   : $(if($jsFiles.Count){"$($jsFiles.Count) 文件已 --check"}else{'无前端改动'})"
if ($warn) { $warn | ForEach-Object { Write-Host "🟡 $_" } }
if ($fail) {
  $fail | ForEach-Object { Write-Host "🔴 $_" }
  Write-Host "[裁决] ❌ 打回：$($fail -join '; ')"
  exit 1
} else {
  $wtxt = if ($warn) { "（有 $($warn.Count) 黄旗待人工）" } else { "" }
  Write-Host "[裁决] ✅ 机检 PASS $wtxt — 仍需人工对：回执主张 vs diff、契约字段"
  exit 0
}
