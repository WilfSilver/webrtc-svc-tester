// import { spawn } from "node:child_process";
// import electronPath from "electron";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // ssr: true,
    // sourcemap: "inline",
    outDir: "dist",
    target: ["chrome111", "edge111"],
    loader: "ts",
    // assetsDir: ".",
    // lib: {
    //   // index: "./src/index.ts",
    //   client: "./src/client.ts",
    //   "e2e-worker": "./src/workers/e2e.worker.ts",
    // },
    // commonjsOptions: { transformMixedEsModules: true },
    // resolve: {
    //   alias: {
    //     "@": fileURLToPath(new URL("./src", import.meta.url)),
    //   },
    // },
    rollupOptions: {
      input: {
        // index: "./src/index.ts",
        client: "./src/client.ts",
        "e2e-worker": "./src/workers/e2e.worker.ts",
      },
      output: {
        // preserveModules: false,
        entryFileNames: "[name].js",
        // codeSplitting: false,
        // format: "cjs",
      },
    },
    emptyOutDir: true,
    reportCompressedSize: true,
  },
  // esbuild: {
  //   target: "esnext",
  //   loader: "ts",
  //   // This ensures imports are handled correctly
  //   keepNames: true,
  // },

  // plugins: [handleHotReload()],
});

// /**
//  * Implement Electron app reload when some file was changed
//  * @return {import('vite').Plugin}
//  */
// function handleHotReload() {
//   /** @type {ChildProcess} */
//   let electronApp = null;
//
//   /** @type {import('vite').ViteDevServer|null} */
//   let rendererWatchServer = null;
//
//   return {
//     name: "@app/main-process-hot-reload",
//
//     config(config, env) {
//       if (env.mode !== "development") {
//         return;
//       }
//
//       const rendererWatchServerProvider = config.plugins.find(
//         (p) => p.name === "@app/renderer-watch-server-provider",
//       );
//       if (!rendererWatchServerProvider) {
//         throw new Error("Renderer watch server provider not found");
//       }
//
//       rendererWatchServer =
//         rendererWatchServerProvider.api.provideRendererWatchServer();
//
//       process.env.VITE_DEV_SERVER_URL =
//         rendererWatchServer.resolvedUrls.local[0];
//
//       return {
//         build: {
//           watch: {},
//         },
//       };
//     },
//
//     writeBundle() {
//       if (process.env.NODE_ENV !== "development") {
//         return;
//       }
//
//       /** Kill electron if a process already exists */
//       if (electronApp !== null) {
//         electronApp.removeListener("exit", process.exit);
//         electronApp.kill("SIGINT");
//         electronApp = null;
//       }
//
//       /** Spawn a new electron process */
//       electronApp = spawn(String(electronPath), ["--inspect", "."], {
//         stdio: "inherit",
//       });
//
//       /** Stops the watch script when the application has been quit */
//       electronApp.addListener("exit", process.exit);
//     },
//   };
// }
