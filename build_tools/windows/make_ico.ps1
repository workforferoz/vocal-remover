Add-Type -AssemblyName System.Drawing
$pngPath = Resolve-Path "public/karaoke-logo.png"
$icoPath = Join-Path (Resolve-Path "build_tools/windows") "app.ico"

$bmp = [System.Drawing.Bitmap]::FromFile($pngPath)
$thumb = New-Object System.Drawing.Bitmap 64, 64
$g = [System.Drawing.Graphics]::FromImage($thumb)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($bmp, 0, 0, 64, 64)
$g.Dispose()

$hIcon = $thumb.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)

$stream = [System.IO.File]::OpenWrite($icoPath)
$icon.Save($stream)
$stream.Close()

$thumb.Dispose()
$bmp.Dispose()

Write-Host "Created app.ico successfully!"

