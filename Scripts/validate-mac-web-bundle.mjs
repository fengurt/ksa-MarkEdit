#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const root = fileURLToPath(new URL("../WebApp/dist-mac", import.meta.url));
const entry = `${root}/mac-index.html`;
const maximumBytes = 300 * 1024;
const forbiddenNames = new Set([
  "icon.svg",
  "manifest.webmanifest",
  "sw.js",
]);
const forbiddenContent = [
  "CoreEditor",
  "VaultSyncClient",
  "api.notes.apuch.art",
  "codemirror",
  "manifest.webmanifest",
  "serviceWorker",
];
const failures = [];

async function files(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) {
      result.push(...await files(path));
    } else {
      result.push(path);
    }
  }
  return result;
}

let bundleFiles;
try {
  bundleFiles = await files(root);
} catch (error) {
  console.error(`Mac web bundle is missing: ${error}`);
  process.exit(1);
}

if (!bundleFiles.includes(entry)) {
  failures.push(`${entry} is missing`);
}

let totalBytes = 0;
for (const path of bundleFiles) {
  totalBytes += (await stat(path)).size;
  const name = path.split("/").at(-1);
  if (name && forbiddenNames.has(name)) {
    failures.push(`${relative(root, path)} must not be embedded in the Mac app`);
  }
  if (/\.(?:html|js|css)$/.test(path)) {
    const source = await readFile(path, "utf8");
    for (const value of forbiddenContent) {
      if (source.includes(value)) {
        failures.push(`${relative(root, path)} contains excluded Web PWA code: ${value}`);
      }
    }
  }
}

if (totalBytes > maximumBytes) {
  failures.push(`bundle is ${totalBytes} bytes; maximum is ${maximumBytes}`);
}

if (bundleFiles.some(path => path.endsWith(".wasm"))) {
  failures.push("Mac Hub must not embed WebAssembly modules");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Mac web bundle validated: ${bundleFiles.length} files, ${totalBytes} bytes.`);
