$ftpHost = "ftp-mealmanager.alwaysdata.net"
$ftpUser = "mealmanager_meals"
$ftpPass = "@@mealmanager@@"
$baseDir = $PSScriptRoot

[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

function Make-FtpDir($relPath) {
    $uri = "ftp://$ftpHost/$relPath"
    $req = [System.Net.FtpWebRequest]::Create($uri)
    $req.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
    $req.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
    $req.EnableSsl = $true
    $req.UsePassive = $true
    $req.KeepAlive = $false
    try {
        $res = $req.GetResponse()
        $res.Close()
    } catch {}
}

function Upload-FtpFile($localFile, $remoteRelPath) {
    $uri = "ftp://$ftpHost/$remoteRelPath"
    $req = [System.Net.FtpWebRequest]::Create($uri)
    $req.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
    $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
    $req.EnableSsl = $true
    $req.UsePassive = $true
    $req.KeepAlive = $false
    $req.UseBinary = $true

    $bytes = [System.IO.File]::ReadAllBytes($localFile)
    $req.ContentLength = $bytes.Length

    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
    $res = $req.GetResponse()
    $res.Close()
    Write-Host " [OK] Uploaded: $remoteRelPath" -ForegroundColor Green
}

Write-Host "Checking directories..." -ForegroundColor Cyan
$dirs = @("api", "css", "icons", "js")
foreach ($d in $dirs) {
    Make-FtpDir $d
}

Write-Host "Uploading root files..." -ForegroundColor Cyan
$rootFiles = @(
    "index.html",
    "login.html",
    "admin-dashboard.html",
    "user-dashboard.html",
    "manifest.json",
    "sw.js",
    "database.sql"
)

foreach ($rf in $rootFiles) {
    $localPath = Join-Path $baseDir $rf
    if (Test-Path $localPath) {
        Upload-FtpFile $localPath $rf
    }
}

Write-Host "Uploading modules & assets..." -ForegroundColor Cyan
foreach ($d in $dirs) {
    $folderPath = Join-Path $baseDir $d
    if (Test-Path $folderPath) {
        $files = Get-ChildItem -Path $folderPath -File
        foreach ($file in $files) {
            $remotePath = "$d/$($file.Name)"
            Upload-FtpFile $file.FullName $remotePath
        }
    }
}

Write-Host ""
Write-Host "SUCCESS! All files updated on https://mealmanager.alwaysdata.net" -ForegroundColor Green
