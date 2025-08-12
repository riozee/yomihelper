#!/usr/bin/env pwsh

Write-Host "🚀 CapViteTron Cross-Platform Builder" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"
$OriginalLocation = Get-Location

try {
    # Step 1: Clean previous builds
    Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
    if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
    if (Test-Path "android/app/build") { Remove-Item -Recurse -Force "android/app/build" }
    if (Test-Path "output") { Remove-Item -Recurse -Force "output" }

    # Step 2: Build React app
    Write-Host "⚛️  Building React app..." -ForegroundColor Yellow
    npm run build
    
    # Step 3: Sync Capacitor
    Write-Host "🔄 Syncing Capacitor..." -ForegroundColor Yellow
    npx cap sync

    # Step 4: Build desktop app
    Write-Host "🖥️  Building desktop app..." -ForegroundColor Yellow
    $env:NODE_ENV = "production"
    npm run build:desktop

    # Step 5: Build Android APK (with Java 21 detection)
    Write-Host "📱 Building Android APK..." -ForegroundColor Yellow
    
    # Check for Java 21 specifically
    $javaFound = $false
    $javaVersion = ""
    
    try {
        $javaVersionOutput = java -version 2>&1 | Select-String "version" | Select-Object -First 1
        if ($javaVersionOutput -match '"(\d+)\.') {
            $javaVersion = $matches[1]
        } elseif ($javaVersionOutput -match '"(\d+)"') {
            $javaVersion = $matches[1]
        }
        
        if ($javaVersion -eq "21") {
            Write-Host "✅ Java 21 found - perfect for Android builds!" -ForegroundColor Green
            $javaFound = $true
        } else {
            Write-Host "⚠️  Java $javaVersion found, but Android builds require Java 21" -ForegroundColor Orange
        }
    } catch {
        Write-Host "❌ Java not found in PATH" -ForegroundColor Red
    }
    
    # Try to find Java 21 installation if not in PATH
    if (-not $javaFound) {
        Write-Host "🔍 Searching for Java 21 installation..." -ForegroundColor Yellow
        $javaPaths = @(
            "C:\Program Files\Eclipse Adoptium\jdk-21*\bin\java.exe",
            "C:\Program Files\Java\jdk-21*\bin\java.exe"
        )
        
        foreach ($pattern in $javaPaths) {
            $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | 
                     Sort-Object Name -Descending | Select-Object -First 1
            if ($found) {
                $env:JAVA_HOME = Split-Path (Split-Path $found.FullName -Parent) -Parent
                $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
                Write-Host "✅ Found Java 21 at: $($found.FullName)" -ForegroundColor Green
                $javaFound = $true
                break
            }
        }
    }
    
    if ($javaFound) {
        try {
            # Build debug APK (no signing required)
            Push-Location android
            .\gradlew assembleDebug
            Pop-Location
            Write-Host "✅ Android build completed" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Android build failed: $($_.Exception.Message)" -ForegroundColor Orange
            Write-Host "   Desktop build is still available" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  Java 21 not found, skipping Android build" -ForegroundColor Orange
        Write-Host "   Install Java 21: choco install temurin21" -ForegroundColor Gray
    }

    # Step 6: Organize outputs
    Write-Host "📦 Organizing outputs..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "output" -Force | Out-Null

    # Copy desktop builds
    $exeFiles = Get-ChildItem "output" -Filter "*.exe" -ErrorAction SilentlyContinue
    if ($exeFiles.Count -eq 0) {
        # Look in dist-electron if not in output yet
        if (Test-Path "dist-electron") {
            Get-ChildItem "dist-electron" -Filter "*.exe" | ForEach-Object {
                Copy-Item $_.FullName "output/" -Force
                Write-Host "✅ Copied: $($_.Name)" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "✅ Desktop executable already in output/" -ForegroundColor Green
    }

    # Copy Android APK
    $apkPath = "android/app/build/outputs/apk/debug/app-debug.apk"
    if (Test-Path $apkPath) {
        Copy-Item $apkPath "output/app.apk" -Force
        Write-Host "✅ Copied: app.apk" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "🎉 Build Complete!" -ForegroundColor Green
    Write-Host "📁 Check the 'output' folder for your apps:" -ForegroundColor White
    
    # List what was actually created
    if (Test-Path "output") {
        Get-ChildItem "output" | ForEach-Object {
            Write-Host "   📄 $($_.Name)" -ForegroundColor Gray
        }
    }
    Write-Host ""

} catch {
    Write-Host "❌ Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Set-Location $OriginalLocation
}
