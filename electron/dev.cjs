/* eslint-disable @typescript-eslint/no-require-imports -- Electron entry point is intentionally CommonJS. */
const { spawn } = require("node:child_process");
const http = require("node:http");
const { join } = require("node:path");

const root = join(__dirname, "..");
const port = process.env.M365_STUDIO_PORT || "4173";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const localUrl = "http://127.0.0.1:" + port;
const web = spawn(npmCommand, ["run", "web:dev", "--", "--host", "127.0.0.1", "--port", port], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env },
});

function retry(retries) {
  if (retries <= 0) {
    web.kill();
    console.error("The web app did not become ready in time.");
    process.exit(1);
  }
  setTimeout(() => waitForWeb(retries - 1), 500);
}

function waitForWeb(retries = 80) {
  const request = http.get(localUrl, (response) => {
    response.resume();
    if (response.statusCode && response.statusCode < 500) {
      const electronArgs = ["run", "desktop", "--", "--url=" + localUrl];
      if (typeof process.getuid === "function" && process.getuid() === 0) {
        electronArgs.push("--no-sandbox");
      }
      const electron = spawn(npmCommand, electronArgs, {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, M365_STUDIO_URL: localUrl },
      });
      electron.on("exit", (code) => {
        web.kill();
        process.exit(code ?? 0);
      });
      return;
    }
    retry(retries);
  });
  request.on("error", () => retry(retries));
}

web.on("error", (error) => {
  console.error("Unable to start the web app:", error.message);
  process.exit(1);
});

waitForWeb();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    web.kill(signal);
    process.exit(0);
  });
}
