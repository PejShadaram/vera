export type CaseType =
  | "divorce"
  | "custody"
  | "landlord_tenant"
  | "employment"
  | "small_claims"
  | "other";

export type CaseStatus = "active" | "closed";

export interface Case {
  id: string;
  user_id: string;
  name: string;
  case_type: CaseType;
  status: CaseStatus;
  opposing_party?: string;
  court_name?: string;
  case_number?: string;
  jurisdiction?: string;
  filed_at?: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface TimelineEntry {
  id: string;
  case_id: string;
  date: string;
  event: string;
  source?: string;
  highlight: boolean;
  created_at: string;
}

export interface EvidenceItem {
  id: string;
  case_id: string;
  title: string;
  summary?: string;
  source_type?: string;
  dates?: string;
  filename?: string;
  status: "On file" | "Referenced" | "Not produced";
  created_at: string;
}

export interface Task {
  id: string;
  case_id: string;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  col: "todo" | "inprogress" | "done";
  created_at: string;
  started_at?: string;
  completed_at?: string;
  tags: string[];
}

export interface Document {
  id: string;
  case_id: string;
  filename: string;
  blob_url: string;
  blob_pathname: string;
  processed: boolean;
  processed_at?: string;
  created_at: string;
}

export interface Deadline {
  id: string;
  case_id: string;
  label: string;
  date: string;
  priority: "critical" | "high" | "medium";
  note?: string;
  completed: boolean;
}

export interface Purchase {
  id: string;
  user_id: string;
  case_id?: string;
  tier: "essential" | "complete" | "multi";
  amount_cents: number;
  created_at: string;
}
