// Copies the Android build of the pages (dist/client, built with --mode android) to
// dist/android for Capacitor, leaving out what the app loads from the live site
// instead: question images (img/) and link-preview pictures (og/).
import { cpSync, rmSync } from "node:fs";
import { sep } from "node:path";

const SKIP = ["img", "og"].map((d) => `dist${sep}client${sep}${d}`);

rmSync("dist/android", { recursive: true, force: true });
cpSync("dist/client", "dist/android", {
  recursive: true,
  filter: (src) => !SKIP.some((d) => src === d || src.startsWith(d + sep)),
});
console.log("dist/android ready (without img/ and og/)");
