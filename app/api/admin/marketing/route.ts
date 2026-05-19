import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAdminUser } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUBREDDITS = ["divorce","legaladvice","ProSe","TenantRights","FamilyLaw","smallclaims"];
const KEYWORDS   = ["representing myself","pro se","self-represented","no lawyer","can't afford attorney",
  "organize documents","track evidence","court documents","how do I organize","without an attorney",
  "how to prepare for court","keep a record","going to court alone"];

interface RedditPost {
  id: string; title: string; selftext: string; permalink: string;
  subreddit: string; score: number; created: number; num_comments: number;
}

async function fetchPosts(subreddit: string): Promise<RedditPost[]> {
  try {
    const res = await fetch(`https://www.reddit.com/r/${subreddit}/new.json?limit=25`,
      { headers: { "User-Agent": "VeraLegalTool/1.0" } });
    if (!res.ok) return [];
    const data = await res.json() as { data: { children: { data: RedditPost }[] } };
    return data.data.children.map(c => c.data);
  } catch { return []; }
}

function ageHours(ts: number) { return (Date.now() / 1000 - ts) / 3600; }

async function draftReply(post: RedditPost): Promise<string> {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    messages: [{ role: "user", content: `You are helping the founder of Vera (veracase.app) respond to a Reddit post. They built Vera after going through their own divorce without an attorney. Vera is free for case organization; $49 one-time per case unlocks AI (document processing, case analysis, chat, drafts).

Post from r/${post.subreddit}:
Title: ${post.title}
Body: ${(post.selftext ?? "").slice(0, 600)}

Write a 3-5 sentence helpful Reddit reply. Lead with genuinely useful advice. Mention Vera naturally at the end only if truly relevant. Sound like a real person, not a marketer. No bullet points or headers. Write only the reply text.` }],
  });
  return (msg.content[0] as { text: string }).text.trim();
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await isAdminUser(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allPosts: RedditPost[] = [];
  for (const sub of SUBREDDITS) {
    const posts = await fetchPosts(sub);
    allPosts.push(...posts.filter(p => {
      const text = `${p.title} ${p.selftext}`.toLowerCase();
      return KEYWORDS.some(kw => text.includes(kw)) && ageHours(p.created) < 48;
    }));
  }

  const sorted = allPosts
    .sort((a, b) => (b.score + b.num_comments * 2) - (a.score + a.num_comments * 2))
    .slice(0, 6);

  const opportunities = await Promise.all(sorted.map(async post => ({
    id:          post.id,
    subreddit:   post.subreddit,
    title:       post.title,
    permalink:   `https://reddit.com${post.permalink}`,
    score:       post.score,
    comments:    post.num_comments,
    ageHours:    Math.round(ageHours(post.created)),
    draftReply:  await draftReply(post),
  })));

  return NextResponse.json({ opportunities, scanned: SUBREDDITS.length, generatedAt: new Date().toISOString() });
}
