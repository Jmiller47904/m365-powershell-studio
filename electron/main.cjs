/* eslint-disable @typescript-eslint/no-require-imports -- Electron entry point is intentionally CommonJS. */
const { app, BrowserWindow, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_WEB_URL = "http://127.0.0.1:4173";

function configuredUrl() {
  const cliArg = process.argv.find((arg) => arg.startsWith("--url="));
  const cliUrl = cliArg ? cliArg.slice(6) : "";
  if (cliUrl) return cliUrl;
  if (process.env.M365_STUDIO_URL) return process.env.M365_STUDIO_URL;

  const configPath = path.join(app.getPath("userData"), "config.json");
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (typeof config.url === "string" && config.url.trim()) return config.url;
  } catch {
    // A first launch has no config file yet.
  }
  return DEFAULT_WEB_URL;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#111319",
    title: "M365 PowerShell Studio",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  window.loadURL(configuredUrl());

  if (process.env.M365_OPEN_DEVTOOLS === "1") {
    window.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
