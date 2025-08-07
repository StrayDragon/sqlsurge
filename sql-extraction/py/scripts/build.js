#!/usr/bin/env node
//@ts-check
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const buildType = process.env.BUILD || "release";

console.log(`Building Python SQL extraction module (${buildType})...`);

try {
  // Clean previous builds
  console.log("Cleaning previous builds...");
  if (fs.existsSync("dist")) {
    fs.rmSync("dist", { recursive: true, force: true });
  }
  if (fs.existsSync("pkg")) {
    fs.rmSync("pkg", { recursive: true, force: true });
  }

  // Create dist directory
  fs.mkdirSync("dist", { recursive: true });
  fs.mkdirSync("pkg", { recursive: true });

  // Copy Python sources to pkg for easier deployment
  console.log("Copying Python sources...");
  fs.copyFileSync("src/py/sql_extractor.py", "pkg/sql_extractor.py");
  fs.copyFileSync("src/wasm_wrapper.py", "pkg/wasm_wrapper.py");

  // Build TypeScript interface
  console.log("Building TypeScript interface...");
  execSync(
    "npx tsc src/index.ts --outDir dist --declaration --target es2020 --module commonjs --moduleResolution node",
    {
      stdio: "inherit",
      cwd: process.cwd(),
    },
  );

  // Create package info
  const packageInfo = {
    name: "@senken/sql-extraction-py",
    version: "0.1.0",
    description: "Python SQL extraction module for SQLSurge",
    main: "index.js",
    types: "index.d.ts",
  };

  fs.writeFileSync("dist/package.json", JSON.stringify(packageInfo, null, 2));

  console.log("Build completed successfully!");
  console.log("Output:");
  console.log("  - TypeScript interface: dist/");
  console.log("  - Python sources: pkg/");
} catch (error) {
  console.error("Build failed:", error.message);
  process.exit(1);
}
