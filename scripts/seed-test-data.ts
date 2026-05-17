/**
 * Seed script — creates test users and cases for E2E testing.
 *
 * Run:  npx tsx scripts/seed-test-data.ts
 * Clean: npx tsx scripts/seed-test-data.ts --clean
 *
 * What it creates:
 *   - 1 primary test user  → 5 cases (divorce, custody, landlord, employment, small_claims)
 *   - 4 additional users   → 5 cases each (all divorce for simplicity)
 *
 * Writes .playwright/test-users.json with all credentials for E2E tests.
 */

import { createClerkClient } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";
import * as fs   from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.local before anything else
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
const sql   = neon(process.env.POSTGRES_URL!);

const CLEAN = process.argv.includes("--clean");
const SEED_TAG = "vera-e2e-test";
const TEST_PASSWORD = "VeraTest2026!";

// ── Case templates ────────────────────────────────────────────────────────────

const CASE_TEMPLATES = [
  {
    case_type: "divorce",
    name: "Test Divorce — Smith v. Jones",
    opposing_party: "Jones, Alex",
    jurisdiction: "Texas",
    court_name: "Harris County District Court",
    case_number: "2026-TEST-001",
    timeline: [
      { date: "2023-06-01", event: "Parties married in Houston, TX" },
      { date: "2024-01-15", event: "Separation — parties ceased cohabitation" },
      { date: "2024-03-01", event: "Original Petition for Divorce filed" },
      { date: "2024-04-10", event: "Respondent filed Answer and Counter-Petition" },
      { date: "2024-08-20", event: "Mediation session — impasse reached" },
      { date: "2025-01-05", event: "Trial scheduled for March 15, 2025" },
    ],
    evidence: [
      { ref: "E-001", title: "Marriage Certificate", source_type: "Document", summary: "Official marriage certificate dated June 1, 2023" },
      { ref: "E-002", title: "Bank statements showing separate funds", source_type: "Financial Record", summary: "Pre-marital Chase account with $45,000 balance prior to marriage" },
      { ref: "E-003", title: "Property deed — 456 Oak Street", source_type: "Document", summary: "Joint deed to marital home, acquired July 2023" },
    ],
    tasks: [
      { title: "File Financial Information Statement", col: "todo", priority: "high" },
      { title: "Gather 3 years of bank statements", col: "inprogress", priority: "high" },
      { title: "Obtain property appraisal", col: "todo", priority: "medium" },
      { title: "Identify all retirement accounts", col: "done", priority: "medium" },
    ],
    deadlines: [
      { label: "Financial disclosure due", date: "2025-12-15", priority: "high" },
      { label: "Pre-trial conference", date: "2026-01-10", priority: "high" },
      { label: "Trial date", date: "2026-02-14", priority: "high" },
    ],
    finances: [
      { category: "Asset", description: "Marital home — 456 Oak Street", amount: 485000, date: "2025-01-01" },
      { category: "Debt", description: "Mortgage balance — Chase Bank", amount: 310000, date: "2025-01-01" },
      { category: "Asset", description: "Joint savings account", amount: 28000, date: "2025-01-01" },
      { category: "Asset", description: "Petitioner 401(k)", amount: 95000, date: "2025-01-01" },
      { category: "Debt", description: "Joint credit card balance", amount: 12500, date: "2025-01-01" },
    ],
  },
  {
    case_type: "custody",
    name: "Test Custody — Williams v. Davis",
    opposing_party: "Davis, Morgan",
    jurisdiction: "California",
    court_name: "Los Angeles Superior Court",
    case_number: "2025-FAM-44821",
    timeline: [
      { date: "2022-09-01", event: "Separation — parties agreed to temporary 50/50 custody" },
      { date: "2023-02-14", event: "First custody hearing — temporary orders entered" },
      { date: "2024-06-01", event: "Respondent relocated 45 miles away without notice" },
      { date: "2024-07-10", event: "Emergency motion to modify custody filed" },
      { date: "2024-09-05", event: "Court ordered status quo pending hearing" },
    ],
    evidence: [
      { ref: "E-001", title: "School enrollment records", source_type: "Document", summary: "Child enrolled at Lincoln Elementary — petitioner listed as primary contact" },
      { ref: "E-002", title: "Text message thread — relocation notice", source_type: "Email / Text", summary: "Respondent provided 3 days notice of relocation vs required 30 days" },
      { ref: "E-003", title: "Existing temporary custody order", source_type: "Document", summary: "Order dated February 14, 2023 — 50/50 split with weekly exchanges" },
    ],
    tasks: [
      { title: "File motion to modify custody order", col: "done", priority: "high" },
      { title: "Obtain school attendance records", col: "todo", priority: "medium" },
      { title: "Document missed visitation exchanges", col: "inprogress", priority: "high" },
    ],
    deadlines: [
      { label: "Response to motion due", date: "2025-11-30", priority: "high" },
      { label: "Custody hearing", date: "2026-01-22", priority: "high" },
    ],
    finances: [
      { category: "Expense", description: "Child support payments — monthly", amount: 1200, date: "2025-01-01" },
      { category: "Expense", description: "Attorney fees paid to date", amount: 8500, date: "2025-01-01" },
    ],
  },
  {
    case_type: "landlord_tenant",
    name: "Test Landlord — Green v. Sunset Properties LLC",
    opposing_party: "Sunset Properties LLC",
    jurisdiction: "New York",
    court_name: "New York City Housing Court",
    case_number: "L&T-2025-887341",
    timeline: [
      { date: "2024-01-01", event: "Lease signed — 12-month term at $2,400/month" },
      { date: "2024-09-15", event: "Water damage discovered in bedroom ceiling" },
      { date: "2024-09-16", event: "Written repair request submitted to landlord via email" },
      { date: "2024-10-30", event: "No repairs made — second written notice sent via certified mail" },
      { date: "2024-12-01", event: "Withheld rent pending repairs — amount deposited to escrow account" },
      { date: "2025-01-10", event: "Landlord filed eviction notice" },
    ],
    evidence: [
      { ref: "E-001", title: "Signed lease agreement", source_type: "Document", summary: "Original 12-month lease, effective January 1, 2024" },
      { ref: "E-002", title: "Email — repair request September 16", source_type: "Email / Text", summary: "Written repair request with photos attached; no response received" },
      { ref: "E-003", title: "Certified mail receipt", source_type: "Document", summary: "Second notice delivered October 30, 2024; confirmed received" },
      { ref: "E-004", title: "Photographs — water damage", source_type: "Photograph", summary: "8 photos documenting ceiling damage and mold growth" },
    ],
    tasks: [
      { title: "File habitability complaint with housing authority", col: "todo", priority: "high" },
      { title: "Compile all rent payment receipts", col: "done", priority: "medium" },
      { title: "Research rent withholding laws for NY", col: "done", priority: "high" },
    ],
    deadlines: [
      { label: "Answer to eviction notice due", date: "2025-12-05", priority: "high" },
      { label: "Housing court hearing", date: "2026-01-08", priority: "high" },
    ],
    finances: [
      { category: "Expense", description: "Rent withheld — Dec 2024 (in escrow)", amount: 2400, date: "2024-12-01" },
      { category: "Expense", description: "Rent withheld — Jan 2025 (in escrow)", amount: 2400, date: "2025-01-01" },
      { category: "Asset", description: "Security deposit held by landlord", amount: 4800, date: "2024-01-01" },
    ],
  },
  {
    case_type: "employment",
    name: "Test Employment — Rodriguez v. Tech Corp Inc",
    opposing_party: "Tech Corp Inc",
    jurisdiction: "Washington",
    court_name: "King County Superior Court",
    case_number: "EMP-2025-11204",
    timeline: [
      { date: "2022-03-01", event: "Hired as Senior Engineer — performance reviews consistently 'Exceeds Expectations'" },
      { date: "2024-07-15", event: "Filed internal HR complaint regarding manager's discriminatory comments" },
      { date: "2024-08-01", event: "Excluded from key project meetings following HR complaint" },
      { date: "2024-09-30", event: "Given negative performance review for first time in employment history" },
      { date: "2024-11-15", event: "Terminated — stated reason: 'performance issues'" },
      { date: "2024-12-01", event: "EEOC complaint filed" },
    ],
    evidence: [
      { ref: "E-001", title: "3 years of positive performance reviews", source_type: "Document", summary: "Annual reviews 2022-2024 Q2 all rated Exceeds Expectations" },
      { ref: "E-002", title: "HR complaint — July 15, 2024", source_type: "Document", summary: "Formal complaint documenting manager's comments; HR reference #HC-2024-0715" },
      { ref: "E-003", title: "Meeting exclusion emails", source_type: "Email / Text", summary: "6 calendar invites removed within 2 weeks of HR complaint" },
      { ref: "E-004", title: "EEOC charge of discrimination", source_type: "Document", summary: "Charge #360-2025-00841 filed December 1, 2024" },
    ],
    tasks: [
      { title: "Obtain all HR records via FOIA/discovery", col: "todo", priority: "high" },
      { title: "Identify witnesses to discriminatory comments", col: "inprogress", priority: "high" },
      { title: "Document all communications post-complaint", col: "done", priority: "medium" },
    ],
    deadlines: [
      { label: "EEOC right-to-sue letter expected", date: "2025-12-01", priority: "high" },
      { label: "Lawsuit filing deadline (180 days from termination)", date: "2025-05-14", priority: "high" },
    ],
    finances: [
      { category: "Income", description: "Lost wages — monthly salary", amount: 12500, date: "2024-11-15" },
      { category: "Expense", description: "Attorney retainer paid", amount: 5000, date: "2025-01-01" },
    ],
  },
  {
    case_type: "small_claims",
    name: "Test Small Claims — Park v. Anderson",
    opposing_party: "Anderson, Tyler",
    jurisdiction: "Florida",
    court_name: "Miami-Dade County Court",
    case_number: "SC-2025-09988",
    timeline: [
      { date: "2024-06-01", event: "Verbal agreement: Anderson to repay $4,500 loan by August 1, 2024" },
      { date: "2024-06-02", event: "Funds transferred via Zelle — $4,500 with memo 'loan repayable Aug 1'" },
      { date: "2024-08-01", event: "No payment received — first demand via text message" },
      { date: "2024-09-01", event: "Second demand via certified letter — no response" },
      { date: "2024-10-15", event: "Small claims petition filed" },
    ],
    evidence: [
      { ref: "E-001", title: "Zelle transaction record — $4,500", source_type: "Financial Record", summary: "Bank statement showing Zelle transfer June 2 with repayment memo" },
      { ref: "E-002", title: "Text message thread — loan agreement", source_type: "Email / Text", summary: "Anderson confirms loan terms in writing: 'I'll pay you back by Aug 1 for sure'" },
      { ref: "E-003", title: "Certified mail receipt — demand letter", source_type: "Document", summary: "Demand letter delivered September 1; no response after 10 days" },
    ],
    tasks: [
      { title: "Serve defendant with summons", col: "todo", priority: "high" },
      { title: "Print all evidence for court binder", col: "todo", priority: "medium" },
      { title: "Research Florida small claims procedures", col: "done", priority: "medium" },
    ],
    deadlines: [
      { label: "Court hearing", date: "2026-02-20", priority: "high" },
      { label: "Serve defendant — deadline", date: "2025-12-20", priority: "high" },
    ],
    finances: [
      { category: "Asset", description: "Amount owed by defendant", amount: 4500, date: "2024-08-01" },
      { category: "Expense", description: "Small claims filing fee", amount: 100, date: "2024-10-15" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createClerkUser(email: string, firstName: string) {
  return clerk.users.createUser({
    emailAddress:   [email],
    password:       TEST_PASSWORD,
    firstName,
    lastName:       "TestUser",
    publicMetadata: { [SEED_TAG]: true },
  });
}

async function ensureProUser(userId: string, email: string) {
  await sql`INSERT INTO users (id, email) VALUES (${userId}, ${email}) ON CONFLICT (id) DO NOTHING`;
  // Give the user Pro tier so tests aren't blocked by the free plan limit
  await sql`
    INSERT INTO purchases (id, user_id, tier, status, stripe_session_id)
    VALUES (gen_random_uuid(), ${userId}, 'pro', 'active', ${'test_' + userId})
    ON CONFLICT (stripe_session_id) DO NOTHING`;
}

async function seedCase(userId: string, template: typeof CASE_TEMPLATES[0]) {
  // User already ensured by ensureProUser — skip duplicate insert
  await sql`
    INSERT INTO users (id, email) VALUES (${userId}, ${userId + "@vera-test.local"})
    ON CONFLICT (id) DO NOTHING`;

  // Create case
  const [c] = await sql`
    INSERT INTO cases (user_id, name, case_type, opposing_party, jurisdiction, court_name, case_number)
    VALUES (${userId}, ${template.name}, ${template.case_type}, ${template.opposing_party},
            ${template.jurisdiction}, ${template.court_name}, ${template.case_number})
    RETURNING id`;

  const caseId = c.id as string;

  // Timeline
  for (const t of template.timeline) {
    await sql`INSERT INTO timeline_entries (case_id, date, event) VALUES (${caseId}, ${t.date}, ${t.event})`;
  }

  // Evidence
  for (const e of template.evidence) {
    await sql`INSERT INTO evidence (case_id, ref, title, source_type, summary)
              VALUES (${caseId}, ${e.ref}, ${e.title}, ${e.source_type}, ${e.summary})`;
  }

  // Tasks
  for (const t of template.tasks) {
    await sql`INSERT INTO tasks (case_id, title, col, priority)
              VALUES (${caseId}, ${t.title}, ${t.col}, ${t.priority})`;
  }

  // Deadlines
  for (const d of template.deadlines) {
    await sql`INSERT INTO deadlines (case_id, label, date, priority)
              VALUES (${caseId}, ${d.label}, ${d.date}, ${d.priority})`;
  }

  // Finances
  for (const f of template.finances) {
    await sql`INSERT INTO financial_items (case_id, category, description, amount, date)
              VALUES (${caseId}, ${f.category}, ${f.description}, ${f.amount}, ${f.date})`;
  }

  return caseId;
}

// ── Clean ─────────────────────────────────────────────────────────────────────

async function clean() {
  console.log("Cleaning test users and cases…");
  const users = await clerk.users.getUserList({ limit: 100 });
  const testUsers = users.data.filter(u => u.publicMetadata?.[SEED_TAG]);
  for (const u of testUsers) {
    await sql`DELETE FROM purchases WHERE user_id = ${u.id}`;
    await sql`DELETE FROM users WHERE id = ${u.id}`;
    await clerk.users.deleteUser(u.id);
    console.log(`  Deleted user ${u.emailAddresses[0]?.emailAddress}`);
  }
  console.log("Done.");
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  const output: Array<{ email: string; password: string; cases: string[] }> = [];

  // User 1 — primary test user, all 5 case types
  // +clerk_test emails bypass OTP verification (code = 424242 in Clerk dev mode)
  console.log("\n── User 1 (all 5 case types) ──");
  const u1Email = "vera-test-user1+clerk_test@mailinator.com";
  const u1 = await createClerkUser(u1Email, "TestUser1");
  console.log(`  Created ${u1Email} (${u1.id})`);
  await ensureProUser(u1.id, u1Email);
  const u1Cases: string[] = [];
  for (const template of CASE_TEMPLATES) {
    const caseId = await seedCase(u1.id, template);
    u1Cases.push(caseId);
    console.log(`  → ${template.name}`);
  }
  output.push({ email: u1Email, password: TEST_PASSWORD, cases: u1Cases });

  // Users 2–5 — each gets all 5 cases
  for (let i = 2; i <= 5; i++) {
    console.log(`\n── User ${i} ──`);
    const email = `vera-test-user${i}+clerk_test@mailinator.com`;
    const u = await createClerkUser(email, `TestUser${i}`);
    console.log(`  Created ${email} (${u.id})`);
    await ensureProUser(u.id, email);
    const cases: string[] = [];
    for (const template of CASE_TEMPLATES) {
      const caseId = await seedCase(u.id, template);
      cases.push(caseId);
      console.log(`  → ${template.name}`);
    }
    output.push({ email, password: TEST_PASSWORD, cases });
  }

  // Write credentials for E2E tests
  const outPath = path.join(__dirname, "../.playwright/test-users.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\n✓ Seeded 5 users × 5 cases = 25 cases`);
  console.log(`✓ Credentials written to .playwright/test-users.json`);
  console.log(`\nTest password for all users: ${TEST_PASSWORD}`);
  console.log("Primary test user for E2E:", u1Email);
  console.log("\nAdd to .env.test.local:");
  console.log(`TEST_USER_EMAIL=${u1Email}`);
  console.log(`TEST_USER_PASSWORD=${TEST_PASSWORD}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(CLEAN ? clean() : seed()).catch(e => { console.error(e); process.exit(1); });
