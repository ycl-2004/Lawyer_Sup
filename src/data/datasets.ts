import type { CaseDataset } from "../lib/types";
import { DATASET_M002 } from "./caseLiu";
import {
  DEMO_CLAIMS,
  DEMO_DOCUMENTS,
  DEMO_EVIDENCE_MATRIX,
  DEMO_FACTS,
  DEMO_MISSING_MATERIALS,
  DEMO_PARTIES,
  DEMO_REVIEW_FINDINGS,
  DEMO_TIMELINE,
} from "./demoCase";
import { DEMO_DRAFTS } from "./drafts";

/** 案件 m_001（张某案）：默认已载入（模拟工作流已运行过） */
const DATASET_M001: CaseDataset = {
  requiresRun: false,
  calcKinds: ["unpaid", "economic", "unlawful", "limitation"],
  initialCalcParams: {
    monthlySalary: 12000,
    regionalAvgMonthlyWage: null,
    unpaidAmount: 6000,
    otHours150: null,
    otHours200: null,
    otHours300: null,
  },
  unpaidItem: {
    period: "2026年2月",
    sourceNote: "流水差额 + 聊天记录佐证（doc_003 / doc_004）",
  },
  documents: DEMO_DOCUMENTS,
  parties: DEMO_PARTIES,
  facts: DEMO_FACTS,
  timeline: DEMO_TIMELINE,
  claims: DEMO_CLAIMS,
  evidenceMatrix: DEMO_EVIDENCE_MATRIX,
  missingMaterials: DEMO_MISSING_MATERIALS,
  drafts: DEMO_DRAFTS,
  findings: DEMO_REVIEW_FINDINGS,
};

const DATASETS: Record<string, CaseDataset> = {
  m_001: DATASET_M001,
  m_002: DATASET_M002,
};

export function getDataset(matterId: string): CaseDataset | undefined {
  return DATASETS[matterId];
}
