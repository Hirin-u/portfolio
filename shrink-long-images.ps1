Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot "public"
$maxW = 1920
$maxH = 4000
$jpegQuality = 92

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$jp = New-Object System.Drawing.Imaging.EncoderParameters(1)
$jp.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]$jpegQuality)

$targets = @(
    "project1-full.jpg", "project2-full.jpg", "project1-part.jpg", "project1-part2.jpg",
    "PJ1-1.jpg", "PJ1-2.jpg", "PJ1-3.jpg", "PJ1-4.jpg", "PJ1-5.jpg", "PJ1-6.jpg",
    "PJ2-1.jpg", "PJ2-2.jpg", "PJ2-3.jpg", "PJ2-4.jpg", "PJ2-5.jpg", "PJ2-6.jpg"
)

foreach ($name in $targets) {
    $p = Join-Path $root $name
    if (-not (Test-Path $p)) { Write-Host "[SKIP missing] $name"; continue }

    $beforeKB = [math]::Round((Get-Item $p).Length / 1KB, 1)
    $img = [System.Drawing.Image]::FromFile($p)

    $ratio = 1.0
    if ($img.Width -gt $maxW) { $ratio = [double]$maxW / $img.Width }
    if ($img.Height -gt $maxH) {
        $r2 = [double]$maxH / $img.Height
        if ($r2 -lt $ratio) { $ratio = $r2 }
    }

    if ($ratio -ge 1.0) {
        $img.Dispose()
        Write-Host "[OK] $name $($img.Width)x$($img.Height) (already small) - $beforeKB KB"
        continue
    }

    $nw = [int][Math]::Floor($img.Width * $ratio)
    $nh = [int][Math]::Floor($img.Height * $ratio)

    $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gfx.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $gfx.DrawImage($img, 0, 0, $nw, $nh)
    $gfx.Dispose()
    $img.Dispose()

    $tmp = Join-Path $env:TEMP ("fix_" + $name)
    if (Test-Path $tmp) { Remove-Item $tmp -Force }
    $bmp.Save($tmp, $codec, $jp)
    $bmp.Dispose()

    $afterKB = [math]::Round((Get-Item $tmp).Length / 1KB, 1)
    Remove-Item $p -Force
    Move-Item $tmp $p

    Write-Host "[DONE] $name ${nw}x${nh} : $beforeKB -> $afterKB KB (-$([math]::Round((1-$afterKB/$beforeKB)*100,1))%)"
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
