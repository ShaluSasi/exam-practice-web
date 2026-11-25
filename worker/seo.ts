/**
 * What search engines read: the main address, robots.txt, sitemap.xml and a
 * plain page for each class, subject and chapter under /cbse/. Those pages are
 * written here as HTML, so they can be read without running the app, and they
 * send visitors on to the app to practise.
 */
import { region } from "../src/config/regions";
import type { Question, SubjectId } from "../src/content/schema";
import { NEEDS_PICTURE, PICTURE_NAME, loadBank, type Bank } from "./content";
import { SITE_ORIGIN, type Env } from "./http";
import { CHAPTER_INTROS } from "./intros";
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

/** A file, or the app at one of its private addresses. Any other address is a 404 page with links to the classes. */
export async function appPage(request: Request, env: Env, url: URL): Promise<Response> {
  const res = await env.ASSETS.fetch(request);
  if (!res.headers.get("Content-Type")?.includes("text/html")) return res;
  if (!PRIVATE_PAGE.test(url.pathname)) return notFoundPage();
  const headers = new Headers(res.headers);
  headers.set("X-Robots-Tag", "noindex");
  return new Response(res.body, { status: 200, headers });
}

function notFoundPage(): Response {
  const links = [9, 10].map((g) => link(classPath(g), `${cbseClass(g)} practice questions`)).join("");
  return html(
    {
      path: "/404",
      title: "Page not found | Vijayeemantra",
      description: "This page does not exist. Find free CBSE Class 9 and 10 practice questions here.",
      crumbs: [home, { name: "Page not found", path: "/404" }],
      body: `<h1>Page not found</h1><p>This page doesn't exist, or it has moved. Try one of these:</p><ul>${links}${link("/quiz", "Live quizzes")}${link("/", "Vijayeemantra home")}</ul>`,
    },
    404,
  );
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

/** The school subjects that the app splits up. Students search for these names. */
const GROUPS: { id: string; name: string; subjects: SubjectId[] }[] = [
  { id: "science", name: "Science", subjects: ["physics", "chemistry", "biology"] },
  { id: "social-science", name: "Social Science", subjects: ["history", "geography", "politics", "economics"] },
];
const groupOf = (s: SubjectId) => GROUPS.find((g) => g.subjects.includes(s));
const groupPath = (grade: number, id: string) => `${classPath(grade)}/${id}`;
/** A subject's everyday name, as students search for it. */
const subjectName = (s: SubjectId) => (s === "maths" ? "Maths" : region.subjects[s]);
/** The school subject a chapter is searched under: "Science" for a physics chapter. */
const schoolSubject = (s: SubjectId) => groupOf(s)?.name ?? subjectName(s);

const groupsOf = (bank: Bank, grade: number) => GROUPS.filter((g) => g.subjects.some((s) => chaptersOf(bank, grade, s).length > 0));

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
    for (const g of groupsOf(bank, grade)) paths.push(groupPath(grade, g.id));
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
.q ol{list-style-type:upper-alpha}nav.near{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.5rem 1.5rem;margin:2rem 0 0}summary{cursor:pointer;font-weight:700}footer{color:#5b5e73;font-size:.9rem}math{font-size:1.05em}`;

interface Page {
  path: string;
  title: string;
  description: string;
  crumbs: { name: string; path: string }[];
  body: string;
}

/** Search results show about 160 characters of a description; a longer one is cut at a word. */
function shortened(text: string, max = 160): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/[\s,;:.]+\S*$/, "")}…`;
}

/** A title with the site's name after it, if there is room: search results cut long titles. */
const titled = (text: string) => (text.length <= 48 ? `${text} | Vijayeemantra` : text);

function html(p: Page, status = 200): Response {
  const url = SITE_ORIGIN + p.path;
  const found = status === 200;
  const description = shortened(p.description);
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: p.crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: SITE_ORIGIN + c.path })),
  };
  const crumbs = p.crumbs.map((c, i) => (i === p.crumbs.length - 1 ? escape(c.name) : `<a href="${c.path}">${escape(c.name)}</a>`)).join(" › ");
  const page = `<!doctype html>
