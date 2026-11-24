import type { NextConfig } from "next";

// The repo name becomes the URL subpath on GitHub Pages:
// https://beambomb.github.io/ComfyAir/ . basePath/assetPrefix are only applied
// in CI (GITHUB_ACTIONS=true) so local `next dev` / `next start` stay at root.
const repo = "ComfyAir";
const isCI = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  // Emit a fully static site into `out/` that Pages can host (no Node server).
  output: "export",
  // Export routes as folders with index.html for clean static hosting on Pages.
  trailingSlash: true,
  basePath: isCI ? `/${repo}` : "",
  assetPrefix: isCI ? `/${repo}/` : "",
  // next/image optimization needs a server; disable it for the static export.
  images: { unoptimized: true },
};

export default nextConfig;
