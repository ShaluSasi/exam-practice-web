import { readFileSync, readdirSync } from "node:fs";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { QuestionBank } from "./src/content/schema";

/** One version for the website and the Android app; android/app/build.gradle reads it too. */
const appVersion = JSON.parse(readFileSync("app-version.json", "utf8")) as { name: string; build: number };

const DATA_DIR = "src/content/data";

/**
 * Checks every question bank against the schema when the dev server starts and
 * on every build, so a bad data file fails the build instead of reaching students.
 * The Worker serves the banks without checking them again.
 */
function checkQuestionBanks(): Plugin {
  return {
    name: "check-question-banks",
    buildStart() {
      for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"))) {
        const parsed = QuestionBank.safeParse(JSON.parse(readFileSync(`${DATA_DIR}/${file}`, "utf8")));
        if (!parsed.success) {
          throw new Error(`Question bank "${file}" failed validation: ${parsed.error.issues[0]?.message}`);
        }
        // Product rule: students pick answers, they never type them. Calculations are mcq.
        const typed = parsed.data.filter((q) => q.type === "numeric");
        if (typed.length) {
          throw new Error(`Question bank "${file}" has type-in (numeric) questions; use mcq options instead: ${typed.map((q) => q.id).join(", ")}`);
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // `--mode android` (npm run android:sync) builds the app's pages; they call the live site set in .env.android.
  if (mode === "android" && !/^https:\/\/[^/]+$/.test(loadEnv(mode, process.cwd()).VITE_SERVER_URL ?? "")) {
    throw new Error("Set VITE_SERVER_URL in .env.android to the live site, e.g. https://exam-practice.example.workers.dev");
  }
  return {
    plugins: [checkQuestionBanks(), react(), tailwindcss(), cloudflare()],
    define: { __APP_BUILD__: JSON.stringify(appVersion.build) },
  };
});
