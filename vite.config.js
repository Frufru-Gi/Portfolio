import { defineConfig } from "vite";

// Multi-page setup: each entry below becomes its own statically-built
// HTML file (index, /work/, /about/). `appType: "mpa"` disables the
// dev server's SPA fallback so deep links resolve to their own page
// instead of falling back to index.html.
export default defineConfig({
  appType: "mpa",
  build: {
    rollupOptions: {
      input: {
        home: "index.html",
        work: "work/index.html",
        about: "about/index.html",
        komootRedesign: "komoot-redesign/index.html",
        mosaicSystem: "mosaic-system/index.html",
        reminiReshot: "remini-reshot/index.html",
        project04: "project-04/index.html",
      },
    },
  },
});
