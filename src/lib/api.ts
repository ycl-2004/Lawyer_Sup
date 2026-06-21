/** 后端 API 客户端。后端不可达时各调用方自动回退到本地实现（演示可离线）。 */

import type { CalculationResult, LimitationCheckResult } from "./compensation";
import type { LegalHit } from "./legalSearch";
import type {
  CaseDocument,
  Claim,
  Draft,
  ExtractedFact,
  Matter,
  Party,
  ReviewFinding,
  TimelineEvent,
} from "./types";

// 开发模式（vite 5173/5174）指向 8000；由后端静态托管时同源
const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (["5173", "5174"].includes(window.location.port) ? "http://localhost:8000" : "");

async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 4000,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  // FormData 上传必须由浏览器自动设置 multipart boundary，不能强加 JSON Content-Type
  const isForm = init?.body instanceof FormData;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface BackendWorkflowEvent {
  node: string;
  label: string;
  status: "done" | "error";
  summary: string;
}

export interface BackendWorkflowResult {
  matter_id: string;
  events: BackendWorkflowEvent[];
  legal_sources: LegalHit[];
  disclaimer: string;
}

export function runWorkflowBackend(matterId: string): Promise<BackendWorkflowResult> {
  return fetchJson(`/api/matters/${matterId}/workflows/run`, { method: "POST" }, 20000);
}

export function searchLegalBackend(
  query: string,
  topK = 5,
): Promise<{ results: LegalHit[]; disclaimer: string }> {
  return fetchJson(
    "/api/legal/search",
    { method: "POST", body: JSON.stringify({ query, top_k: topK }) },
    6000,
  );
}

export interface CitationFinding {
  citation: string;
  status: string;
  severity: "low" | "medium" | "high";
  message: string;
  matched_title?: string;
  effective_date?: string;
}

export interface CitationCheckResult {
  total_citations: number;
  unmatched: number;
  findings: CitationFinding[];
  disclaimer?: string;
}

export function checkCitationsBackend(text: string): Promise<CitationCheckResult> {
  return fetchJson(
    "/api/legal/citation-check",
    { method: "POST", body: JSON.stringify({ text }) },
    8000,
  );
}

/* ===================== 实时案件（本地持久化） ===================== */

interface BackendMatter {
  id: string;
  client_code: string;
  title: string;
  client_alias: string;
  opposing_party: string;
  jurisdiction: string;
  lead_lawyer: string;
  status: string;
  risk_level: string;
  summary: string;
  created_at: string;
  last_active_at: string;
  retention_until: string;
  live?: boolean;
}

export function mapMatter(m: BackendMatter): Matter {
  return {
    id: m.id,
    clientCode: m.client_code,
    isLive: true,
    retentionUntil: m.retention_until,
    title: m.title,
    clientAlias: m.client_alias,
    opposingParty: m.opposing_party,
    caseType: "劳动争议",
    jurisdiction: m.jurisdiction || "—",
    leadLawyer: m.lead_lawyer || "—",
    status: (m.status as Matter["status"]) || "intake",
    riskLevel: (m.risk_level as Matter["riskLevel"]) || "medium",
    summary: m.summary || "实时案件：上传材料并运行工作流后生成分析结果。",
    createdAt: m.created_at?.slice(0, 10) ?? "",
    updatedAt: m.last_active_at?.slice(0, 10) ?? "",
  };
}

export async function listLiveMatters(): Promise<Matter[]> {
  const res = await fetchJson<{ matters: BackendMatter[] }>("/api/matters", undefined, 3000);
  return res.matters.filter((m) => m.live).map(mapMatter);
}

export function createLiveMatter(payload: {
  client_alias: string;
  opposing_party: string;
  jurisdiction: string;
  lead_lawyer?: string;
}): Promise<BackendMatter> {
  return fetchJson("/api/matters", { method: "POST", body: JSON.stringify(payload) }, 6000);
}

export function uploadDocumentBackend(
  matterId: string,
  file: File,
): Promise<{ document_id: string; parse_status: string; parse_error: string | null }> {
  const form = new FormData();
  form.append("file", file);
  // 不设 Content-Type，浏览器自动带 multipart boundary
  return fetchJson(`/api/matters/${matterId}/documents`, { method: "POST", body: form, headers: {} }, 30000);
}

