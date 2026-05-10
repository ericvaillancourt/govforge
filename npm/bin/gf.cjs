#!/usr/bin/env node
/**
 * Thin shim that execs the platform-specific gf binary downloaded by the
 * postinstall hook. Forwards every argument and exit code, inherits stdio
 * so spinners + colours behave like a direct invocation.
 */

const path = require("node:path");
const { spawn } = require("node:child_process");
const fs = require("node:fs");

const binName = process.platform === "win32" ? "gf.exe" : "gf";
const binPath = path.join(__dirname, binName);

if (!fs.existsSync(binPath)) {
  process.stderr.write(
    `govforge: binary missing at ${binPath}\n` +
      `Re-run \`npm install -g @govforge/cli\` or install via\n` +
      "  curl -fsSL https://govforge.dev/install.sh | sh\n",
  );
  process.exit(127);
}

const child = spawn(binPath, process.argv.slice(2), { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
