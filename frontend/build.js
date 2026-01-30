/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-01-29 11:18:10
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-01-30 14:22:46
 */

const esbuild = require("esbuild");
const { solidPlugin } = require("esbuild-plugin-solid");
const fs = require("fs");

console.log("⚡ Building with esbuild + Solid plugin...");
esbuild
    .build({
        entryPoints: ["src/index.tsx"],
        bundle: true,
        outfile: "dist/bundle.js",
        format: "iife",
        target: "es2020",
        minify: true,
        plugins: [solidPlugin()],
    })
    .then(() => {
        console.log("📄 Copying index.html...");
        fs.copyFileSync("src/index.html", "dist/index.html");
        fs.copyFileSync("src/index.css", "dist/index.css");
        console.log("✅ Build succeeded!");
    })
    .catch((err) => {
        console.error("❌ Build failed:", err);
        process.exit(1);
    });
