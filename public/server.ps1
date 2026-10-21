$port = 8000
$prefix = "http://localhost:$port/"
$root = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "========================================="
    Write-Host "  Portfolio Server Started!"
    Write-Host "========================================="
    Write-Host ""
    Write-Host "Open in browser:"
    Write-Host "  http://localhost:$port/index.html" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press Ctrl+C to stop"
    Write-Host ""
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $url = $request.Url.LocalPath
        if ($url -eq "/" -or $url -eq "") {
            $url = "/index.html"
        }
        
        $filePath = Join-Path $root $url.TrimStart("/")
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            switch ($ext) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".css" { $response.ContentType = "text/css; charset=utf-8" }
                ".js" { $response.ContentType = "application/javascript; charset=utf-8" }
                ".png" { $response.ContentType = "image/png" }
                ".jpg" { $response.ContentType = "image/jpeg" }
                ".jpeg" { $response.ContentType = "image/jpeg" }
                ".svg" { $response.ContentType = "image/svg+xml" }
                ".gif" { $response.ContentType = "image/gif" }
                ".ico" { $response.ContentType = "image/x-icon" }
                default { $response.ContentType = "application/octet-stream" }
            }
            
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "[200] $url" -ForegroundColor Green
        } else {
            $response.StatusCode = 404
            $error404 = [System.Text.Encoding]::UTF8.GetBytes("404 - File Not Found: $url")
            $response.ContentLength64 = $error404.Length
            $response.OutputStream.Write($error404, 0, $error404.Length)
            Write-Host "[404] $url" -ForegroundColor Red
        }
        
        $response.OutputStream.Close()
    }
} catch {
    Write-Host ""
    Write-Host "Server stopped: $_"
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
}