<html lang="en-IN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(p.title)}</title><meta name="description" content="${escape(description)}">${found ? `<link rel="canonical" href="${url}">` : `<meta name="robots" content="noindex">`}
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:type" content="website"><meta property="og:site_name" content="Vijayeemantra"><meta property="og:title" content="${escape(p.title)}">
<meta property="og:description" content="${escape(description)}">${found ? `<meta property="og:url" content="${url}">` : ""}<meta property="og:image" content="${SITE_ORIGIN}/og/default.jpg">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(p.title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${SITE_ORIGIN}/og/default.jpg"><style>${STYLE}</style>
${found ? `<script type="application/ld+json">${JSON.stringify(breadcrumbs).replace(/</g, "\\u003c")}</script>` : ""}</head>
<body><header><a href="/">Vijayeemantra</a></header><main><nav class="crumbs" aria-label="Breadcrumb">${crumbs}</nav>${p.body}</main>
<footer><a href="${classPath(9)}">CBSE Class 9</a> · <a href="${classPath(10)}">CBSE Class 10</a> · <a href="/quiz">Live quizzes</a> · <a href="/">Vijayeemantra home</a></footer></body></html>`;
  // Short, so a question that joins a live quiz soon stops being shown here.
  return new Response(page, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": found ? "public, max-age=300" : "no-store", ...(found ? {} : { "X-Robots-Tag": "noindex" }) },
  });
}

const CTA = `<p><a class="cta" href="/">Start practising free</a></p>`;
/** Opens the app on this chapter (src/store/nav.ts). Not a page of its own, so search engines need not follow it. */
const chapterCta = (c: Chapter) => `<p><a class="cta" rel="nofollow" href="/?practice=${encodeURIComponent(c.key)}">Practise this chapter free</a></p>`;
const home = { name: "Home", path: "/" };
const cbseClass = (grade: number) => `CBSE ${region.gradeLabel(grade)}`;
const link = (path: string, text: string) => `<li><a href="${path}">${escape(text)}</a></li>`;

function classPage(bank: Bank, grade: number): Response {
  const name = cbseClass(grade);
  const sections = subjectsOf(bank, grade).map((s) => chapterSection(bank, grade, s));
  const groups = groupsOf(bank, grade).map((g) => link(groupPath(grade, g.id), `${name} ${g.name}: all chapters`));
  return html({
    path: classPath(grade),
    title: titled(`${name} MCQs with Answers, Chapter-wise`),
    description: `Free chapter-wise MCQs with answers and explanations for ${name} Maths, Science, Social Science and English.`,
    crumbs: [home, { name, path: classPath(grade) }],
    body: `<h1>${name} MCQs and practice questions</h1><p>Free chapter-wise practice for every ${name} subject here, with an explanation for each answer. Pick a chapter to see what it covers.</p>${CTA}<ul>${groups.join("")}</ul>${sections.join("")}`,
  });
}

/** A subject's heading and its chapters, on the pages that list several subjects. */
function chapterSection(bank: Bank, grade: number, s: SubjectId): string {
  const chapters = chaptersOf(bank, grade, s).map((c) => link(chapterPath(c), c.title));
  return `<h2><a href="${subjectPath(grade, s)}">${subjectName(s)}</a></h2><ul>${chapters.join("")}</ul>`;
}

/** Science or Social Science: every chapter of the subjects in it. */
function groupPage(bank: Bank, grade: number, group: (typeof GROUPS)[number]): Response {
  const name = `${cbseClass(grade)} ${group.name}`;
  const subjects = group.subjects.filter((s) => chaptersOf(bank, grade, s).length > 0);
  const count = subjects.reduce((n, s) => n + chaptersOf(bank, grade, s).length, 0);
  return html({
    path: groupPath(grade, group.id),
    title: titled(`${name} MCQs with Answers`),
    description: `Free ${name} MCQs with answers and explanations: ${count} chapters of ${subjects.map(subjectName).join(", ")}.`,
    crumbs: [home, { name: cbseClass(grade), path: classPath(grade) }, { name: group.name, path: groupPath(grade, group.id) }],
    body: `<h1>${name} MCQs with answers</h1><p>Free practice for ${count} ${name} chapters in ${subjects.map(subjectName).join(", ")}, with an explanation for each answer.</p>${CTA}${subjects.map((s) => chapterSection(bank, grade, s)).join("")}`,
  });
}

/** Breadcrumbs down to a subject. */
function subjectCrumbs(grade: number, s: SubjectId) {
  const group = groupOf(s);
  return [
    home,
    { name: cbseClass(grade), path: classPath(grade) },
    ...(group ? [{ name: group.name, path: groupPath(grade, group.id) }] : []),
    { name: subjectName(s), path: subjectPath(grade, s) },
  ];
}

function subjectPage(bank: Bank, grade: number, subject: SubjectId): Response {
  const name = `${cbseClass(grade)} ${subjectName(subject)}`;
  const chapters = chaptersOf(bank, grade, subject);
  return html({
    path: subjectPath(grade, subject),
    title: titled(`${name} MCQs with Answers`),
    description: `Free ${name} MCQs with answers and explanations for ${chapters.length} chapters, including ${chapters.slice(0, 2).map((c) => c.title).join(" and ")}.`,
    crumbs: subjectCrumbs(grade, subject),
    body: `<h1>${name} MCQs with answers</h1><p>Free practice for ${chapters.length} ${name} chapters, with an explanation for each answer.</p>${CTA}<h2>Chapters</h2><ul>${chapters.map((c) => link(chapterPath(c), c.title)).join("")}</ul>`,
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

type Mcq = Extract<Question, { type: "mcq" }>;
type AssertionReason = Extract<Question, { type: "assertion_reason" }>;

/** Questions shown on a chapter's page. The rest stay in the app. */
const SAMPLES = { mcq: 6, assertionReason: 2 };

/** A few of `fits`, one of each difficulty first, then preferring topics not shown yet; easiest first. */
function pick<Q extends Question>(fits: Q[], count: number): Q[] {
  const picked = (["easy", "medium", "hard"] as const).flatMap((d) => fits.find((q) => q.difficulty === d) ?? []);
  const topics = new Set(picked.map((q) => q.topic));
  for (const q of fits) {
    if (picked.length >= count) break;
    if (picked.includes(q) || topics.has(q.topic)) continue;
    picked.push(q);
    topics.add(q.topic);
  }
  for (const q of fits) if (picked.length < count && !picked.includes(q)) picked.push(q);
  const order = ["easy", "medium", "hard"];
  return picked.slice(0, count).sort((a, b) => order.indexOf(a.difficulty) - order.indexOf(b.difficulty));
}

/** Questions that make sense on a page, without tapping a picture. */
function samplesOf(c: Chapter, live: Set<string>): { mcqs: Mcq[]; assertionReason: AssertionReason[] } {
  const fits = c.questions.filter((q) => !live.has(q.id) && !q.image?.markers?.length && !NEEDS_PICTURE.test(q.prompt));
  const mcqs = fits.filter((q): q is Mcq => q.type === "mcq" && !q.options.some((o) => o.image || PICTURE_NAME.test(o.text.trim())));
  const pairs = fits.filter((q): q is AssertionReason => q.type === "assertion_reason" && !NEEDS_PICTURE.test(`${q.assertion} ${q.reason}`));
  return { mcqs: pick(mcqs, SAMPLES.mcq), assertionReason: pick(pairs, SAMPLES.assertionReason) };
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

async function sampleHtml(q: Mcq | AssertionReason): Promise<string> {
  const choices = q.type === "mcq" ? q.options : region.assertionReasonOptions;
  const options = await Promise.all(choices.map(async (o) => `<li>${await rich(o.text)}</li>`));
  const answerAt = choices.findIndex((o) => o.id === q.answer);
  const answer = choices[answerAt];
  const picture = q.image ? `<img src="${escape(q.image.src)}" alt="${escape(q.image.alt)}" loading="lazy">` : "";
  const text =
    q.type === "mcq"
      ? `<p>${await rich(q.prompt)}</p>`
      : `<p><strong>Assertion (A):</strong> ${await rich(q.assertion)}</p><p><strong>Reason (R):</strong> ${await rich(q.reason)}</p>`;
  return `<div class="q">${text}${picture}<ol>${options.join("")}</ol>
<details><summary>Show the answer</summary><p><strong>${String.fromCharCode(65 + answerAt)}. ${answer ? await rich(answer.text) : ""}</strong></p><p>${await rich(q.explanation)}</p></details></div>`;
}

const TYPE_NAMES: Record<Question["type"], string> = {
  mcq: "MCQs",
  multi: "questions with more than one right answer",
  numeric: "numerical questions",
  assertion_reason: "assertion–reason questions",
  match: "match-the-following questions",
  order: "put-in-order questions",
  hotspot: "picture questions",
};

/** What the app has for a chapter: how many questions, of which kinds and difficulty. */
function practiceText(c: Chapter): string {
  const kinds = (Object.keys(TYPE_NAMES) as Question["type"][]).flatMap((t) => {
    const n = c.questions.filter((q) => q.type === t).length;
    return n ? [`${n} ${TYPE_NAMES[t]}`] : [];
  });
  const level = (d: Question["difficulty"]) => c.questions.filter((q) => q.difficulty === d).length;
  return `Vijayeemantra has ${c.questions.length} free questions on this chapter: ${kinds.slice(0, -1).join(", ")}${kinds.length > 1 ? " and " : ""}${kinds.at(-1) ?? ""}. ${level("easy")} are easy, ${level("medium")} moderate and ${level("hard")} hard, and every answer comes with an explanation. Try the samples below first.`;
}

async function chapterPage(env: Env, bank: Bank, c: Chapter): Promise<Response> {
  const live = await liveQuizQuestions(env);
  const name = `${cbseClass(c.grade)} ${subjectName(c.subject)}`;
  const searched = `${region.gradeLabel(c.grade)} ${schoolSubject(c.subject)}`;
  const topics = [...new Set(c.questions.map((q) => q.topic))];
  const { mcqs, assertionReason } = samplesOf(c, live);
  const [mcqHtml, pairHtml] = await Promise.all([Promise.all(mcqs.map(sampleHtml)), Promise.all(assertionReason.map(sampleHtml))]);
  const chapters = chaptersOf(bank, c.grade, c.subject);
  const at = chapters.findIndex((o) => o.key === c.key);
  const [before, after] = [chapters[at - 1], chapters[at + 1]];
  const others = chapters.filter((o) => o.key !== c.key);
  const near = `${before ? `<a rel="prev" href="${chapterPath(before)}">← Previous: ${escape(before.title)}</a>` : "<span></span>"}${after ? `<a rel="next" href="${chapterPath(after)}">Next: ${escape(after.title)} →</a>` : ""}`;
  return html({
    path: chapterPath(c),
    title: titled(`${c.title} ${searched} MCQs with Answers`),
    description: `${c.title}: free CBSE ${searched} MCQs with answers and explanations. ${c.questions.length} questions on ${topics.slice(0, 3).join(", ")} and more.`,
    crumbs: [...subjectCrumbs(c.grade, c.subject), { name: c.title, path: chapterPath(c) }],
    body: `<h1>${escape(c.title)}: ${name} MCQs with answers</h1>
<p>${escape(CHAPTER_INTROS[c.key] ?? "")}</p><p>${escape(practiceText(c))}</p>${chapterCta(c)}
${mcqHtml.length ? `<h2>MCQs with answers</h2>${mcqHtml.join("")}` : ""}
${pairHtml.length ? `<h2>Assertion–reason questions with answers</h2>${pairHtml.join("")}` : ""}
<h2>Topics covered</h2><ul>${topics.map((t) => `<li>${escape(t)}</li>`).join("")}</ul>${chapterCta(c)}
<nav class="near" aria-label="Nearby chapters">${near}</nav>
${others.length ? `<h2>More ${name} chapters</h2><ul>${others.map((o) => link(chapterPath(o), o.title)).join("")}</ul>` : ""}`,
  });
}

/** GET /cbse/class-N[/subject[/chapter]], or null if there is no such page. */
export async function cbsePage(env: Env, grade: number, subject: string | undefined, chapter: string | undefined): Promise<Response | null> {
  const bank = await loadBank(env);
  if (!classesOf(bank).includes(grade)) return null;
  if (subject === undefined) return classPage(bank, grade);
  const group = groupsOf(bank, grade).find((g) => g.id === subject);
  if (group) return chapter === undefined ? groupPage(bank, grade, group) : null;
  if (!subjectsOf(bank, grade).includes(subject as SubjectId)) return null;
  if (chapter === undefined) return subjectPage(bank, grade, subject as SubjectId);
  const c = chaptersOf(bank, grade, subject as SubjectId).find((x) => slug(x.title) === chapter);
  return c ? chapterPage(env, bank, c) : null;
}
