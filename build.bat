@echo off
echo.
echo CapViteTron Cross-Platform Builder
echo ==================================
echo.

echo Building for all platforms...
call powershell -ExecutionPolicy Bypass -File "scripts\build.ps1"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build completed successfully!
    echo Check the 'output' folder for your applications.
) else (
    echo.
    echo Build failed. Check the error messages above.
)

echo.
pause
