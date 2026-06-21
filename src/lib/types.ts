/** 核心领域类型（与计划 §14 数据模型对应的前端 MVP 版本） */

export type RiskLevel = "low" | "medium" | "high";

export type MatterStatus = "intake" | "extracting" | "review" | "draft" | "done";

export interface Matter {
  id: string;
  /** 客户代号，如 C-26021 */
  clientCode: string;
  /** 实时案件：数据来自本地后端数据库（持久化，14天无活动自动清理） */
  isLive?: boolean;
  retentionUntil?: string;
  title: string;
  clientAlias: string;
  opposingParty: string;
  caseType: string;
  jurisdiction: string;
  leadLawyer: string;
  status: MatterStatus;
  riskLevel: RiskLevel;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

/** 引用锚点：每个事实/事件必须可回溯到材料 */
export interface SourceRef {
  documentId: string;
  page?: number;
  quote?: string;
}

export type DocumentType =
  | "labor_contract"
  | "offer"
  | "termination_notice"
  | "payslip"
  | "bank_transfer"
  | "attendance"
  | "chat_record"
  | "social_insurance"
  | "id_document"
  | "business_registration"
  | "client_statement"
  | "unknown";

export interface CaseDocument {
  id: string;
  matterId: string;
  filename: string;
  fileType: string;
  docType: DocumentType;
  pages: number;
  parseStatus: "parsed" | "pending" | "failed";
  /** MVP 不做真实 OCR：图片材料标记为 mocked（演示用预置文本） */
  ocrStatus: "not_needed" | "mocked" | "pending";
  confidence: number;
  classificationReason: string;
  keyExcerpt?: string;
  /** 解析出的全文（演示为预置文本），供预览抽屉展示 */
  previewText?: string;
  /** 解析失败原因（实时案件），前端据此引导"手动粘贴文本" */
  parseError?: string;
  sensitive?: boolean;
}

export interface Party {
  id: string;
  role: string;
  name: string;
  idNumberRedacted?: string;
  contactRedacted?: string;
  sourceDocumentId?: string;
}

export interface ExtractedFact {
  id: string;
  fieldKey: string;
  label: string;
  /** null = 材料中缺失，显示占位符，绝不推测补全 */
  value: string | null;
  confidence: number | null;
  source?: SourceRef;
  needsReview: boolean;
  sensitive?: boolean;
  missingNote?: string;
}

export type TimelineEventType =
  | "入职"
  | "签订合同"
  | "工资支付"
  | "争议沟通"
  | "解除通知"
  | "离职"
  | "其他";

export const TIMELINE_EVENT_TYPES: TimelineEventType[] = [
  "入职",
  "签订合同",
  "工资支付",
  "争议沟通",
  "解除通知",
  "离职",
  "其他",
];

export interface TimelineEvent {
  id: string;
  date: string;
  eventType: TimelineEventType;
  title: string;
  description: string;
  sources: SourceRef[];
  confidence: number;
  disputed: boolean;
  needsReview: boolean;
}

export type ClaimStatus = "suggested" | "confirmed" | "excluded";

export interface Claim {
  id: string;
  claimType: string;
  title: string;
  status: ClaimStatus;
  basisFacts: string[];
  legalBasis: string[];
  requiredEvidence: string[];
  missingEvidence: string[];
  riskLevel: RiskLevel;
  /** 互斥组：同组请求只能择一主张（如经济补偿金 vs 违法解除赔偿金） */
  alternativeGroup?: string;
  note?: string;
}

export interface EvidenceRow {
  id: string;
  issue: string;
  claimantPosition: string;
  factsToProve: string[];
  existingEvidence: string[];
  missingEvidence: string[];
  riskLevel: RiskLevel;
  lawyerNote: string;
}

export interface LegalSourceCard {
  id: string;
  sourceType: "law" | "judicial_interpretation" | "case";
  title: string;
  article?: string;
  summary: string;
  relevance: string;
  effectiveDate?: string;
  citation: string;
  needsVerification: boolean;
}

export interface Draft {
  id: string;
  draftType: string;
  title: string;
  contentMarkdown: string;
  version: number;
  generatedAt: string;
  basedOn: string[];
}

export type FindingType =
  | "unsupported_fact"
  | "missing_evidence"
  | "citation_check"
  | "privacy"
  | "overstatement"
  | "needs_review_fact";

export interface ReviewFinding {
  id: string;
  severity: RiskLevel;
  findingType: FindingType;
  message: string;
  location: string;
  suggestion: string;
  resolved: boolean;
}

export const FINDING_TYPE_LABELS: Record<FindingType, string> = {
  unsupported_fact: "无来源事实",
  missing_evidence: "证据缺失",
  citation_check: "引用待核对",
  privacy: "隐私脱敏",
  overstatement: "表述过度",
  needs_review_fact: "待复核字段",
};

/** 金额计算的可编辑参数（人工输入，供确定性计算服务使用） */
export interface CalcParams {
  monthlySalary: number | null;
  regionalAvgMonthlyWage: number | null;
  /** 拖欠工资金额（按数据集 unpaidItem 的期间） */
  unpaidAmount: number | null;
  otHours150: number | null;
  otHours200: number | null;
  otHours300: number | null;
}

export type CalcKind = "unpaid" | "economic" | "unlawful" | "overtime" | "limitation";

/** 一个案件的完整演示数据集（模拟 Agent 工作流的输出） */
export interface CaseDataset {
  documents: CaseDocument[];
  parties: Party[];
  facts: ExtractedFact[];
  timeline: TimelineEvent[];
  claims: Claim[];
  evidenceMatrix: EvidenceRow[];
  missingMaterials: string[];
  drafts: Draft[];
  findings: ReviewFinding[];
  calcKinds: CalcKind[];
  initialCalcParams: CalcParams;
  unpaidItem?: { period: string; sourceNote: string };
  /** true = 需要点击「运行 Agent 工作流」后才载入（演示动效） */
  requiresRun: boolean;
}

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  labor_contract: "劳动合同",
  offer: "Offer/入职确认",
  termination_notice: "解除通知",
  payslip: "工资条",
  bank_transfer: "银行转账记录",
  attendance: "考勤记录",
  chat_record: "聊天记录",
  social_insurance: "社保记录",
  id_document: "身份证明",
  business_registration: "工商信息",
  client_statement: "客户口述事实",
  unknown: "未识别",
};

export const MATTER_STATUS_LABELS: Record<MatterStatus, string> = {
  intake: "材料收集",
  extracting: "抽取整理",
  review: "复核中",
  draft: "草稿阶段",
  done: "已归档",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "低",
  medium: "中",
  high: "高",
};
