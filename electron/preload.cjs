const { contextBridge } = require("electron");
const fs = require("fs");
const path = require("path");

const distDir = path.resolve(__dirname, "../dist");

async function readTextAsset(relPath) {
  const safeRel = String(relPath).replace(/^\/+/, "");
  const fullPath = path.join(distDir, safeRel);
  return fs.promises.readFile(fullPath, "utf-8");
}

contextBridge.exposeInMainWorld("electronAPI", {
  readTextAsset,
});
