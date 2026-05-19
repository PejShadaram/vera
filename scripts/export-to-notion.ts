/**
 * Exports the manual testing library to Notion.
 *
 * Setup:
 *   1. Create a Notion integration at notion.com/my-integrations
 *   2. Copy the integration token (secret_...)
 *   3. Share your target Notion page with the integration
 *   4. Copy the page ID from the URL (32 hex chars after the last dash)
 *
 * Usage:
 *   NOTION_TOKEN=secret_xxx NOTION_PARENT_ID=abc123... npx tsx scripts/export-to-notion.ts
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const TOKEN     = process.env.NOTION_TOKEN;
const PARENT_ID = process.env.NOTION_PARENT_ID;

if (!TOKEN || !PARENT_ID) {
  console.error("Usage: NOTION_TOKEN=secret_... NOTION_PARENT_ID=<page-id> npx tsx scripts/export-to-notion.ts");
  process.exit(1);
}

const HEADERS = {
  "Authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
};

// ── Notion API helpers ──────────────────────────────────────────────────────

async function createPage(parentId: string, title: string, blocks: object[]) {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      parent: { page_id: parentId },
      properties: { title: { title: [{ text: { content: title } }] } },
      children: blocks.slice(0, 100), // Notion API limit per request
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create page "${title}": ${err}`);
  }
  const data = await res.json() as { id: string };

  // Append remaining blocks if any (Notion limits to 100 per request)
  if (blocks.length > 100) {
    await appendBlocks(data.id, blocks.slice(100));
  }

  return data.id;
}

async function appendBlocks(pageId: string, blocks: object[]) {
  for (let i = 0; i < blocks.length; i += 100) {
    const chunk = blocks.slice(i, i + 100);
    const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ children: chunk }),
    });
    if (!res.ok) throw new Error(`Failed to append blocks: ${await res.text()}`);
  }
}

// ── Markdown → Notion blocks ────────────────────────────────────────────────

function mdToBlocks(markdown: string): object[] {
  const lines = markdown.split("\n");
  const blocks: object[] = [];
  let inList = false;
  let inNumberedList = false;
  let inTable = false;
  let tableHeaders: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines (reset list context)
    if (!trimmed) {
      inList = false;
      inNumberedList = false;
      if (!inTable) blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [] } });
      continue;
    }

    // Table separator — skip
    if (/^\|[-| ]+\|$/.test(trimmed)) continue;

    // Table row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.slice(1, -1).split("|").map(c => c.trim());
      if (!inTable) {
        // First row = headers
        inTable = true;
        tableHeaders = cells;
        // Create a callout with the table as text (Notion free plan doesn't support inline table creation easily)
        blocks.push({
          object: "block", type: "callout",
          callout: {
            rich_text: [{ type: "text", text: { content: cells.join(" | ") } }],
            icon: { emoji: "📋" },
            color: "gray_background",
          },
        });
      } else {
        const rowText = cells.map((c, idx) => `${tableHeaders[idx] ?? ""}: ${c}`).join("  ·  ");
        blocks.push({
          object: "block", type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [{ type: "text", text: { content: rowText } }],
          },
        });
      }
      continue;
    } else {
      inTable = false;
    }

    // H1
    if (trimmed.startsWith("# ")) {
      blocks.push({ object: "block", type: "heading_1", heading_1: { rich_text: parseInline(trimmed.slice(2)) } });
      continue;
    }

    // H2
    if (trimmed.startsWith("## ")) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: parseInline(trimmed.slice(3)) } });
      continue;
    }

    // H3
    if (trimmed.startsWith("### ")) {
      blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: parseInline(trimmed.slice(4)) } });
      continue;
    }

    // Horizontal rule → divider
    if (trimmed === "---") {
      blocks.push({ object: "block", type: "divider", divider: {} });
      continue;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s(.+)/);
    if (numberedMatch) {
      blocks.push({
        object: "block", type: "numbered_list_item",
        numbered_list_item: { rich_text: parseInline(numberedMatch[2]) },
      });
      inNumberedList = true;
      continue;
    }

    // Checkbox list item (- [ ] or - [x])
    if (trimmed.match(/^- \[[ x]\]/i)) {
      const checked = trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]");
      const text = trimmed.replace(/^- \[[ xX]\]\s*/, "");
      blocks.push({
        object: "block", type: "to_do",
        to_do: { rich_text: parseInline(text), checked },
      });
      continue;
    }

    // Bullet list
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push({
        object: "block", type: "bulleted_list_item",
        bulleted_list_item: { rich_text: parseInline(trimmed.slice(2)) },
      });
      inList = true;
      continue;
    }

    // Bold standalone line (priority markers like **P0**)
    // Regular paragraph
    blocks.push({
      object: "block", type: "paragraph",
      paragraph: { rich_text: parseInline(trimmed) },
    });
  }

  return blocks;
}

function parseInline(text: string): object[] {
  const parts: object[] = [];
  // Simple regex to handle **bold**, `code`, and plain text
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|[^`*]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const chunk = match[1];
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      parts.push({ type: "text", text: { content: chunk.slice(2, -2) }, annotations: { bold: true } });
    } else if (chunk.startsWith("`") && chunk.endsWith("`")) {
      parts.push({ type: "text", text: { content: chunk.slice(1, -1) }, annotations: { code: true } });
    } else if (chunk) {
      parts.push({ type: "text", text: { content: chunk } });
    }
  }
  return parts.length ? parts : [{ type: "text", text: { content: text } }];
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const manualDir = join(process.cwd(), "tests", "manual");
  const files = readdirSync(manualDir).filter(f => f.endsWith(".md")).sort();

  console.log(`\nExporting ${files.length} files to Notion...\n`);

  // Create a parent "Vera Manual Regression" page under the target page
  const indexMd = readFileSync(join(manualDir, "README.md"), "utf8");
  const indexBlocks = mdToBlocks(indexMd);
  const indexPageId = await createPage(PARENT_ID!, "Vera Manual Regression Library", indexBlocks);
  console.log(`✓ Created index page`);

  // Create a child page for each test file (skip README)
  for (const file of files) {
    if (file === "README.md") continue;
    const md   = readFileSync(join(manualDir, file), "utf8");
    const title = md.split("\n")[0].replace(/^#\s*/, ""); // first heading = title
    const blocks = mdToBlocks(md);
    await createPage(indexPageId, title, blocks);
    console.log(`✓ ${file} → "${title}"`);
    await new Promise(r => setTimeout(r, 350)); // rate limit: ~3 req/sec
  }

  console.log(`\n✅ Done! Open Notion and find "Vera Manual Regression Library" under your target page.\n`);
}

main().catch(e => { console.error("\n✗ Export failed:", e.message); process.exit(1); });
