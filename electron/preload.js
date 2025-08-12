import { contextBridge } from "electron";
import fs from "fs";
import path from "path";

// Expose a minimal API to read text assets from the packaged dist folder
const distDir = path.resolve(__dirname, "../dist");

async function readTextAsset(relPath) {
  const safeRel = String(relPath).replace(/^\/+/, "");
  const fullPath = path.join(distDir, safeRel);
  return fs.promises.readFile(fullPath, "utf-8");
}

contextBridge.exposeInMainWorld("electronAPI", {
  readTextAsset,
});
