/**
 * Vera demo data seeder
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts <email>           # seed under that user (dev DB)
 *   npx tsx scripts/seed-demo.ts <email> --prod    # seed in production DB
 *   npx tsx scripts/seed-demo.ts <email> --clear   # delete existing demo cases first
 *
 * What it does:
 *   1. Finds the user by email in the users table
 *   2. Sets is_admin = true so all AI features work unlocked
 *   3. Creates 6 demo cases (one per case type) with full data:
 *      — 8-12 timeline entries per case
 *      — 4-6 evidence items per case
 *      — 4-5 tasks per case
 *      — 2-3 deadlines per case
 *      — Finances where relevant
 *      — Strategy notes
 *   4. Marks all cases as "unlocked" via purchase records
 *
 * Prerequisites:
 *   The demo user must have signed in to Vera at least once
 *   so their record exists in the users table.
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";

const isProd  = process.argv.includes("--prod");
const doClear = process.argv.includes("--clear");
const email   = process.argv.find(a => a.includes("@"));

if (!email) {
  console.error("Usage: npx tsx scripts/seed-demo.ts <email> [--prod] [--clear]");
  process.exit(1);
}

const envFile = isProd
  ? join(process.cwd(), ".env.production.local")
  : join(process.cwd(), ".env.local");

const envText = readFileSync(envFile, "utf8");
const env: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?/);
  if (m) env[m[1]] = m[2];
}

const dbUrl = (isProd ? env.DATABASE_URL_UNPOOLED : null) ?? env.DATABASE_URL;
if (!dbUrl) { console.error("No DATABASE_URL found in", envFile); process.exit(1); }

const sql = neon(dbUrl);

// ── Helpers ────────────────────────────────────────────────────────────────

async function insertCase(userId: string, data: {
  name: string; case_type: string; opposing_party: string; jurisdiction: string;
  court_name?: string; case_number?: string; hearing_date?: string; petitioner_name?: string; status?: string;
}) {
  const [row] = await sql`
    INSERT INTO cases (user_id, name, case_type, opposing_party, jurisdiction, court_name, case_number, hearing_date, petitioner_name, status, metadata)
    VALUES (${userId}, ${data.name}, ${data.case_type}, ${data.opposing_party}, ${data.jurisdiction},
            ${data.court_name ?? null}, ${data.case_number ?? null}, ${data.hearing_date ?? null},
            ${data.petitioner_name ?? null}, ${data.status ?? "active"}, '{}')
    RETURNING id`;
  return row.id as string;
}

async function insertTimeline(caseId: string, entries: { date: string; event: string; note?: string }[]) {
  for (const e of entries) {
    await sql`INSERT INTO timeline_entries (case_id, date, event, note) VALUES (${caseId}, ${e.date}, ${e.event}, ${e.note ?? null})`;
  }
}

async function insertEvidence(caseId: string, items: { title: string; source_type: string; summary: string }[]) {
  for (let i = 0; i < items.length; i++) {
    const ref = `E-${String(i + 1).padStart(3, "0")}`;
    await sql`INSERT INTO evidence (case_id, ref, title, source_type, summary) VALUES (${caseId}, ${ref}, ${items[i].title}, ${items[i].source_type}, ${items[i].summary})`;
  }
}

async function insertTasks(caseId: string, tasks: { title: string; priority?: string; col?: string }[]) {
  for (const t of tasks) {
    await sql`INSERT INTO tasks (case_id, title, priority, col) VALUES (${caseId}, ${t.title}, ${t.priority ?? "medium"}, ${t.col ?? "todo"})`;
  }
}

async function insertDeadlines(caseId: string, deadlines: { label: string; date: string; priority?: string }[]) {
  for (const d of deadlines) {
    await sql`INSERT INTO deadlines (case_id, label, date, priority) VALUES (${caseId}, ${d.label}, ${d.date}, ${d.priority ?? "medium"})`;
  }
}

async function insertFinances(caseId: string, items: { description: string; category: string; amount: number; date?: string }[]) {
  for (const f of items) {
    await sql`INSERT INTO financial_items (case_id, description, category, amount, date) VALUES (${caseId}, ${f.description}, ${f.category}, ${f.amount}, ${f.date ?? "2025-01-01"})`;
  }
}

async function insertNote(caseId: string, content: string, key = "__case_notes__") {
  await sql`
    INSERT INTO notes (case_id, key, content)
    VALUES (${caseId}, ${key}, ${content})
    ON CONFLICT (case_id, key) DO UPDATE SET content = ${content}, updated_at = now()`;
}

async function insertUnlock(userId: string, caseId: string) {
  await sql`
    INSERT INTO purchases (user_id, case_id, tier, amount_cents, stripe_session_id)
    VALUES (${userId}, ${caseId}, 'case_unlock', 4900, ${"demo_" + caseId})
    ON CONFLICT (stripe_session_id) DO NOTHING`;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nSeeding demo data for: ${email}`);
  console.log(`Database: ${isProd ? "PRODUCTION" : "dev"}\n`);

  // 1. Find user
  const [user] = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (!user) {
    console.error(`User not found: ${email}\nMake sure they've signed in to Vera at least once.`);
    process.exit(1);
  }
  const userId = user.id as string;
  console.log(`✓ Found user: ${userId}`);

  // 2. Set is_admin = true
  await sql`UPDATE users SET is_admin = true WHERE id = ${userId}`;
  console.log("✓ Granted admin/demo access (all AI features unlocked)");

  // 3. Clear existing demo cases if requested
  if (doClear) {
    const existing = await sql`SELECT id FROM cases WHERE user_id = ${userId} AND name LIKE '% — %'`;
    for (const c of existing) {
      await sql`DELETE FROM cases WHERE id = ${c.id as string}`;
    }
    console.log(`✓ Cleared ${existing.length} existing demo cases`);
  }

  // ── CASE 1: DIVORCE ──────────────────────────────────────────────────────
  console.log("\n→ Creating divorce case...");
  const divorceId = await insertCase(userId, {
    name:            "Chen v. Chen — Divorce",
    case_type:       "divorce",
    opposing_party:  "Robert James Chen",
    jurisdiction:    "California",
    court_name:      "San Francisco County Superior Court",
    case_number:     "FL-2025-004422",
    hearing_date:    "2026-07-15",
    petitioner_name: "Sarah Michelle Chen",
  });

  await insertTimeline(divorceId, [
    { date: "2017-06-15", event: "Purchased home at 1842 Redwood Avenue, San Francisco for $795,000 as Sarah's separate property" },
    { date: "2019-06-14", event: "Robert added to title via interspousal transfer deed for refinancing purposes" },
    { date: "2023-08-10", event: "Marriage of Sarah and Robert Chen" },
    { date: "2025-02-17", event: "Robert unilaterally transferred $15,000 from joint checking account without notice", note: "Bank records confirm single signature on transfer" },
    { date: "2025-03-05", event: "Robert closed joint savings account holding $23,418 without Sarah's knowledge or consent" },
    { date: "2025-03-14", event: "Robert left the marital home and moved to his brother's residence" },
    { date: "2025-05-01", event: "Robert stopped making mortgage payments — Sarah has paid solely since this date" },
    { date: "2025-05-15", event: "Bank issued 15-day late notice on mortgage, affecting both parties' credit" },
    { date: "2025-06-10", event: "Robert's attorney filed for divorce proceedings in San Francisco County Superior Court" },
    { date: "2025-08-22", event: "Robert proposed settlement: house for pension, clean split — Sarah rejected" },
    { date: "2025-11-03", event: "Discovery phase initiated — pension valuation, full financial disclosure subpoenas issued" },
    { date: "2026-01-15", event: "CalPERS pension valued at $214,000 accumulated during marriage (2023–2025 portion)" },
  ]);

  await insertEvidence(divorceId, [
    { title: "Joint bank account statements (Q1 2025)", source_type: "Bank Records", summary: "$15,000 unilateral transfer by Robert on Feb 17, 2025. $23,418 savings closure March 5, 2025. Both without Sarah's consent." },
    { title: "Property deed — 1842 Redwood Ave (2017)", source_type: "Legal Document", summary: "Original purchase in Sarah's name as separate property, June 15, 2017. Pre-dates marriage by 6 years." },
    { title: "Interspousal transfer deed (2019)", source_type: "Legal Document", summary: "Robert added to title June 14, 2019 for refinancing purposes only. Document notes pre-marital equity retained by Sarah." },
    { title: "Text message thread — Robert Chen (Mar–Nov 2025)", source_type: "Communications", summary: "Documents refusal to pay mortgage, threats about pension, unilateral account actions. 40+ messages preserved." },
    { title: "CalPERS pension valuation report", source_type: "Financial", summary: "Expert valuation confirms $214,000 marital portion accumulated 2023–2025. Supports QDRO claim." },
  ]);

  await insertTasks(divorceId, [
    { title: "File motion for temporary support order", priority: "high" },
    { title: "Retain QDRO specialist for pension division", priority: "high", col: "inprogress" },
    { title: "Obtain 3 years of Robert's tax returns via discovery", priority: "medium" },
    { title: "Document all mortgage payments made solely by Sarah since May 2025", priority: "medium", col: "done" },
    { title: "Research California community property law on pre-marital real estate equity", priority: "low", col: "done" },
  ]);

  await insertDeadlines(divorceId, [
    { label: "Respond to Robert's discovery requests", date: "2026-06-15", priority: "high" },
    { label: "Hearing — property division arguments", date: "2026-07-15", priority: "critical" },
    { label: "File opposition to Robert's pension characterization motion", date: "2026-06-30", priority: "high" },
  ]);

  await insertFinances(divorceId, [
    { description: "1842 Redwood Ave — current market value", category: "Asset", amount: 795000, date: "2026-01-01" },
    { description: "Mortgage balance outstanding", category: "Debt", amount: 541200, date: "2026-01-01" },
    { description: "CalPERS pension — marital portion", category: "Asset", amount: 214000, date: "2026-01-01" },
    { description: "Joint savings account — misappropriated by Robert", category: "Asset", amount: 23418, date: "2025-03-05" },
    { description: "Mortgage payments made by Sarah alone (May–Dec 2025)", category: "Expense", amount: 25200, date: "2025-12-01" },
  ]);

  await insertNote(divorceId, `My argument: Robert's claim to the house is overstated. I purchased this property in 2017, 6 years before we married. The pre-marital equity (~$254,000 at time of marriage) is my separate property. Robert was added to title purely for refinancing — not as a gift of equity.

Robert's removal of $38,418 from our joint accounts without consent is dissipation of marital assets. I should be credited for this in the final settlement.

His pension: we were married Aug 2023. Pension was valued at ~$182,000 at marriage. Current value ~$396,000. The $214,000 increase is marital property subject to QDRO.

My goal: keep the house (refinance Robert out), receive my share of pension appreciation, and be reimbursed for the 8 months of sole mortgage payments.`);

  await insertUnlock(userId, divorceId);
  console.log("  ✓ Divorce case created");

  // ── CASE 2: CUSTODY ──────────────────────────────────────────────────────
  console.log("→ Creating custody case...");
  const custodyId = await insertCase(userId, {
    name:            "Webb v. Webb — Child Custody",
    case_type:       "custody",
    opposing_party:  "Marcus Webb",
    jurisdiction:    "Texas",
    court_name:      "Travis County District Court",
    case_number:     "DC-2025-009871",
    hearing_date:    "2026-08-20",
    petitioner_name: "Jennifer Webb",
  });

  await insertTimeline(custodyId, [
    { date: "2024-09-15", event: "Temporary custody order issued: 50/50 split, exchanges at McDonald's on Congress Ave" },
    { date: "2025-01-04", event: "Marcus arrived 47 minutes late to custody exchange — Aiden missed swim lesson", note: "Witnessed by Jennifer's sister, Diane Kowalski. Photos timestamped 4:47 PM" },
    { date: "2025-01-18", event: "Chloe returned with bruise on left forearm. Said 'Daddy's friend grabbed my arm'", note: "Photos taken. Marcus claimed she fell at park." },
    { date: "2025-02-02", event: "Marcus failed to return children at 6 PM — arrived 2 hours 47 minutes late with no communication" },
    { date: "2025-02-14", event: "Marcus appeared unannounced at Aiden's school Valentine's Day event — not his parenting week" },
    { date: "2025-03-07", event: "Children report Marcus's girlfriend Brittany sleeping over — violates Section 4.2 of temporary order" },
    { date: "2025-03-22", event: "Marcus took Aiden to doctor for ear infection without advance notice — violates Section 6.1", note: "Medical records obtained from Austin Pediatrics" },
    { date: "2025-04-05", event: "Marcus refused to return children at noon for spring break per order — 27 hours late" },
    { date: "2025-05-06", event: "Kindergarten graduation: Marcus introduced girlfriend as 'Chloe's stepmom' to teacher and parents" },
    { date: "2025-09-01", event: "School counselor referred Aiden for anxiety therapy — counselor notes link to custody conflict" },
  ]);

  await insertEvidence(custodyId, [
    { title: "Incident log — January through May 2025", source_type: "Personal Records", summary: "5 documented violations of temporary custody order: late returns (×2), overnight guest, medical non-notice, spring break violation." },
    { title: "School records — Aiden Webb, Sunset Elementary", source_type: "Official Records", summary: "Teacher notes document anxiety, 2 tardies linked to late returns, counselor referral Feb 2025. March 22 absence filed by Marcus without notifying Jennifer." },
    { title: "OurFamilyWizard communication logs", source_type: "Communications", summary: "Pattern of non-response, dismissive messages ('stop harassing me', 'stop documenting everything'), and disputed claims about overnight guest." },
    { title: "Text messages — late returns and non-communication", source_type: "Communications", summary: "Feb 2 incident: Jennifer texted 3 times, called once. No response for 2+ hours. Children returned 8:47 PM." },
    { title: "Counselor's notes — Aiden Webb (Feb–Sep 2025)", source_type: "Medical/Psychological", summary: "School counselor documents Aiden's confusion about custody, anxiety about parental conflict, recommended consistent schedule." },
  ]);

  await insertTasks(custodyId, [
    { title: "File motion to enforce temporary order — document 5 violations", priority: "high" },
    { title: "Request in-camera interview for Aiden with judge's attorney ad litem", priority: "high", col: "inprogress" },
    { title: "Subpoena school and medical records for hearing", priority: "medium" },
    { title: "Prepare witness list (Diane Kowalski, Mrs. Flores, Ms. Ortega)", priority: "medium" },
    { title: "Research Texas Family Code provisions on overnight guests and parental alienation", priority: "low", col: "done" },
  ]);

  await insertDeadlines(custodyId, [
    { label: "File motion to enforce (violations documented)", date: "2026-07-01", priority: "high" },
    { label: "Final hearing — custody modification", date: "2026-08-20", priority: "critical" },
    { label: "Exchange witness and exhibit lists with opposing counsel", date: "2026-08-05", priority: "high" },
  ]);

  await insertNote(custodyId, `My position: Marcus has violated the temporary order at minimum 5 times since September 2024. The pattern — late returns, unauthorized school appearances, overnight guest violations, spring break refusal — shows contempt for court orders and prioritization of his own convenience over the children's stability.

Key arguments for modification:
1. Aiden's anxiety is documented and school-counselor-referred. The inconsistency in Marcus's schedule is a direct factor.
2. The overnight guest (Brittany) violates Section 4.2 explicitly. Marcus's position that it "doesn't apply" is contradicted by the plain text.
3. The school incident (Valentine's Day, Graduation) shows boundary issues with introducing Brittany as "stepmom" without court approval or discussion.

What I want: Primary conservatorship with Marcus having standard possession order (every other weekend + Thursday nights). This gives Aiden and Chloe stability while preserving Marcus's relationship with them.`);

  await insertUnlock(userId, custodyId);
  console.log("  ✓ Custody case created");

  // ── CASE 3: LANDLORD/TENANT ───────────────────────────────────────────────
  console.log("→ Creating landlord/tenant case...");
  const ltId = await insertCase(userId, {
    name:            "Reyes v. Sunrise Property Management — Tenant Rights",
    case_type:       "landlord_tenant",
    opposing_party:  "Sunrise Property Management LLC",
    jurisdiction:    "Florida",
    court_name:      "Hillsborough County Court",
    case_number:     "CC-2025-007234",
    hearing_date:    "2026-06-10",
    petitioner_name: "Diana Reyes",
  });

  await insertTimeline(ltId, [
    { date: "2024-08-01", event: "Signed 12-month lease for 4402 Palmetto Court, Unit 2B, Tampa. Security deposit $1,650 paid." },
    { date: "2024-09-18", event: "HVAC failure reported — indoor temp 87°F. Repair request submitted via Sunrise portal." },
    { date: "2024-09-19", event: "Stayed at hotel 2 nights ($374 total) due to uninhabitable heat — HVAC still unrepaired", note: "Hotel receipts preserved. FL Statute 83.51 violation." },
    { date: "2024-10-04", event: "HVAC finally repaired — 16 days after report (7-day habitability standard violated)" },
    { date: "2024-11-03", event: "Ceiling water leak from upstairs unit — bathroom ceiling damaged, staining visible" },
    { date: "2024-12-01", event: "Mold discovered in bathroom corner. Reported to Sunrise. Response: 'Run bathroom fan.'" },
    { date: "2025-01-08", event: "UNAUTHORIZED ENTRY — maintenance entered without notice. Left note: 'Checked on the leak situation'", note: "Violation of FL Statute 83.53 and lease Section 12. Complained to management Jan 9." },
    { date: "2025-02-15", event: "Second unauthorized entry — maintenance installed new bathroom fan without 24-hour notice" },
    { date: "2025-03-01", event: "Formal demand letter sent via certified mail: mold remediation, $402.47 reimbursement, entry acknowledgment" },
    { date: "2025-04-01", event: "Sunrise failed to respond to demand letter. Filing complaint with Hillsborough County Code Enforcement." },
  ]);

  await insertEvidence(ltId, [
    { title: "Signed lease agreement — 4402 Palmetto Court Unit 2B", source_type: "Legal Document", summary: "Section 8 requires habitable conditions per FL 83.51. Section 12 requires 24-hour entry notice. Section 14 governs security deposit return." },
    { title: "Repair request portal screenshots (Sep–Dec 2024)", source_type: "Digital Records", summary: "HVAC request Sep 18 (16-day response). Water leak Nov 3. Mold Dec 1 with dismissive management response." },
    { title: "Photos — mold, water damage, bathroom ceiling", source_type: "Photographs", summary: "Dated photos document bathroom mold, ceiling bubble/staining from Nov 3 leak, ongoing condition as of April 2025." },
    { title: "Unauthorized entry notes left by maintenance (Jan 8, Feb 15)", source_type: "Physical Evidence", summary: "Two handwritten notes left by maintenance after unauthorized entries. No prior 24-hour notice given on either occasion." },
    { title: "Demand letter + certified mail receipt", source_type: "Legal Document", summary: "Formal demand sent March 1, 2025. Tracking: 9400111899223394773962. Sunrise failed to respond by March 15 deadline." },
  ]);

  await insertTasks(ltId, [
    { title: "File complaint with Hillsborough County Code Enforcement", priority: "high", col: "inprogress" },
    { title: "Research Florida Statute 83.60 — repair-and-deduct option", priority: "high" },
    { title: "Get mold inspection from independent certified inspector", priority: "high" },
    { title: "Document all rent payments and receipts for court", priority: "medium", col: "done" },
  ]);

  await insertDeadlines(ltId, [
    { label: "Code enforcement inspection scheduled", date: "2026-05-15", priority: "high" },
    { label: "Small claims filing deadline (1-year from first violation)", date: "2026-07-01", priority: "high" },
    { label: "Hearing date — Hillsborough County Court", date: "2026-06-10", priority: "critical" },
  ]);

  await insertFinances(ltId, [
    { description: "Security deposit — owed back at lease end", category: "Asset", amount: 1650, date: "2024-08-01" },
    { description: "Hotel costs during HVAC failure (2 nights)", category: "Expense", amount: 374, date: "2024-09-19" },
    { description: "Mold cleaning supplies (unreimbursed)", category: "Expense", amount: 28.47, date: "2024-12-15" },
    { description: "Rent withheld pending repair (if applicable under FL 83.60)", category: "Asset", amount: 1650, date: "2026-01-01" },
  ]);

  await insertNote(ltId, `Florida law is on my side on the entry violations — FL Statute 83.53 is clear. Two unauthorized entries with no notice is a pattern, not a mistake.

The mold issue is the strongest habitability claim. FL 83.51 requires the landlord to maintain premises free of conditions that materially affect health. Mold documented December 2024, still unremediated April 2025 = 4+ month failure.

Strategy: File code enforcement complaint first (creates official record). Use repair-and-deduct if mold remediation exceeds $1,650 (one month's rent — FL limit). File small claims for hotel costs + cleaning supplies + any security deposit issues at lease end.

The unauthorized entry violations are leverage. They give me grounds to terminate the lease early if needed.`);

  await insertUnlock(userId, ltId);
  console.log("  ✓ Landlord/tenant case created");

  // ── CASE 4: EMPLOYMENT ───────────────────────────────────────────────────
  console.log("→ Creating employment case...");
  const empId = await insertCase(userId, {
    name:            "Tran v. TechFlow Solutions — Wrongful Termination",
    case_type:       "employment",
    opposing_party:  "TechFlow Solutions Inc.",
    jurisdiction:    "Washington",
    court_name:      "King County Superior Court",
    case_number:     "22-2-12047-1",
    hearing_date:    "2026-09-08",
    petitioner_name: "Kevin Tran",
  });

  await insertTimeline(empId, [
    { date: "2020-03-15", event: "Hired as Senior Software Engineer at TechFlow Solutions — salary $112,000" },
    { date: "2024-01-18", event: "2023 annual review: EXCEEDS EXPECTATIONS (4/5). Salary increase to $120,960 approved." },
    { date: "2024-09-06", event: "PTO request (Nov 18–29) approved in writing by manager David Chen" },
    { date: "2024-10-15", event: "Assigned to Apex Integration project — 3 weeks before approved PTO, 3 weeks less than 6-week scope" },
    { date: "2024-10-28", event: "Raised timeline concern with David Chen — requested 2-week extension. Response: 'Figure it out.'" },
    { date: "2024-11-18", event: "Began approved PTO — Apex project handed off per pre-PTO agreement" },
    { date: "2024-12-20", event: "Returned from PTO — deadline passed. David Chen issued informal warning." },
    { date: "2025-01-06", event: "Performance Improvement Plan issued — cites Apex deadline miss and code review 'backlog'" },
    { date: "2025-01-15", event: "2024 annual review issued NEEDS IMPROVEMENT — drafted and delivered same week as PIP", note: "Review drafted retroactively to justify PIP already in place" },
    { date: "2025-02-03", event: "Formal written complaint to HR: PIP process flawed, deadline miss attributable to project setup not performance" },
    { date: "2025-02-05", event: "HR response: 'PIP was approved by leadership.' No substantive engagement with concerns." },
    { date: "2025-03-14", event: "Termination — effective immediately. Stated reason: 'failure to meet PIP requirements'" },
  ]);

  await insertEvidence(empId, [
    { title: "2023 performance review — Exceeds Expectations (4/5)", source_type: "Employment Records", summary: "David Chen praised Kevin's Meridian project as 'critical to winning $2.1M contract.' Recommended tech lead promotion. 8% merit increase." },
    { title: "PTO approval email — David Chen, September 6, 2024", source_type: "Email", summary: "'Approved. Have a good trip.' — Written approval by direct manager for Nov 18-29 PTO." },
    { title: "Timeline concern email — October 28, 2024", source_type: "Email", summary: "Kevin formally raised 6-week project assigned 3 weeks before approved PTO. Requested 2-week extension. David Chen replied: 'Figure it out.'" },
    { title: "Termination letter — March 14, 2025", source_type: "Employment Records", summary: "Cites 'repeated performance issues.' Final paycheck includes 12 days unused PTO ($3,692.28)." },
    { title: "Witness statement — Sophia Okonkwo, Senior Engineer", source_type: "Witness Statement", summary: "Corroborates: Kevin added to Apex project late, code review burden was above average, 3 other engineers missed Q4 deadlines without PIPs." },
  ]);

  await insertTasks(empId, [
    { title: "File complaint with Washington State EEOC equivalent (L&I)", priority: "high", col: "inprogress" },
    { title: "Obtain all employment records (performance reviews, code review stats)", priority: "high" },
    { title: "Request formal reason for termination in writing from TechFlow HR", priority: "high", col: "done" },
    { title: "Identify other employees who missed Q4 2024 deadlines without PIPs (disparate treatment)", priority: "medium" },
    { title: "Calculate total damages: lost wages + benefits + stock vesting", priority: "medium" },
  ]);

  await insertDeadlines(empId, [
    { label: "File L&I complaint (180-day window from termination)", date: "2025-09-10", priority: "critical" },
    { label: "Mediation session with TechFlow", date: "2026-07-15", priority: "high" },
    { label: "Hearing — King County Superior Court", date: "2026-09-08", priority: "critical" },
  ]);

  await insertFinances(empId, [
    { description: "Lost wages (12 months at $120,960)", category: "Asset", amount: 120960, date: "2025-03-14" },
    { description: "Lost equity/stock options (unvested at termination)", category: "Asset", amount: 45000, date: "2025-03-14" },
    { description: "Final paycheck — PTO payout received", category: "Income", amount: 3692.28, date: "2025-03-21" },
    { description: "COBRA health insurance cost (self-pay post-termination)", category: "Expense", amount: 890, date: "2025-04-01" },
  ]);

  await insertNote(empId, `Core theory: Pretext termination. The stated reason (PIP failure) is pretextual. Evidence:

1. CONSISTENT GOOD PERFORMANCE: 4 years without disciplinary action. 2023 review was exceptional — promoted, praised, merit increased.

2. THE SETUP: Assigned to 6-week project 3 weeks before pre-approved PTO. When I raised the concern formally, manager said 'figure it out.' This is exactly the kind of setup that creates pretextual termination.

3. DISPARATE TREATMENT: Sophia confirms 3 other engineers missed Q4 deadlines. None received PIPs. I was the only one terminated.

4. TIMING: The 2024 review was retroactively drafted and delivered the same week as the PIP. This shows the PIP was the decision and the review was the justification, not the other way around.

Washington state requires legitimate, non-pretextual reasons for termination. I can show the stated reason doesn't hold up against my actual performance history.

Damages: ~$166,000 (12 months wages + unvested equity). Plus attorney fees if successful.`);

  await insertUnlock(userId, empId);
  console.log("  ✓ Employment case created");

  // ── CASE 5: SMALL CLAIMS ─────────────────────────────────────────────────
  console.log("→ Creating small claims case...");
  const scId = await insertCase(userId, {
    name:            "Torres v. Davis Contracting — Bathroom Remodel Dispute",
    case_type:       "small_claims",
    opposing_party:  "Davis Contracting LLC",
    jurisdiction:    "Colorado",
    court_name:      "Denver County Court — Small Claims Division",
    case_number:     "SC-2025-014882",
    hearing_date:    "2026-05-28",
    petitioner_name: "Michael Torres",
  });

  await insertTimeline(scId, [
    { date: "2024-11-10", event: "Signed contract with Davis Contracting for $8,400 bathroom remodel. Completion: December 20, 2024." },
    { date: "2024-11-10", event: "Paid $2,800 deposit (check #4412)" },
    { date: "2024-11-22", event: "Demo completed. Paid second installment $2,800 (check #4421)" },
    { date: "2024-12-09", event: "No tile work started. Brian Davis cited 'delays on another job'" },
    { date: "2024-12-19", event: "Brian appeared, installed shower pan only. Promised full completion by January 5." },
    { date: "2025-01-05", event: "Brian did not appear. No contact for 3 days." },
    { date: "2025-01-20", event: "Brian appeared, installed ~30% of tile with one worker. 'I'll be back Thursday.'" },
    { date: "2025-01-23", event: "Brian did not appear. All calls went unanswered." },
    { date: "2025-02-01", event: "Sent certified demand letter: complete by Feb 14 or return $5,600 minus materials cost" },
    { date: "2025-02-15", event: "Brian did not appear. Hired Sunrise Bath & Tile to complete work for $4,200." },
    { date: "2025-03-01", event: "Bathroom completed by Sunrise. Total cost to Michael: $9,800 vs. $8,400 contract." },
  ]);

  await insertEvidence(scId, [
    { title: "Signed service contract — November 10, 2024", source_type: "Contract", summary: "$8,400 total. Completion December 20, 2024. Clear scope: demo, tile installation, shower pan, vanity, toilet, paint." },
    { title: "Cancelled checks #4412 and #4421", source_type: "Financial Records", summary: "Two payments of $2,800 each = $5,600 total paid to Davis Contracting LLC." },
    { title: "Text message thread — Brian Davis (Nov 2024–Feb 2025)", source_type: "Communications", summary: "Documents 3 missed deadlines, promises not kept, eventual non-response. 'On my way' message Feb 14 — Brian never arrived." },
    { title: "Sunrise Bath & Tile invoice", source_type: "Financial Records", summary: "$4,200 to complete work Davis left unfinished. Line items confirm scope was what Davis was contracted to do." },
    { title: "Certified demand letter + tracking confirmation", source_type: "Legal Document", summary: "Sent Feb 1, 2025. Demanded completion by Feb 14 or refund. Tracking confirmed delivery Feb 3. No response received." },
  ]);

  await insertTasks(scId, [
    { title: "File small claims complaint in Denver County Court", priority: "high", col: "inprogress" },
    { title: "Serve Brian Davis / Davis Contracting LLC", priority: "high" },
    { title: "Prepare damage calculation summary for judge", priority: "medium" },
    { title: "Gather all evidence into organized binder for hearing", priority: "medium" },
  ]);

  await insertDeadlines(scId, [
    { label: "Small claims hearing — Denver County Court", date: "2026-05-28", priority: "critical" },
    { label: "Serve Davis Contracting (at least 15 days before hearing)", date: "2026-05-13", priority: "high" },
  ]);

  await insertFinances(scId, [
    { description: "Paid to Davis Contracting (two payments)", category: "Asset", amount: 5600, date: "2024-11-22" },
    { description: "Paid to Sunrise Bath & Tile to complete work", category: "Expense", amount: 4200, date: "2025-02-15" },
    { description: "Hotel costs during extended delay (2 nights)", category: "Expense", amount: 298, date: "2025-01-06" },
    { description: "Total overspend vs. original contract", category: "Expense", amount: 1400, date: "2025-03-01" },
  ]);

  await insertNote(scId, `Damages: Colorado small claims limit is $7,500. My actual damages are ~$5,198.

Breakdown:
- $3,500 for work paid to Davis but not performed (estimated labor/materials not delivered)
- $1,400 overpayment vs. contract ($9,800 total vs. $8,400 contract)
- $298 hotel costs

Key facts for the judge:
1. Contract was clear — completion December 20. Davis signed it.
2. I gave Davis 3 extensions beyond the original deadline. He missed all of them.
3. I have texts showing Brian's promises and failures.
4. I mitigated my damages by hiring a replacement contractor rather than letting it sit unfinished.

Davis's likely defense: "substantial completion" or blaming supply issues. Counter: the contract had a hard deadline. I have texts showing Davis cited other jobs, not supply delays.`);

  await insertUnlock(userId, scId);
  console.log("  ✓ Small claims case created");

  // ── CASE 6: OTHER (HOA DISPUTE) ──────────────────────────────────────────
  console.log("→ Creating HOA dispute case...");
  const hoaId = await insertCase(userId, {
    name:            "Mendoza v. Westside HOA — Fence / Lien Dispute",
    case_type:       "other",
    opposing_party:  "Westside Homeowners Association",
    jurisdiction:    "Arizona",
    court_name:      "Maricopa County Superior Court — Real Estate Department",
    case_number:     "CV2024-094471",
    hearing_date:    "2026-06-22",
    petitioner_name: "Carlos Mendoza",
  });

  await insertTimeline(hoaId, [
    { date: "2022-11-15", event: "Purchased 4817 Saguaro Ridge Lane, Scottsdale, AZ. HOA dues: $285/month." },
    { date: "2024-02-12", event: "Submitted ARC application for cedar privacy fence. Application fee $50 paid." },
    { date: "2024-03-15", event: "Fence installed — 31 days after ARC application. CC&Rs Section VII.3 states unanswered applications are 'deemed approved' after 30 days.", note: "ARC never sent written rejection before installation" },
    { date: "2024-03-22", event: "HOA sent 'Notice of Violation — Unapproved Structure.' Demanded removal in 30 days." },
    { date: "2024-03-28", event: "Carlos sent written response citing CC&Rs Art. VII Sec. 3 deemed-approval provision. HOA acknowledged receipt." },
    { date: "2024-04-15", event: "HOA board voted to reject deemed-approval argument. Attorney letter: remove fence or $100/day fine starts May 1." },
    { date: "2024-05-06", event: "Attended board meeting. Board claims rejection letter sent March 8. Carlos never received it. Board cannot produce delivery confirmation.", note: "No certified mail, no email, no portal notification — only their internal log" },
    { date: "2024-07-01", event: "HOA placed lien on property for $6,100 fines + $350 attorney fees = $6,450 total" },
    { date: "2024-08-05", event: "Formal demand letter: remove lien, waive fines, citing: deemed approval, no proof of delivery, no cure period before fines" },
    { date: "2024-10-01", event: "Filed complaint — Maricopa County Superior Court, Case No. CV2024-094471" },
  ]);

  await insertEvidence(hoaId, [
    { title: "ARC application — February 12, 2024 with $50 payment receipt", source_type: "Legal Document", summary: "Submitted 31 days before installation. CC&Rs require response within 30 days or application is deemed approved by default." },
    { title: "CC&Rs Article VII, Section 3 — deemed approval clause", source_type: "Legal Document", summary: "'If the ARC fails to respond within 30 days, the application shall be deemed approved by default.' Directly applicable to this situation." },
    { title: "Carlos's response letter + certified delivery confirmation", source_type: "Legal Document", summary: "Sent March 28, 2024 via certified mail. Delivery confirmed. HOA acknowledged receipt. Documents their own procedural failure." },
    { title: "HOA board meeting minutes — May 6, 2024", source_type: "Official Records", summary: "Board president claimed rejection letter sent March 8. Could not produce delivery confirmation. 'We sent it. That's our record.'" },
    { title: "Photos — fence and comparable neighborhood fences", source_type: "Photographs", summary: "Carlos's fence compared to 4 similar fences in neighborhood with apparent HOA approval. Shows inconsistent enforcement." },
  ]);

  await insertTasks(hoaId, [
    { title: "Request HOA produce proof of delivery for alleged March 8 rejection", priority: "high", col: "done" },
    { title: "Research Arizona HOA statutes on cure periods and fine assessment due process", priority: "high", col: "done" },
    { title: "Subpoena HOA's complete file on Carlos's ARC application", priority: "medium", col: "inprogress" },
    { title: "Document all comparable fences in neighborhood (photos, HOA approval status)", priority: "medium" },
    { title: "Prepare motion for summary judgment based on deemed-approval provision", priority: "high" },
  ]);

  await insertDeadlines(hoaId, [
    { label: "Discovery deadline — exchange documents and evidence", date: "2026-05-15", priority: "high" },
    { label: "Hearing — Maricopa County Superior Court", date: "2026-06-22", priority: "critical" },
    { label: "File motion for lien release (pre-hearing)", date: "2026-06-01", priority: "high" },
  ]);

  await insertFinances(hoaId, [
    { description: "HOA fines assessed May–June 2024 ($100/day × 61 days)", category: "Debt", amount: 6100, date: "2024-06-30" },
    { description: "HOA attorney fees added to lien", category: "Debt", amount: 350, date: "2024-07-01" },
    { description: "Court filing fee paid", category: "Expense", amount: 216, date: "2024-10-01" },
    { description: "ARC application fee (June 2024 — unreturned)", category: "Expense", amount: 50, date: "2024-02-12" },
  ]);

  await insertNote(hoaId, `Legal theory: The HOA's lien is unlawful for three independent reasons.

1. DEEMED APPROVAL: CC&Rs Art. VII Sec. 3 is unambiguous. 30 days, no response = approved. The HOA cannot retroactively reject an application they failed to act on in time.

2. NO PROOF OF REJECTION: The HOA claims they sent a rejection letter March 8. They cannot produce any delivery confirmation. I never received it. Under Arizona law and basic contract principles, notice is only effective when actually communicated.

3. DUE PROCESS VIOLATION: The HOA began $100/day fines on May 1 without any opportunity to cure. Arizona HOA statutes (ARS 33-1803 for planned communities) require notice and a cure period before fines can be assessed.

The comparable fence evidence is supplemental — shows inconsistent enforcement, which supports an estoppel argument.

Goal: Court order removing the lien and declaring the fence lawfully installed under the deemed-approval provision. Possible attorney fee award if HOA position was unreasonable.`);

  await insertUnlock(userId, hoaId);
  console.log("  ✓ HOA dispute case created");

  // ── SUMMARY ─────────────────────────────────────────────────────────────
  console.log(`\n✅ Demo data seeded successfully for ${email}!`);
  console.log("\n6 cases created:");
  console.log(`  - Divorce:          ${divorceId}`);
  console.log(`  - Custody:          ${custodyId}`);
  console.log(`  - Landlord/Tenant:  ${ltId}`);
  console.log(`  - Employment:       ${empId}`);
  console.log(`  - Small Claims:     ${scId}`);
  console.log(`  - HOA Dispute:      ${hoaId}`);
  console.log("\nAll cases unlocked (AI features enabled).");
  console.log("User set as admin — no payment required for any AI features.\n");
}

main().catch(e => { console.error("Seed failed:", e); process.exit(1); });
