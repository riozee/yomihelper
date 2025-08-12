# Get project name from package.json
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$projectName = $packageJson.name

# Android build script with automatic Java detection
Write-Host "🚀 Building Android app..." -ForegroundColor Green

# Try to find Java installation
$javaPaths = @(
    "C:\Program Files\Eclipse Adoptium\jdk-*\bin\java.exe",
    "C:\Program Files\Java\jdk-*\bin\java.exe",
    "C:\Program Files\Microsoft\jdk-*\bin\java.exe",
    "C:\Program Files (x86)\Eclipse Adoptium\jdk-*\bin\java.exe",
    "C:\Program Files (x86)\Java\jdk-*\bin\java.exe"
)

$javaFound = $false

# Check if Java is already in PATH
try {
    java -version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Java is available in PATH" -ForegroundColor Green
        $javaFound = $true
    }
} catch {
    # Java not in PATH, continue searching
}

# If Java not in PATH, search for installation
if (-not $javaFound) {
    Write-Host "🔍 Searching for Java installation..." -ForegroundColor Yellow
    
    foreach ($pattern in $javaPaths) {
        $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
        if ($found) {
            $javaHome = Split-Path (Split-Path $found.FullName -Parent) -Parent
            Write-Host "📍 Found Java at: $javaHome" -ForegroundColor Green
            
            # Set environment variables for this session
            $env:JAVA_HOME = $javaHome
            $env:PATH = "$javaHome\bin;" + $env:PATH
            
            Write-Host "✅ Java environment configured" -ForegroundColor Green
            $javaFound = $true
            break
        }
    }
}

if (-not $javaFound) {
    Write-Host "❌ Java not found. Please install Java 17 or later:" -ForegroundColor Red
    Write-Host "   - Download from: https://adoptium.net/" -ForegroundColor Gray
    Write-Host "   - Or install via: winget install Eclipse.Temurin.17.JDK" -ForegroundColor Gray
    exit 1
}

# Run the Android build (debug by default)
Write-Host "🏗️  Running Capacitor Android build..." -ForegroundColor Cyan

# First, ensure the project is synced
Write-Host "🔄 Syncing Capacitor..." -ForegroundColor Yellow
npx cap sync android

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Capacitor sync failed" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Build debug APK directly with Gradle to avoid signing issues
Write-Host "🏗️  Building debug APK with Gradle..." -ForegroundColor Cyan
Set-Location "android"
try {
    .\gradlew assembleDebug
    $gradleExitCode = $LASTEXITCODE
} finally {
    Set-Location ".."
}

if ($gradleExitCode -eq 0) {
    Write-Host "🎉 Android debug build completed successfully!" -ForegroundColor Green
    Write-Host "📱 Debug APK location: android/app/build/outputs/apk/debug/" -ForegroundColor Yellow
    
    # List the generated APK files
    $apkFiles = Get-ChildItem "android/app/build/outputs/apk/debug/*.apk" -ErrorAction SilentlyContinue
    if ($apkFiles) {
        Write-Host "📦 Generated APK files:" -ForegroundColor Cyan
        foreach ($apk in $apkFiles) {
            Write-Host "   - $($apk.Name)" -ForegroundColor Gray
            
            # Copy APK to project root with a descriptive name
            $destinationName = "$projectName-android.apk"
            Copy-Item $apk.FullName $destinationName -Force
            Write-Host "📋 Copied to project root: $destinationName" -ForegroundColor Green
        }
    }
} else {
    Write-Host "❌ Android build failed" -ForegroundColor Red
    exit $gradleExitCode
}
