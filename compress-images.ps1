Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot "public"
$backupDir = Join-Path $root "_originals"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$maxWidth = 1920
$jpegQuality = 92

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$jpegParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$jpegParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]$jpegQuality)

$totalBefore = 0
$totalAfter = 0

Get-ChildItem -Path $root -File | Where-Object {
    $_.Extension -match '\.(jpg|jpeg|png)$' -and
    $_.Name -notmatch '^(hero-underline|wechat-qr|town-generated)'
} | ForEach-Object {
    $file = $_
    $beforeKB = [math]::Round($file.Length / 1KB, 1)
    $totalBefore += $file.Length

    $backupPath = Join-Path $backupDir $file.Name
    Copy-Item -Path $file.FullName -Destination $backupPath -Force

    $img = [System.Drawing.Image]::FromFile($file.FullName)
    try {
        $newW = $img.Width
        $newH = $img.Height

        if ($img.Width -gt $maxWidth) {
            $newW = $maxWidth
            $ratio = [double]$maxWidth / $img.Width
            $newH = [int]($img.Height * $ratio)
        }

        if ($newW -eq $img.Width -and $newH -eq $img.Height) {
            Write-Host "[SKIP] $($file.Name) - already ${newW}x${newH} ($beforeKB KB)"
            return
        }

        $bmp = New-Object System.Drawing.Bitmap($newW, $newH)
        try {
            $gfx = [System.Drawing.Graphics]::FromImage($bmp)
            try {
                $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $gfx.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $gfx.DrawImage($img, 0, 0, $newW, $newH)
            } finally {
                $gfx.Dispose()
            }

            $tmpPath = Join-Path $env:TEMP ("compress_" + $file.Name)
            if ($file.Extension -match '\.(jpg|jpeg)$') {
                $bmp.Save($tmpPath, $jpegCodec, $jpegParams)
            } else {
                $bmp.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
            }

            $bmp.Dispose()
            $img.Dispose()
            $img = $null
            $bmp = $null

            $afterBytes = (Get-Item $tmpPath).Length
            Move-Item -Path $tmpPath -Destination $file.FullName -Force

            $afterKB = [math]::Round($afterBytes / 1KB, 1)
            $totalAfter += $afterBytes
            $saving = [math]::Round((1 - $afterBytes / $file.Length) * 100, 1)
            Write-Host "[DONE] $($file.Name) ${newW}x${newH} : $beforeKB KB -> $afterKB KB (-${saving}%)"
        } finally {
            if ($bmp) { $bmp.Dispose() }
        }
    } finally {
        if ($img) { $img.Dispose() }
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
    }
}

Write-Host ""
Write-Host "============================================="
Write-Host "  Original: $([math]::Round($totalBefore / 1MB, 2)) MB"
Write-Host "  New:      $([math]::Round($totalAfter / 1MB, 2)) MB"
Write-Host "  Saved:    $([math]::Round((1 - $totalAfter / $totalBefore) * 100, 1))%"
Write-Host "  Backups:  $backupDir"
Write-Host "============================================="
