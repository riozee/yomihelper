# Get project name from package.json
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$projectName = $packageJson.name

# Desktop build script with automatic file copying
Write-Host "🚀 Building Desktop app..." -ForegroundColor Green

# Run the Electron Builder
Write-Host "🏗️  Running Electron Builder..." -ForegroundColor Cyan
npx electron-builder

if ($LASTEXITCODE -eq 0) {
    Write-Host "🎉 Desktop build completed successfully!" -ForegroundColor Green
    Write-Host "💻 Build output location: output/" -ForegroundColor Yellow
    
    # Find and copy the built executable files
    $outputFiles = Get-ChildItem "output/*" -File -ErrorAction SilentlyContinue
    if ($outputFiles) {
        Write-Host "📦 Generated files:" -ForegroundColor Cyan
        foreach ($file in $outputFiles) {
            Write-Host "   - $($file.Name)" -ForegroundColor Gray
            
            # Copy executable files to project root with descriptive names
            if ($file.Extension -eq ".exe") {
                $destinationName = "$projectName-desktop.exe"
                Copy-Item $file.FullName $destinationName -Force
                Write-Host "📋 Copied to project root: $destinationName" -ForegroundColor Green
            }
            elseif ($file.Extension -eq ".AppImage") {
                $destinationName = "$projectName-desktop.AppImage"
                Copy-Item $file.FullName $destinationName -Force
                Write-Host "📋 Copied to project root: $destinationName" -ForegroundColor Green
            }
            elseif ($file.Extension -eq ".dmg") {
                $destinationName = "$projectName-desktop.dmg"
                Copy-Item $file.FullName $destinationName -Force
                Write-Host "📋 Copied to project root: $destinationName" -ForegroundColor Green
            }
        }
    }
} else {
    Write-Host "❌ Desktop build failed" -ForegroundColor Red
    exit $LASTEXITCODE
}
