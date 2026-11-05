/**
 * What search engines read: the main address, robots.txt, sitemap.xml and a
 * plain page for each class, subject and chapter under /cbse/. Those pages are
 * written here as HTML, so they can be read without running the app, and they
 * send visitors on to the app to practise.
 */
import { region } from "../src/config/regions";
import type { Question, SubjectId } from "../src/content/schema";
import { NEEDS_PICTURE, loadBank, type Bank } from "./content";
import { SITE_ORIGIN, type Env } from "./http";
import { liveQuizQuestions } from "./quizzes";
import { GAME_PREVIEW, escape } from "./share";

/** Addresses of this site that only send visitors to the main one. The workers.dev address stays: the Android app calls it. */
const OTHER_HOSTS = new Set(["www.vijayeemantra.com", "vijayeemantra.in", "www.vijayeemantra.in"]);
const MAIN_HOST = new URL(SITE_ORIGIN).hostname;

/** The permanent redirect to the main address, if this page was asked for on another one. */
export function toMainAddress(request: Request, url: URL): Response | null {
  if ((request.method !== "GET" && request.method !== "HEAD") || url.pathname.startsWith("/api/")) return null;
  const other = OTHER_HOSTS.has(url.hostname) || (url.hostname === MAIN_HOST && url.protocol === "http:");
  return other ? Response.redirect(`${SITE_ORIGIN}${url.pathname}${url.search}`, 301) : null;
}

/** The app's own pages that only make sense for one person, kept out of search results. */
const PRIVATE_PAGE = /^\/(admin(\/.*)?|progress\/?|my-reported-questions\/?)$/;

