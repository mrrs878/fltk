/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-01-30 10:09:43
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-01-30 10:15:51
 */

import * as esbuild from "esbuild";
import { solidPlugin } from "esbuild-plugin-solid";

console.log("⚡ Building with esbuild + Solid plugin...");
const ctx = await esbuild.context({
    entryPoints: ["src/index.tsx"],
    bundle: true,
    outfile: "dist/bundle.js",
    format: "iife",
    target: "es2020",
    minify: true,
    plugins: [solidPlugin()],
});

await ctx.watch();

const { host, port } = await ctx.serve({
    servedir: "dist",
    port: 3000,
});

console.log(`🚀 Serving on http://${host}:${port}`);