export function submitDocumentText(documentId: string, text: string): Promise<unknown> {
  return fetchJson(`/api/documents/${documentId}/text`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function patchDocumentTypeBackend(documentId: string, docType: string): Promise<unknown> {
  return fetchJson(`/api/documents/${documentId}/type`, {
    method: "PATCH",
    body: JSON.stringify({ doc_type: docType }),
  });
}

export function confirmMatterBackend(
  matterId: string,
  name: string,
): Promise<{ name: string; confirmed_at: string }> {
  return fetchJson(`/api/matters/${matterId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

/** 工作区数据包：后端 snake_case → 前端领域类型 */
export interface MappedBundle {
  matter: Matter;
  documents: CaseDocument[];
  parties: Party[];
  facts: ExtractedFact[];
  timeline: TimelineEvent[];
  claims: Claim[];
  calculations: CalculationResult[];
  limitation: LimitationCheckResult | null;
  drafts: Draft[];
  findings: ReviewFinding[];
  missingMaterials: string[];
  confirmation: { name: string; at: string } | null;
}

export async function getWorkspaceBundle(matterId: string): Promise<MappedBundle> {
  const b = await fetchJson<Record<string, any>>(`/api/matters/${matterId}/workspace`, undefined, 8000);

  const facts: ExtractedFact[] = (b.facts ?? []).map((f: any) => ({
    id: f.id,
    fieldKey: f.field_key,
    label: f.label,
    value: f.value,
    confidence: f.confidence,
    source: f.source_document_id
      ? { documentId: f.source_document_id, quote: f.source_quote ?? undefined }
      : undefined,
    needsReview: !!f.needs_review,
    missingNote: f.missing_note ?? undefined,
  }));

  const fm = new Map(facts.map((f) => [f.fieldKey, f]));
  const parties: Party[] = [];
  if (fm.get("employee_name")?.value) {
    parties.push({
      id: "p_live_1",
      role: "申请人（劳动者）",
      name: String(fm.get("employee_name")!.value),
      sourceDocumentId: fm.get("employee_name")!.source?.documentId,
    });
  }
  if (fm.get("employer_name")?.value) {
    parties.push({
      id: "p_live_2",
      role: "被申请人（用人单位）",
      name: String(fm.get("employer_name")!.value),
      sourceDocumentId: fm.get("employer_name")!.source?.documentId,
    });
  }

  const claims: Claim[] = (b.claims ?? []).map((c: any) => ({
    id: c.id,
    claimType: c.claim_type,
    title: c.title,
    status: c.status ?? "suggested",
    basisFacts: c.basis_facts ?? [],
    legalBasis: c.legal_basis ?? [],
    requiredEvidence: c.required_evidence ?? [],
    missingEvidence: c.missing_evidence ?? [],
    riskLevel: c.risk_level ?? "medium",
    alternativeGroup: c.alternative_group ?? undefined,
    note: c.note ?? undefined,
  }));

  const calculations: CalculationResult[] = [];
  let limitation: LimitationCheckResult | null = null;
  for (const c of b.calculations ?? []) {
    if (c.calculation_type) {
      calculations.push({
        id: c.id,
        calculationType: c.calculation_type,
        title: c.title,
        inputs: (c.inputs ?? []).map((i: any) => ({
          label: i.label,
          value: i.value,
          sourceNote: i.source_note ?? undefined,
          needsReview: !!i.needs_review,
        })),
        steps: c.steps ?? [],
        formula: c.formula ?? "",
        result: c.result,
        legalBasis: c.legal_basis ?? [],
        warnings: c.warnings ?? [],
        missingInputs: c.missing_inputs ?? [],
      });
    } else if (c.status) {
      limitation = {
        deadline: c.deadline,
        status: c.status,
        message: c.message,
        severity: c.severity,
      };
    }
  }

  const missing = new Set<string>();
  for (const c of claims) for (const m of c.missingEvidence) missing.add(m);

  return {
    matter: mapMatter(b.matter),
    documents: (b.documents ?? []).map(
      (d: any): CaseDocument => ({
        id: d.id,
        matterId: d.matter_id,
        filename: d.filename,
        fileType: d.file_type,
        docType: d.doc_type ?? "unknown",
        pages: d.pages ?? 1,
        parseStatus: d.parse_status,
        parseError: d.parse_error ?? undefined,
        ocrStatus: d.ocr_status ?? "not_needed",
        confidence: d.confidence ?? 0.5,
        classificationReason: d.classification_reason ?? "",
        keyExcerpt: d.key_excerpt || undefined,
        previewText: d.content || undefined,
        sensitive: !!d.sensitive,
      }),
    ),
    parties,
    facts,
    timeline: (b.timeline ?? []).map((e: any): TimelineEvent => ({
      id: e.id,
      date: e.event_date,
      eventType: e.event_type,
      title: e.title,
      description: e.description ?? "",
      sources: (e.sources ?? []).map((s: any) => ({
        documentId: s.documentId ?? s.document_id ?? "",
        quote: s.quote ?? undefined,
      })),
      confidence: e.confidence ?? 0.8,
      disputed: !!e.disputed,
      needsReview: !!e.needs_review,
    })),
    claims,
    calculations,
    limitation,
    drafts: (b.drafts ?? []).map((d: any): Draft => ({
      id: d.id,
      draftType: d.draft_type,
      title: d.title,
      contentMarkdown: d.content_markdown,
      version: d.version ?? 1,
      generatedAt: d.generated_at ?? "",
      basedOn: d.based_on ?? [],
    })),
    findings: (b.review_findings ?? []).map((r: any): ReviewFinding => ({
      id: r.id,
      severity: r.severity ?? "medium",
      findingType: r.finding_type ?? "needs_review_fact",
      message: r.message,
      location: r.location ?? "",
      suggestion: r.suggestion ?? "",
      resolved: !!r.resolved,
    })),
    missingMaterials: Array.from(missing),
    confirmation: b.confirmation
      ? { name: b.confirmation.name, at: b.confirmation.confirmed_at }
      : null,
  };
}
