# PrepQuest — exam practice (prototype)

Interactive practice for CBSE Class 9–12. React + TypeScript + Vite, Tailwind CSS v4, Motion, KaTeX.
Deploys to Cloudflare Workers as static assets.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run deploy     # build + wrangler deploy (run `npx wrangler login` once first)
```

## Where things live

| Path | What |
|---|---|
| `src/content/schema.ts` | Question schema (Zod). Real data must pass this. |
| `src/content/data/*.json` | Question bank. Replace `cbse-sample.json` with real data. |
| `src/config/regions.ts` | Per-market settings (IN / US / UK): grade labels, boards, subject names, A–R options. |
| `src/questions/` | One interactive renderer per question type. |
| `src/engine/scoring.ts` | Grading and XP rules. |
| `src/index.css` | Colour tokens for light and dark themes. Re-skin here. |

## Question types

`mcq`, `multi`, `numeric`, `assertion_reason`, `match`, `order`.

Text fields support `$inline maths$`, `$$display maths$$`, `\ce{...}` chemistry inside maths, `**bold**` and `*italic*`.
