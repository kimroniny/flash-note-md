$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "dist"
$port = 47821
$prefix = "http://127.0.0.1:$port/"

if (-not (Test-Path (Join-Path $dist "index.html"))) {
  Write-Host "还没有构建产物。请先运行 npm install 与 npm run build。"
  exit 1
}

$listener = [System.Net.HttpListener]::new()
try {
  $listener.Prefixes.Add($prefix)
  $listener.Start()
} catch {
  # Port already serving this app from a previous launch.
  Start-Process "msedge" "--app=$prefix --user-data-dir=$env:LOCALAPPDATA\FlashNote\edge-profile"
  exit 0
}

Start-Process "msedge" "--app=$prefix --user-data-dir=$env:LOCALAPPDATA\FlashNote\edge-profile"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".json" = "application/json"
  ".webmanifest" = "application/manifest+json"
  ".md"   = "text/markdown; charset=utf-8"
  ".ico"  = "image/x-icon"
}

function Get-ContentType([string]$path) {
  $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($mime.ContainsKey($ext)) { return $mime[$ext] }
  return "application/octet-stream"
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
    $full = [System.IO.Path]::GetFullPath((Join-Path $dist $rel))
    $distFull = [System.IO.Path]::GetFullPath($dist)
    $ok = $full.StartsWith($distFull, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $full) -and -not (Test-Path $full -PathType Container)
    if (-not $ok) {
      $ctx.Response.StatusCode = 404
      $ctx.Response.Close()
      continue
    }
    $bytes = [System.IO.File]::ReadAllBytes($full)
    $ctx.Response.ContentType = Get-ContentType $full
    $ctx.Response.Headers["Cache-Control"] = "public, max-age=60"
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $ctx.Response.Close()
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
