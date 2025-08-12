#!/usr/bin/env node

import { promises as fs } from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setup() {
  console.log("🚀 Setting up CapViteTron...");

  try {
    // Check if we're on Windows and Java needs to be detected
    if (process.platform === "win32") {
      await setupJavaForAndroid();
    }

    // Add Capacitor platforms
    await setupCapacitorPlatforms();

    console.log("✅ Setup complete!");
    console.log("\nNext steps:");
    console.log("1. npm run dev - Start development server");
    console.log("2. npm run build:all - Build for all platforms");
    console.log("3. Edit src/App.tsx to customize your app");
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
  }
}

async function setupCapacitorPlatforms() {
  console.log("📱 Setting up Capacitor platforms...");

  // Check if android platform already exists
  try {
    await fs.access(path.join(process.cwd(), "android"));
    console.log("✅ Android platform already exists");
  } catch {
    console.log("➕ Adding Android platform...");
    try {
      execSync("npx cap add android", { stdio: "inherit" });
      console.log("✅ Android platform added successfully");
    } catch (error) {
      console.log("⚠️  Failed to add Android platform:", error.message);
    }
  }
}

async function setupJavaForAndroid() {
  console.log("🔍 Checking Java installation for Android builds...");

  try {
    // Try to run java command first
    execSync("java -version", { stdio: "pipe" });
    console.log("✅ Java is available in PATH");
    return;
  } catch {
    console.log("⚠️  Java not found in PATH, searching for installation...");
  }

  // Try to find Java installation
  const javaPath = await findJavaInstallation();

  if (javaPath) {
    console.log(`📍 Found Java at: ${javaPath}`);
    await createJavaSetupScript(javaPath);
  } else {
    console.log("❌ Java not found. Please install Java 17 or later:");
    console.log("   - Download from: https://adoptium.net/");
    console.log("   - Or install via: winget install Eclipse.Temurin.17.JDK");
  }
}

async function findJavaInstallation() {
  const possibleJavaPaths = [
    "C:\\Program Files\\Eclipse Adoptium\\jdk-*\\bin\\java.exe",
    "C:\\Program Files\\Java\\jdk-*\\bin\\java.exe",
    "C:\\Program Files\\Microsoft\\jdk-*\\bin\\java.exe",
    "C:\\Program Files (x86)\\Eclipse Adoptium\\jdk-*\\bin\\java.exe",
    "C:\\Program Files (x86)\\Java\\jdk-*\\bin\\java.exe",
  ];

  for (const pattern of possibleJavaPaths) {
    try {
      const result = execSync(
        `powershell -Command "Get-ChildItem -Path '${pattern}' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1 | ForEach-Object { $_.FullName }"`,
        { encoding: "utf8", stdio: "pipe" }
      );

      const javaExe = result.trim();
      if (javaExe && javaExe !== "") {
        // Return the JDK home directory (remove \bin\java.exe)
        return path.dirname(path.dirname(javaExe));
      }
    } catch {
      // Continue searching
    }
  }
  return null;
}

async function createJavaSetupScript(javaHome) {
  const setupScript = `@echo off
echo Setting up Java environment for Android builds...
set JAVA_HOME=${javaHome}
set PATH=%JAVA_HOME%\\bin;%PATH%
echo JAVA_HOME set to: %JAVA_HOME%
echo.
echo To make this permanent, run these commands in an elevated Command Prompt:
echo setx JAVA_HOME "${javaHome}"
echo setx PATH "%PATH%;${javaHome}\\bin"
echo.
echo For current session, run: .\\scripts\\setup-java.bat
`;

  const psScript = `# PowerShell script to set Java environment
Write-Host "Setting up Java environment for Android builds..." -ForegroundColor Green
$env:JAVA_HOME = "${javaHome}"
$env:PATH = "$env:JAVA_HOME\\bin;" + $env:PATH
Write-Host "JAVA_HOME set to: $env:JAVA_HOME" -ForegroundColor Yellow
Write-Host ""
Write-Host "To make this permanent, run these commands in an elevated PowerShell:" -ForegroundColor Cyan
Write-Host "[Environment]::SetEnvironmentVariable('JAVA_HOME', '${javaHome}', 'Machine')" -ForegroundColor Gray
Write-Host "[Environment]::SetEnvironmentVariable('PATH', [Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';${javaHome}\\bin', 'Machine')" -ForegroundColor Gray
Write-Host ""
Write-Host "For current session, run: .\\scripts\\setup-java.ps1" -ForegroundColor Yellow
`;

  try {
    await fs.writeFile(path.join(__dirname, "setup-java.bat"), setupScript);
    await fs.writeFile(path.join(__dirname, "setup-java.ps1"), psScript);
    console.log("📝 Created Java setup scripts:");
    console.log("   - scripts/setup-java.bat (for Command Prompt)");
    console.log("   - scripts/setup-java.ps1 (for PowerShell)");
    console.log("");
    console.log("🔧 To set Java for current session, run:");
    console.log("   .\\scripts\\setup-java.ps1");
    console.log("");
    console.log("🔧 To set Java permanently, run as Administrator:");
    console.log(`   setx JAVA_HOME "${javaHome}"`);
    console.log(`   setx PATH "%PATH%;${javaHome}\\bin"`);
  } catch (error) {
    console.log("⚠️  Could not create Java setup scripts:", error.message);
  }
}

setup();
