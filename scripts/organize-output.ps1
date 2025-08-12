#!/usr/bin/env pwsh

Write-Host "📦 CapViteTron Output Organizer" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan
Write-Host ""

# Create output directory
if (!(Test-Path "output")) {
    New-Item -ItemType Directory -Path "output" | Out-Null
    Write-Host "📁 Created output directory" -ForegroundColor Green
}

$copied = 0

# Copy Windows executable
Write-Host "🖥️  Looking for Windows executable..." -ForegroundColor Yellow
$winExePaths = @(
    "dist-electron\*.exe",
    "output\*.exe"
)

foreach ($pattern in $winExePaths) {
    $exeFiles = Get-ChildItem $pattern -ErrorAction SilentlyContinue
    foreach ($exe in $exeFiles) {
        $targetPath = "output\$($exe.Name)"
        if (-not (Test-Path $targetPath) -or $exe.LastWriteTime -gt (Get-Item $targetPath).LastWriteTime) {
            Copy-Item $exe.FullName $targetPath -Force
            Write-Host "✅ Copied: $($exe.Name)" -ForegroundColor Green
            $copied++
        }
    }
}

# Copy Android APK
Write-Host "📱 Looking for Android APK..." -ForegroundColor Yellow
$apkPaths = @(
    "android\app\build\outputs\apk\debug\app-debug.apk",
    "android\app\build\outputs\apk\release\app-release.apk"
)

foreach ($apkPath in $apkPaths) {
    if (Test-Path $apkPath) {
        $apkInfo = Get-Item $apkPath
        $targetName = if ($apkPath -match "debug") { "app-debug.apk" } else { "app-release.apk" }
        $targetPath = "output\$targetName"
        
        if (-not (Test-Path $targetPath) -or $apkInfo.LastWriteTime -gt (Get-Item $targetPath -ErrorAction SilentlyContinue).LastWriteTime) {
            Copy-Item $apkPath $targetPath -Force
            Write-Host "✅ Copied: $targetName" -ForegroundColor Green
            $copied++
        }
        break  # Use first found APK
    }
}

Write-Host ""
if ($copied -gt 0) {
    Write-Host "🎉 Organized $copied file(s) in output folder:" -ForegroundColor Green
    Get-ChildItem "output" | ForEach-Object {
        $size = if ($_.Length -gt 1MB) { 
            "{0:N1} MB" -f ($_.Length / 1MB) 
        } else { 
            "{0:N0} KB" -f ($_.Length / 1KB) 
        }
        Write-Host "   📄 $($_.Name) ($size)" -ForegroundColor Gray
    }
} else {
    Write-Host "ℹ️  No new files to organize" -ForegroundColor Gray
    Write-Host "   Current output folder contents:" -ForegroundColor Gray
    Get-ChildItem "output" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "   📄 $($_.Name)" -ForegroundColor Gray
    }
}

Write-Host ""
