import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack's inferred workspace root so it uses this project's
  // lockfile instead of an ancestor ~/package-lock.json.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // pdf-parse pulls in pdfjs-dist, which loads its worker via dynamic
  // import. Bundling that breaks the worker resolution under Turbopack —
  // mark these packages as external so Node loads them directly.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
