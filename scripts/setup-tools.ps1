$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$binDirectory = Join-Path $projectRoot 'resources/bin'
$cacheDirectory = Join-Path $projectRoot '.cache/tools'
New-Item -ItemType Directory -Path $binDirectory, $cacheDirectory -Force | Out-Null

function Get-Download([string]$Url, [string]$File) {
    Write-Host "Baixando $Url"
    & curl.exe --fail --location --retry 2 --connect-timeout 30 --max-time 300 --silent --show-error --output $File $Url
    if ($LASTEXITCODE -ne 0) { throw "Falha ao baixar $Url" }
}

function Assert-Checksum([string]$File, [string]$ChecksumFile, [string]$Name) {
    $checksumText = Get-Content -LiteralPath $ChecksumFile -Raw
    $checksumLine = ($checksumText -split "`n" | Where-Object { $_ -match '[a-fA-F0-9]{64}' -and $_ -match ([regex]::Escape($Name) + '\s*$') } | Select-Object -First 1)
    if (-not $checksumLine) { $checksumLine = $checksumText.Trim() }
    $expected = [regex]::Match($checksumLine, '[a-fA-F0-9]{64}').Value
    $actual = (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash
    if (-not $expected -or $actual -ne $expected) { throw "Checksum SHA256 invalido: $Name" }
}

$ytRelease = Invoke-RestMethod 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest'
$ytBase = "https://github.com/yt-dlp/yt-dlp/releases/download/$($ytRelease.tag_name)"
$ytFile = Join-Path $cacheDirectory 'yt-dlp.exe'
$ytHash = Join-Path $cacheDirectory 'SHA2-256SUMS'
Get-Download "$ytBase/yt-dlp.exe" $ytFile
Get-Download "$ytBase/SHA2-256SUMS" $ytHash
Assert-Checksum $ytFile $ytHash 'yt-dlp.exe'
Copy-Item -LiteralPath $ytFile -Destination (Join-Path $binDirectory 'yt-dlp.exe') -Force

$denoRelease = Invoke-RestMethod 'https://api.github.com/repos/denoland/deno/releases/latest'
$denoBase = "https://github.com/denoland/deno/releases/download/$($denoRelease.tag_name)"
$denoName = 'deno-x86_64-pc-windows-msvc.zip'
$denoZip = Join-Path $cacheDirectory $denoName
$denoHash = "$denoZip.sha256sum"
Get-Download "$denoBase/$denoName" $denoZip
Get-Download "$denoBase/$denoName.sha256sum" $denoHash
Assert-Checksum $denoZip $denoHash $denoName
Expand-Archive -LiteralPath $denoZip -DestinationPath (Join-Path $cacheDirectory 'deno') -Force
Copy-Item -LiteralPath (Join-Path $cacheDirectory 'deno/deno.exe') -Destination (Join-Path $binDirectory 'deno.exe') -Force

$ffmpegZip = Join-Path $cacheDirectory 'ffmpeg.zip'
$ffmpegHash = "$ffmpegZip.sha256"
Get-Download 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' $ffmpegZip
Get-Download 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip.sha256' $ffmpegHash
Assert-Checksum $ffmpegZip $ffmpegHash 'ffmpeg-release-essentials.zip'
Expand-Archive -LiteralPath $ffmpegZip -DestinationPath (Join-Path $cacheDirectory 'ffmpeg') -Force
foreach ($toolName in @('ffmpeg.exe', 'ffprobe.exe')) {
    $toolFile = Get-ChildItem -LiteralPath (Join-Path $cacheDirectory 'ffmpeg') -Recurse -File -Filter $toolName | Select-Object -First 1
    if (-not $toolFile) { throw "Arquivo nao encontrado no pacote: $toolName" }
    Copy-Item -LiteralPath $toolFile.FullName -Destination (Join-Path $binDirectory $toolName) -Force
}
Write-Host 'Ferramentas preparadas. Execute npm run tools:check.'