/** A file, or the app at an address with no route of its own. Addresses the app doesn't know are a real 404 for search engines. */
export async function appPage(request: Request, env: Env, url: URL): Promise<Response> {
  const res = await env.ASSETS.fetch(request);
  if (!res.headers.get("Content-Type")?.includes("text/html")) return res;
  const headers = new Headers(res.headers);
  headers.set("X-Robots-Tag", "noindex");
  return new Response(res.body, { status: PRIVATE_PAGE.test(url.pathname) ? 200 : 404, headers });
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

type Chapter = Bank["chapters"] extends Map<string, infer C> ? C : never;

const SUBJECTS = Object.keys(region.subjects) as SubjectId[];
const classPath = (grade: number) => `/cbse/class-${grade}`;
const subjectPath = (grade: number, subject: SubjectId) => `${classPath(grade)}/${subject}`;
const chapterPath = (c: Chapter) => `${subjectPath(c.grade, c.subject)}/${slug(c.title)}`;
const classesOf = (bank: Bank) => [...new Set([...bank.chapters.values()].map((c) => c.grade))].sort((a, b) => a - b);

function chaptersOf(bank: Bank, grade: number, subject: SubjectId): Chapter[] {
  return [...bank.chapters.values()].filter((c) => c.grade === grade && c.subject === subject).sort((a, b) => (a.no ?? 99) - (b.no ?? 99));
}

const subjectsOf = (bank: Bank, grade: number) => SUBJECTS.filter((s) => chaptersOf(bank, grade, s).length > 0);

/** GET /robots.txt. The API stays open too: Google loads it to read the app's own pages. */
export function robotsTxt(): Response {
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

/** GET /sitemap.xml: every page worth finding in a search. */
export async function sitemap(env: Env): Promise<Response> {
  const bank = await loadBank(env);
  const paths = ["/", "/quiz", ...Object.keys(GAME_PREVIEW).map((id) => `/games/${id}`)];
  for (const grade of classesOf(bank)) {
    paths.push(classPath(grade));
    for (const subject of subjectsOf(bank, grade)) {
      paths.push(subjectPath(grade, subject));
      for (const c of chaptersOf(bank, grade, subject)) paths.push(chapterPath(c));
    }
  }
  const urls = paths.map((p) => `<url><loc>${escape(SITE_ORIGIN + p)}</loc></url>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

const STYLE = `*{box-sizing:border-box}body{margin:0;background:#F7F5F0;color:#1B1F3B;font:17px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header,main,footer{max-width:46rem;margin:0 auto;padding:1rem 1.25rem}header a{font-weight:800;font-size:1.25rem;color:#1B1F3B;text-decoration:none}
a{color:#3b3fb6}h1{font-size:1.9rem;line-height:1.2;margin:.5rem 0 1rem}h2{font-size:1.3rem;margin:2rem 0 .75rem}nav.crumbs{font-size:.9rem}
.cta{display:inline-block;margin:.5rem 0;padding:.8rem 1.4rem;border-radius:.9rem;background:#FF8A1F;color:#1B1F3B;font-weight:800;text-decoration:none}
ul{padding-left:1.25rem}li{margin:.3rem 0}.q{background:#fff;border:2px solid #e4e1d8;border-radius:1rem;padding:1rem 1.1rem;margin:1rem 0}.q img{display:block;max-width:100%;height:auto;max-height:16rem;margin:.75rem 0}
.q ol{list-style-type:upper-alpha}summary{cursor:pointer;font-weight:700}footer{color:#5b5e73;font-size:.9rem}math{font-size:1.05em}`;

interface Page {
  path: string;
  title: string;
  description: string;
  crumbs: { name: string; path: string }[];
  body: string;
}

function html(p: Page): Response {
  const url = SITE_ORIGIN + p.path;
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: p.crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: SITE_ORIGIN + c.path })),
  };
  const crumbs = p.crumbs.map((c, i) => (i === p.crumbs.length - 1 ? escape(c.name) : `<a href="${c.path}">${escape(c.name)}</a>`)).join(" › ");
  const page = `<!doctype html>
<html lang="en-IN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(p.title)}</title><meta name="description" content="${escape(p.description)}"><link rel="canonical" href="${url}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:type" content="website"><meta property="og:site_name" content="Vijayeemantra"><meta property="og:title" content="${escape(p.title)}">
<meta property="og:description" content="${escape(p.description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE_ORIGIN}/og/default.jpg">
<meta name="twitter:card" content="summary_large_image"><style>${STYLE}</style>
<script type="application/ld+json">${JSON.stringify(breadcrumbs).replace(/</g, "\\u003c")}</script></head>
<body><header><a href="/">Vijayeemantra</a></header><main><nav class="crumbs" aria-label="Breadcrumb">${crumbs}</nav>${p.body}</main>
<footer><a href="${classPath(9)}">CBSE Class 9</a> · <a href="${classPath(10)}">CBSE Class 10</a> · <a href="/quiz">Live quizzes</a> · <a href="/">Vijayeemantra home</a></footer></body></html>`;
  // Short, so a question that joins a live quiz soon stops being shown here.
  return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}

const CTA = `<p><a class="cta" href="/">Start practising free</a></p>`;
const home = { name: "Home", path: "/" };
const cbseClass = (grade: number) => `CBSE ${region.gradeLabel(grade)}`;
const link = (path: string, text: string) => `<li><a href="${path}">${escape(text)}</a></li>`;

function classPage(bank: Bank, grade: number): Response {
  const name = cbseClass(grade);
  const sections = subjectsOf(bank, grade).map((s) => {
    const chapters = chaptersOf(bank, grade, s).map((c) => link(chapterPath(c), c.title));
    return `<h2><a href="${subjectPath(grade, s)}">${region.subjects[s]}</a></h2><ul>${chapters.join("")}</ul>`;
  });
  const names = subjectsOf(bank, grade).map((s) => region.subjects[s]);
  return html({
    path: classPath(grade),
    title: `${name} Practice Questions, Chapter-wise | Vijayeemantra`,
    description: `Free chapter-wise practice questions for ${name}: ${names.join(", ")}. Answers come with explanations, plus learning games and live quizzes.`,
    crumbs: [home, { name, path: classPath(grade) }],
    body: `<h1>${name} practice questions</h1><p>Free chapter-wise practice for every ${name} subject here, with an explanation for each answer. Pick a chapter to see what it covers.</p>${CTA}${sections.join("")}`,
  });
}

function subjectPage(bank: Bank, grade: number, subject: SubjectId): Response {
  const name = `${cbseClass(grade)} ${region.subjects[subject]}`;
  const chapters = chaptersOf(bank, grade, subject);
  return html({
    path: subjectPath(grade, subject),
    title: `${name} Practice Questions, Chapter-wise | Vijayeemantra`,
    description: `Free ${name} practice: ${chapters.length} chapters, including ${chapters.slice(0, 3).map((c) => c.title).join(", ")}. Answers come with explanations.`,
    crumbs: [home, { name: cbseClass(grade), path: classPath(grade) }, { name: region.subjects[subject], path: subjectPath(grade, subject) }],
    body: `<h1>${name} practice questions</h1><p>Free practice for ${chapters.length} ${name} chapters, with an explanation for each answer.</p>${CTA}<h2>Chapters</h2><ul>${chapters.map((c) => link(chapterPath(c), c.title)).join("")}</ul>`,
  });
}

/** Contact address shown on the legal pages (also the Google Cloud developer contact). */
const CONTACT_EMAIL = "noveltratechnologies@gmail.com";

/** GET /privacy. Required for the Google OAuth consent screen, so kept short and plain. */
export function privacyPage(): Response {
  return html({
    path: "/privacy",
    title: "Privacy Policy | Vijayeemantra",
    description: "What Vijayeemantra collects when you sign in or practise, and how it is used.",
    crumbs: [home, { name: "Privacy Policy", path: "/privacy" }],
    body: `<h1>Privacy Policy</h1>
<p>Vijayeemantra ("the app") is run by Noveltra Technologies. This page explains what information we collect and how it is used.</p>
<h2>What we collect</h2>
<ul>
<li><strong>Google sign-in.</strong> If you sign in with Google, we receive your name, email address and profile picture from Google. We use this only to identify your account.</li>
<li><strong>Practice activity.</strong> We store the rounds, quizzes and games you play, your scores and your progress, so they can be shown back to you (and, for class quizzes, to your teacher) and used for leaderboards.</li>
<li><strong>Reported questions.</strong> If you report a question as wrong or unclear, we store what you reported so it can be fixed.</li>
</ul>
<p>We do not show ads and do not use third-party analytics or advertising trackers.</p>
<h2>How it is used</h2>
<p>Your data is used only to run the app: signing you in, saving your progress, running leaderboards and live quizzes, and improving the question bank from reports. We do not sell or share it with advertisers.</p>
<h2>Who can see it</h2>
<p>Your name and scores may be visible to other students on a leaderboard or in a quiz you join, and to a teacher who set up that quiz. Your email address is never shown to other students.</p>
<h2>How long we keep it</h2>
<p>We keep your account and progress until you ask us to delete them.</p>
<h2>Children's privacy</h2>
<p>Vijayeemantra is built for school students. We only collect what is needed to run the app (noted above), and a parent or guardian may contact us at any time using the details below to review or delete a student's data.</p>
<h2>Your choices</h2>
<p>You can use most of the app as a guest, without signing in. To have your account and data deleted, email us at the address below.</p>
<h2>Contact</h2>
<p>Questions about this policy or your data: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
<p>This policy may be updated from time to time; the date below is when it last changed.</p>
<p><em>Last updated: November 2026.</em></p>`,
  });
}

/** GET /terms. Required for the Google OAuth consent screen, so kept short and plain. */
export function termsPage(): Response {
  return html({
    path: "/terms",
    title: "Terms of Service | Vijayeemantra",
    description: "The terms for using Vijayeemantra.",
    crumbs: [home, { name: "Terms of Service", path: "/terms" }],
    body: `<h1>Terms of Service</h1>
<p>Vijayeemantra is run by Noveltra Technologies. By using the app, you agree to these terms.</p>
<h2>The app</h2>
<p>Vijayeemantra offers free practice questions, quizzes and games for school students. It is provided "as is", without warranty, and may change or be unavailable from time to time.</p>
<h2>Your account</h2>
<p>If you sign in, you are responsible for keeping your account secure and for the activity recorded under it. Accounts are for personal use by the student they belong to.</p>
<h2>Acceptable use</h2>
<p>Please use the app honestly: do not try to cheat leaderboards or quizzes, attempt to access other students' accounts or data, or disrupt the service.</p>
<h2>Content</h2>
<p>Practice questions and explanations are provided to help with learning and may occasionally contain errors; please report anything wrong so it can be fixed.</p>
<h2>Changes and termination</h2>
<p>We may update these terms, or suspend an account that misuses the app, at any time.</p>
<h2>Contact</h2>
<p>Questions about these terms: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
  });
}

const SAMPLES = 3;

/** A few questions that make sense on a page, one of each difficulty where possible. */
function samplesOf(c: Chapter, live: Set<string>): Extract<Question, { type: "mcq" }>[] {
  const fits = c.questions.filter((q): q is Extract<Question, { type: "mcq" }> => q.type === "mcq" && !live.has(q.id) && !q.image?.markers?.length && !NEEDS_PICTURE.test(q.prompt) && !q.options.some((o) => o.image));
  const picked = (["easy", "medium", "hard"] as const).flatMap((d) => fits.find((q) => q.difficulty === d) ?? []);
  for (const q of fits) if (picked.length < SAMPLES && !picked.includes(q)) picked.push(q);
  return picked.slice(0, SAMPLES);
}

const TOKEN = /(\$\$[\s\S]+?\$\$|\$[^$]+?\$|\*\*[^*]+?\*\*|\*[^*\s][^*]*?\*)/g;

/** The app's rich text ($maths$, **bold**, *italic*) as HTML. Maths is MathML, which browsers draw without KaTeX's fonts. */
async function rich(text: string): Promise<string> {
  const [{ default: katex }] = await Promise.all([import("katex"), import("katex/contrib/mhchem")]);
  const tex = (src: string, displayMode: boolean) => katex.renderToString(src, { displayMode, output: "mathml", throwOnError: false, strict: "ignore" });
  const parts = await Promise.all(
    text.split(TOKEN).map(async (part) => {
      if (!part) return "";
      if (part.startsWith("$$")) return tex(part.slice(2, -2), true);
      if (part.startsWith("$")) return tex(part.slice(1, -1), false);
      if (part.startsWith("**")) return `<strong>${await rich(part.slice(2, -2))}</strong>`;
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return `<em>${await rich(part.slice(1, -1))}</em>`;
      return escape(part);
    }),
  );
  return parts.join("");
}

async function sampleHtml(q: Extract<Question, { type: "mcq" }>): Promise<string> {
  const options = await Promise.all(q.options.map(async (o) => `<li>${await rich(o.text)}</li>`));
  const answerAt = q.options.findIndex((o) => o.id === q.answer);
  const answer = q.options[answerAt];
  const picture = q.image ? `<img src="${escape(q.image.src)}" alt="${escape(q.image.alt)}" loading="lazy">` : "";
  return `<div class="q"><p>${await rich(q.prompt)}</p>${picture}<ol>${options.join("")}</ol>
<details><summary>Show the answer</summary><p><strong>${String.fromCharCode(65 + answerAt)}. ${answer ? await rich(answer.text) : ""}</strong></p><p>${await rich(q.explanation)}</p></details></div>`;
}

async function chapterPage(env: Env, bank: Bank, c: Chapter): Promise<Response> {
  const live = await liveQuizQuestions(env);
  const name = `${cbseClass(c.grade)} ${region.subjects[c.subject]}`;
  const topics = [...new Set(c.questions.map((q) => q.topic))];
  const samples = await Promise.all(samplesOf(c, live).map(sampleHtml));
  const others = chaptersOf(bank, c.grade, c.subject).filter((o) => o.key !== c.key);
  return html({
    path: chapterPath(c),
    title: `${c.title}: ${name} Practice Questions | Vijayeemantra`,
    description: `Free ${name} practice for ${c.title}: ${c.questions.length} questions on ${topics.slice(0, 3).join(", ")} and more, with an explanation for each answer.`,
    crumbs: [
      home,
      { name: cbseClass(c.grade), path: classPath(c.grade) },
      { name: region.subjects[c.subject], path: subjectPath(c.grade, c.subject) },
      { name: c.title, path: chapterPath(c) },
    ],
    body: `<h1>${escape(c.title)}: ${name} practice questions</h1>
<p>Practise ${c.questions.length} questions on ${escape(c.title)}, free, with an explanation for each answer.</p>${CTA}
${samples.length ? `<h2>Sample questions</h2>${samples.join("")}` : ""}
<h2>Topics covered</h2><ul>${topics.map((t) => `<li>${escape(t)}</li>`).join("")}</ul>${CTA}
${others.length ? `<h2>More ${name} chapters</h2><ul>${others.map((o) => link(chapterPath(o), o.title)).join("")}</ul>` : ""}`,
  });
}

/** GET /cbse/class-N[/subject[/chapter]], or null if there is no such page. */
export async function cbsePage(env: Env, grade: number, subject: string | undefined, chapter: string | undefined): Promise<Response | null> {
  const bank = await loadBank(env);
  if (!classesOf(bank).includes(grade)) return null;
  if (subject === undefined) return classPage(bank, grade);
  if (!subjectsOf(bank, grade).includes(subject as SubjectId)) return null;
  if (chapter === undefined) return subjectPage(bank, grade, subject as SubjectId);
  const c = chaptersOf(bank, grade, subject as SubjectId).find((x) => slug(x.title) === chapter);
  return c ? chapterPage(env, bank, c) : null;
}
