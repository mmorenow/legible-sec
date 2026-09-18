import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export → `out/` folder of plain HTML/CSS/JS. Deployable anywhere
  // (Vercel, Netlify, GitHub Pages, a Hugging Face static Space, S3…).
  output: "export",
  // Required for static export: no on-demand image optimization server.
  images: { unoptimized: true },
  // Emit /route/index.html so bare directory URLs resolve on any static host.
  trailingSlash: true,
};

export default nextConfig;
