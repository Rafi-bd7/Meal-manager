Add-Type -AssemblyName System.Drawing

function CreateIcon {
    param([int]$size, [string]$path)
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Dark background
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 13, 18, 32))
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # Plate circle
    $penWidth = [float]([int]($size * 0.04))
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 79, 142, 247), $penWidth)
    $m = [int]($size * 0.2)
    $circSize = $size - ($m * 2)
    $g.DrawEllipse($pen, $m, $m, $circSize, $circSize)

    # Utensil vertical lines
    $tpw = [float]([int]($size * 0.055))
    $thickPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 79, 142, 247), $tpw)
    $thickPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $thickPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($thickPen, [int]($size * 0.37), [int]($size * 0.2), [int]($size * 0.37), [int]($size * 0.78))
    $g.DrawLine($thickPen, [int]($size * 0.63), [int]($size * 0.2), [int]($size * 0.63), [int]($size * 0.78))

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: $path"
}

CreateIcon -size 192 -path "d:\meal-manager\icons\icon-192.png"
CreateIcon -size 512 -path "d:\meal-manager\icons\icon-512.png"
Write-Host "Done!"
