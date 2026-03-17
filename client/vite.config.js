import path from "node:path";
import { defineConfig } from "vite";

function relPath(p) {
  return path.resolve(__dirname, p);
}

export default defineConfig({
  build: {
    outDir: "dist",
    target: ["chrome111", "edge111"],
    loader: "ts",
    resolve: {
      alias: {
        "@src": relPath("./src"),
      },
    },
    rollupOptions: {
      input: {
        client: relPath("./src/client.ts"),
        "e2e-worker": relPath("./src/workers/e2e.worker.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
    emptyOutDir: true,
    reportCompressedSize: true,
  },
});
