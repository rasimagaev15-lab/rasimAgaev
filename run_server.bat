@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Usage: run_server.bat [port]
set PORT=%~1
if "%PORT%"=="" set PORT=8000

set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%"
echo Serving "%CD%" on http://localhost:%PORT%

REM Try Python (python)
where python >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" http://localhost:%PORT%
  python -m http.server %PORT% --directory "%CD%" --bind 127.0.0.1
  goto :eof
)

REM Try Python (py)
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" http://localhost:%PORT%
  py -m http.server %PORT% --directory "%CD%" --bind 127.0.0.1
  goto :eof
)

REM Try Node via npx serve (non-interactive)
where npx >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" http://localhost:%PORT%
  npx --yes serve -l %PORT% --no-port-switching --cors
  goto :eof
)

REM Fallback: PowerShell static server
if not exist tools mkdir tools
set PS_SERVER=tools\static-server.ps1
if not exist "%PS_SERVER%" (
  echo Creating PowerShell static server script...
  >"%PS_SERVER%" echo param(^[int^]$Port=8000, ^[string^]$Root="."^)
  >>"%PS_SERVER%" echo ^[Reflection.Assembly^]::LoadWithPartialName("System.Web") ^| Out-Null
  >>"%PS_SERVER%" echo $Root = ^(Resolve-Path $Root^).Path
  >>"%PS_SERVER%" echo $listener = New-Object System.Net.HttpListener
  >>"%PS_SERVER%" echo $listener.Prefixes.Add(^"http://localhost:$Port/^"^)
  >>"%PS_SERVER%" echo $listener.Start^
  >>"%PS_SERVER%" echo Write-Host ^"Serving $Root on http://localhost:$Port (PowerShell)^"
  >>"%PS_SERVER%" echo start ^"^" ^"http://localhost:$Port^"
  >>"%PS_SERVER%" echo while ^($listener.IsListening^) {
  >>"%PS_SERVER%" echo ^  $context = $listener.GetContext^
  >>"%PS_SERVER%" echo ^  $path = [System.Web.HttpUtility]::UrlDecode($context.Request.Url.AbsolutePath.TrimStart('/'))
  >>"%PS_SERVER%" echo ^  if ^([string]::IsNullOrWhiteSpace($path)^) { $path = 'index.html' }
  >>"%PS_SERVER%" echo ^  $file = Join-Path $Root $path
  >>"%PS_SERVER%" echo ^  if ^(Test-Path $file -PathType Container^) { $file = Join-Path $file 'index.html' }
  >>"%PS_SERVER%" echo ^  if ^(Test-Path $file -PathType Leaf^) {
  >>"%PS_SERVER%" echo ^    $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant^
  >>"%PS_SERVER%" echo ^    $mime = switch ^($ext^) { '.html' { 'text/html' } '.htm' { 'text/html' } '.css' { 'text/css' } '.js' { 'application/javascript' } '.json' { 'application/json' } '.svg' { 'image/svg+xml' } '.jpg' { 'image/jpeg' } '.jpeg' { 'image/jpeg' } '.png' { 'image/png' } '.gif' { 'image/gif' } Default { 'application/octet-stream' } }
  >>"%PS_SERVER%" echo ^    $bytes = [System.IO.File]::ReadAllBytes($file)
  >>"%PS_SERVER%" echo ^    $context.Response.ContentType = $mime
  >>"%PS_SERVER%" echo ^    $context.Response.ContentLength64 = $bytes.Length
  >>"%PS_SERVER%" echo ^    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  >>"%PS_SERVER%" echo ^  } else {
  >>"%PS_SERVER%" echo ^    $context.Response.StatusCode = 404
  >>"%PS_SERVER%" echo ^    $bytes = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
  >>"%PS_SERVER%" echo ^    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  >>"%PS_SERVER%" echo ^  }
  >>"%PS_SERVER%" echo ^  $context.Response.OutputStream.Close^
  >>"%PS_SERVER%" echo }
)

start "" http://localhost:%PORT%
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SERVER%" -Port %PORT% -Root "%CD%"

popd
endlocal

