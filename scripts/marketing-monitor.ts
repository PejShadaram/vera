/**
 * Vera Marketing Monitor
 *
 * Scans Reddit for posts where people need help with legal self-representation,
 * then drafts contextual, helpful replies that naturally mention Vera.
 *
 * Run: npx tsx scripts/marketing-monitor.ts
 * Run daily: npx tsx scripts/marketing-monitor.ts --output queue.md
 *
 * Posts manually — never automated. Reddit bans bots; authentic replies convert better.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Subreddits and keywords to monitor ────────────────────────────────────────

const SUBREDDITS = [
  "divorce",
  "legaladvice",
  "ProSe",
  "TenantRights",
  "Custody",
  "FamilyLaw",
  "domesticviolence",
  "smallclaims",
];

const INTENT_KEYWORDS = [
  "representing myself",
  "pro se",
  "self-represented",
  "no lawyer",
  "can't afford attorney",
  "affordable lawyer",
  "organize documents",
  "track evidence",
  "court documents",
  "keep track of",
  "going to court alone",
  "filing myself",
  "without an attorney",
  "how do I organize",
  "what should I document",
  "how to prepare for court",
  "keep a record",
];

// ── Reddit RSS fetch ───────────────────────────────────────────────────────────

interface RedditPost {
  id:        string;
  title:     string;
  selftext:  string;
  url:       string;
  permalink: string;
  subreddit: string;
  score:     number;
  created:   number;
  num_comments: number;
}

async function fetchSubredditPosts(subreddit: string, limit = 25): Promise<RedditPost[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`,
      { headers: { "User-Agent": "VeraLegalTool/1.0 (legal case management app)" } }
    );
    if (!res.ok) return [];
    const data = await res.json() as { data: { children: { data: RedditPost }[] } };
    return data.data.children.map(c => c.data);
  } catch {
    return [];
  }
}

function isRelevant(post: RedditPost): boolean {
  const text = `${post.title} ${post.selftext}`.toLowerCase();
  return INTENT_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
}

function ageHours(created: number): number {
  return (Date.now() / 1000 - created) / 3600;
}

// ── Draft reply with Claude ────────────────────────────────────────────────────

async function draftReply(post: RedditPost): Promise<string> {
  const prompt = `You are helping the founder of Vera (veracase.app) respond to a Reddit post.
They built Vera after going through their own divorce without an attorney. They know firsthand how hard it is to stay organized when you're representing yourself in court.

Vera is a case management tool for self-represented litigants:
- Free: timeline, tasks, deadlines, evidence tracking, document storage
- $49 one-time unlock per case: AI reads your documents, extracts your timeline and evidence, gives you a case analysis (Vera's Take), lets you ask questions about your case, and generates drafts of declarations, demand letters, police statements
- Not legal advice. Not a law firm. Just organization and AI analysis.

Reddit post from r/${post.subreddit}:
Title: ${post.title}
Body: ${post.selftext?.slice(0, 800) || "(no body)"}

Write a helpful Reddit reply that:
1. FIRST genuinely helps with their specific question — give real, useful advice relevant to their situation. Don't lead with the product.
2. Briefly mentions Vera naturally at the end — only if it's actually relevant to what they asked (e.g., "I built something for this exact situation" or "something that might help with the organization side")
3. Sounds like a real person, not a marketer. Casual, empathetic, direct.
4. Is 3-6 sentences. No bullet points. No headers.
5. Does NOT say "I built an app called Vera" in the first sentence — earn the mention.

If the post isn't actually relevant to what Vera does (e.g., asking a pure legal question about statutes), just write a helpful reply without mentioning Vera at all.

Write only the reply text. No preamble.`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  return (msg.content[0] as { text: string }).text.trim();
}

// ── Founder post templates ─────────────────────────────────────────────────────

const FOUNDER_POSTS = [
  {
    subreddit: "r/ProSe",
    title: "I built a free tool for self-represented litigants after going through my own divorce without an attorney",
    body: `Going through a contested divorce without a lawyer is brutal — not because the law is impossible to navigate, but because staying organized is. Keeping track of 200 emails, 40 documents, a dozen court dates, and a timeline that spans years, all while dealing with the emotional weight of it, is where most people fall apart.

I built Vera (veracase.app) to solve exactly that. It's free to use for case organization — timeline, evidence log, tasks, deadlines. The AI layer (document processing, case analysis, chat about your case) is a one-time $49 unlock per case, no subscription.

If you're representing yourself and feel buried in paperwork, give it a try. Happy to answer any questions about what it can and can't do.`,
  },
  {
    subreddit: "r/Divorce",
    title: "Free tool I built for organizing a divorce case when you can't afford a lawyer",
    body: `After going through a divorce without an attorney, I realized the hardest part wasn't the legal process — it was the organization. Evidence, emails, financial records, court dates, the timeline of what happened when. I was managing all of it in Google Docs and constantly losing track of things.

Built Vera (veracase.app) to handle that. You can organize your entire case for free — upload documents, build a timeline, track evidence, set deadline reminders. For $49 one-time, the AI reads everything you've uploaded and gives you an analysis: what it sees, what might be missing, what to do next. You can also ask it questions about your own case.

It's not legal advice and it's not a lawyer. It's the organization layer that makes you less overwhelmed. Nothing like it existed when I needed it.`,
  },
  {
    subreddit: "r/legaladvice",
    title: "Built a free case management tool for people representing themselves — not legal advice, just organization",
    body: `Mods — please remove if this isn't appropriate, genuinely not trying to spam.

I built Vera (veracase.app) after going through my own legal situation without an attorney. It's a case management tool for self-represented litigants: organize documents, build a timeline, track evidence, set deadline reminders. The AI layer processes your documents and gives you a case analysis — but it's explicitly not legal advice, just AI reading your own documents.

Free to use for organization. $49 one-time to unlock the AI on a case. No subscription.

If you're someone who regularly sees people overwhelmed by going pro se and looking for organizational help, I'd welcome the feedback on whether this is actually useful.`,
  },
];

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const outputFile = process.argv.includes("--output")
    ? process.argv[process.argv.indexOf("--output") + 1]
    : null;

  console.log("🔍 Scanning Reddit for relevant posts...\n");

  const allPosts: RedditPost[] = [];
  for (const sub of SUBREDDITS) {
    const posts = await fetchSubredditPosts(sub);
    allPosts.push(...posts.filter(p => isRelevant(p) && ageHours(p.created) < 48));
    process.stdout.write(`  r/${sub}: ${posts.filter(p => isRelevant(p) && ageHours(p.created) < 48).length} relevant\n`);
  }

  // Sort by score + recency
  const sorted = allPosts
    .sort((a, b) => (b.score + b.num_comments * 2) - (a.score + a.num_comments * 2))
    .slice(0, 8);

  if (sorted.length === 0) {
    console.log("\nNo relevant posts found in the last 48 hours. Check back tomorrow.");
    return;
  }

  console.log(`\n✓ Found ${sorted.length} reply opportunities. Drafting responses...\n`);

  const lines: string[] = [
    `# Vera Marketing Queue — ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
    "",
    "## Reply Opportunities",
    "",
  ];

  for (let i = 0; i < sorted.length; i++) {
    const post = sorted[i];
    process.stdout.write(`  Drafting reply ${i + 1}/${sorted.length}...`);
    const reply = await draftReply(post);
    process.stdout.write(" done\n");

    const age = ageHours(post.created);
    const ageStr = age < 1 ? `${Math.round(age * 60)}m ago` : `${Math.round(age)}h ago`;

    lines.push(`### ${i + 1}. r/${post.subreddit} · ${ageStr} · ↑${post.score} · ${post.num_comments} comments`);
    lines.push(`**Title:** ${post.title}`);
    lines.push(`**Link:** https://reddit.com${post.permalink}`);
    lines.push("");
    lines.push("**Drafted reply:**");
    lines.push("");
    lines.push(reply);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Append founder post templates
  lines.push("## Founder Posts (ready to post)");
  lines.push("");
  lines.push("Post these once each — don't repeat in the same community.");
  lines.push("");
  for (const p of FOUNDER_POSTS) {
    lines.push(`### ${p.subreddit}`);
    lines.push(`**Title:** ${p.title}`);
    lines.push("");
    lines.push(p.body);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  const output = lines.join("\n");

  if (outputFile) {
    fs.writeFileSync(outputFile, output);
    console.log(`\n✓ Queue saved to ${outputFile}`);
  } else {
    console.log("\n" + output);
  }
}

main().catch(console.error);
