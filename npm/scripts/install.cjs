#!/usr/bin/env node
/**
 * Postinstall hook: download the matching gf binary from GitHub Releases.
 *
 * The npm wrapper exists so MCP-aware tools that prefer `npx <pkg>` can
 * pull GovForge without separately downloading the binary. The wrapper
 * is intentionally thin — it ships no Go source, just the Node stub
 * (`bin/gf.cjs`) plus this installer.
 *
 * Verification: we download `checksums.txt` alongside the archive and
 * compare the SHA-256 before extracting. A mismatch aborts the install.
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const https = require("node:https");
const { pipeline } = require("node:stream/promises");
const zlib = require("node:zlib");
const tar = require("node:child_process");

const REPO = "ericvaillancourt/govforge";
const VERSION = require("../package.json").version;
const TAG = `v${VERSION}`;

function log(msg) {
  process.stderr.write(`govforge: ${msg}\n`);
}

function platform() {
  switch (process.platform) {
    case "linux":
      return "linux";
    case "darwin":
      return "darwin";
    case "win32":
      return "windows";
    default:
      throw new Error(`unsupported platform: ${process.platform}`);
  }
}

function arch() {
  switch (process.arch) {
    case "x64":
      return "x86_64";
    case "arm64":
      return "arm64";
    default:
      throw new Error(`unsupported arch: ${process.arch}`);
  }
}

async function fetch(url) {
  return await new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "govforge-npm-postinstall" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`GET ${url} → ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
  });
}

async function main() {
  const os_ = platform();
  const arch_ = arch();
  const ext = os_ === "windows" ? "zip" : "tar.gz";
  const archive = `gf_${VERSION}_${os_}_${arch_}.${ext}`;
  const archiveUrl = `https://github.com/${REPO}/releases/download/${TAG}/${archive}`;
  const checksumsUrl = `https://github.com/${REPO}/releases/download/${TAG}/checksums.txt`;

  const binDir = path.join(__dirname, "..", "bin");
  fs.mkdirSync(binDir, { recursive: true });

  log(`downloading ${archive}`);
  const archiveBytes = await fetch(archiveUrl);

  log(`verifying sha-256`);
  const checksumsTxt = (await fetch(checksumsUrl)).toString("utf8");
  const expected = checksumsTxt
    .split("\n")
    .map((l) => l.trim().split(/\s+/))
    .find((parts) => parts[1] === archive);
  if (!expected) throw new Error(`${archive} not present in checksums.txt`);
  const actual = crypto.createHash("sha256").update(archiveBytes).digest("hex");
  if (actual !== expected[0]) {
    throw new Error(`checksum mismatch: expected ${expected[0]} got ${actual}`);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "govforge-"));
  const archivePath = path.join(tmp, archive);
  fs.writeFileSync(archivePath, archiveBytes);

  log(`extracting`);
  if (os_ === "windows") {
    // Use built-in tar (Windows 10+ ships it).
    tar.execFileSync("tar", ["-xf", archivePath, "-C", tmp]);
    fs.copyFileSync(path.join(tmp, "gf.exe"), path.join(binDir, "gf.exe"));
  } else {
    const targetDir = path.join(tmp, "extract");
    fs.mkdirSync(targetDir, { recursive: true });
    tar.execFileSync("tar", ["-xzf", archivePath, "-C", targetDir]);
    const target = path.join(binDir, "gf");
    fs.copyFileSync(path.join(targetDir, "gf"), target);
    fs.chmodSync(target, 0o755);
  }

  log(`installed gf ${TAG} at ${binDir}`);
}

main().catch((e) => {
  process.stderr.write(`\ngovforge install failed: ${e.message}\n`);
  process.stderr.write(
    "Falling back: install the binary manually from\n" +
      `  https://github.com/${REPO}/releases/tag/${TAG}\n` +
      "or use the install script at https://govforge.dev/install.sh\n",
  );
  process.exit(1);
});
