import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  confirmMatterBackend,
  getWorkspaceBundle,
  patchDocumentTypeBackend,
} from "../lib/api";
import type { CalculationResult, LimitationCheckResult } from "../lib/compensation";
import { getDataset } from "../data/datasets";
import type {
  CalcKind,
  CalcParams,
  CaseDocument,
  Claim,
  ClaimStatus,
  Draft,
  EvidenceRow,
  ExtractedFact,
  Matter,
  Party,
  ReviewFinding,
  TimelineEvent,
} from "../lib/types";

const EMPTY_CALC_PARAMS: CalcParams = {
  monthlySalary: null,
  regionalAvgMonthlyWage: null,
  unpaidAmount: null,
  otHours150: null,
  otHours200: null,
  otHours300: null,
};

interface CaseContextValue {
  matter: Matter;
  /** 数据集已载入（可浏览分析结果） */
  hasData: boolean;
  /** 存在数据集，可通过「运行 Agent 工作流」载入 */
  workflowAvailable: boolean;
  /** 实时案件：数据来自本地后端数据库（真实上传/抽取/持久化） */
  isLive: boolean;
  refreshing: boolean;
  backendError: string | null;
  /** 实时案件：从后端重新拉取工作区数据 */
  refresh: () => Promise<void>;
  /** 实时案件的后端确定性计算结果 */
  backendCalcs: CalculationResult[];
  backendLimitation: LimitationCheckResult | null;
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
  unpaidItem?: { period: string; sourceNote: string };
  calcParams: CalcParams;
  approvals: Record<string, boolean>;
  /** 律师复核确认记录（审计：确认人 + 时间）。null = 未确认 */
  confirmation: { name: string; at: string } | null;
  // actions
  completeWorkflowRun: () => void;
  addDocument: (d: CaseDocument) => void;
  removeDocument: (id: string) => void;
  markDocumentParsed: (id: string) => void;
  setDocumentType: (id: string, docType: CaseDocument["docType"]) => void;
  addClaim: (c: Claim) => void;
  removeClaim: (id: string) => void;
  addMissingMaterial: (item: string) => void;
  removeMissingMaterial: (index: number) => void;
  toggleEventDisputed: (id: string) => void;
  removeEvent: (id: string) => void;
  addEvent: (e: TimelineEvent) => void;
  setClaimStatus: (id: string, status: ClaimStatus) => void;
  updateDraft: (id: string, content: string) => void;
  toggleFindingResolved: (id: string) => void;
  setCalcParam: (key: keyof CalcParams, value: number | null) => void;
  toggleApproval: (key: string) => void;
  confirmLawyer: (name: string) => void;
}

const CaseContext = createContext<CaseContextValue | null>(null);

export function CaseProvider({
  matter,
  live = false,
  children,
}: {
  matter: Matter;
  live?: boolean;
  children: ReactNode;
}) {
  const dataset = live ? undefined : getDataset(matter.id);
  const initiallyLoaded = !!dataset && !dataset.requiresRun;

  const [loaded, setLoaded] = useState(initiallyLoaded);
  const [documents, setDocuments] = useState<CaseDocument[]>(
    initiallyLoaded ? dataset!.documents : [],
  );
  const [parties, setParties] = useState<Party[]>(
    initiallyLoaded ? dataset!.parties : [],
  );
  const [facts, setFacts] = useState<ExtractedFact[]>(
    initiallyLoaded ? dataset!.facts : [],
  );
  const [timeline, setTimeline] = useState<TimelineEvent[]>(
    initiallyLoaded ? dataset!.timeline : [],
  );
  const [claims, setClaims] = useState<Claim[]>(
    initiallyLoaded ? dataset!.claims : [],
  );
  const [evidenceMatrix, setEvidenceMatrix] = useState<EvidenceRow[]>(
    initiallyLoaded ? dataset!.evidenceMatrix : [],
  );
  const [missingMaterials, setMissingMaterials] = useState<string[]>(
    initiallyLoaded ? dataset!.missingMaterials : [],
  );
  const [drafts, setDrafts] = useState<Draft[]>(
    initiallyLoaded ? dataset!.drafts : [],
  );
  const [findings, setFindings] = useState<ReviewFinding[]>(
    initiallyLoaded ? dataset!.findings : [],
  );
  const [calcParams, setCalcParams] = useState<CalcParams>(
    initiallyLoaded ? dataset!.initialCalcParams : EMPTY_CALC_PARAMS,
  );
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [confirmation, setConfirmation] = useState<{ name: string; at: string } | null>(null);
  const [backendCalcs, setBackendCalcs] = useState<CalculationResult[]>([]);
  const [backendLimitation, setBackendLimitation] = useState<LimitationCheckResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  /** 实时案件：从后端数据库拉取工作区（访问即自动续期保留期） */
  const refresh = useCallback(async () => {
    if (!live) return;
    setRefreshing(true);
    try {
      const b = await getWorkspaceBundle(matter.id);
      setDocuments(b.documents);
      setParties(b.parties);
      setFacts(b.facts);
      setTimeline(b.timeline);
      setClaims(b.claims);
      setDrafts(b.drafts);
      setFindings(b.findings);
      setMissingMaterials(b.missingMaterials);
      setBackendCalcs(b.calculations);
      setBackendLimitation(b.limitation);
      if (b.confirmation) setConfirmation(b.confirmation);
      setLoaded(b.facts.length > 0 || b.timeline.length > 0 || b.drafts.length > 0);
      setBackendError(null);
    } catch {
      setBackendError("无法连接后端服务——请先启动后端（双击 start_mac.command 或见 backend/README.md）。");
    } finally {
      setRefreshing(false);
    }
  }, [live, matter.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const confirmLawyer = useCallback(
    (name: string) => {
      if (live) {
        confirmMatterBackend(matter.id, name)
          .then((r) => setConfirmation({ name: r.name, at: r.confirmed_at }))
          .catch(() =>
            setConfirmation({ name, at: `${new Date().toLocaleString("zh-CN")}（后端未连接，仅本地记录）` }),
          );
      } else {
        setConfirmation({ name, at: new Date().toLocaleString("zh-CN") });
      }
    },
    [live, matter.id],
  );

  /** 工作流运行完成 → 载入数据集（演示：预置结果；接入后端后为真实输出） */
  const completeWorkflowRun = useCallback(() => {
    if (!dataset || loaded) return;
    setDocuments(dataset.documents);
    setParties(dataset.parties);
    setFacts(dataset.facts);
    setTimeline(dataset.timeline);
    setClaims(dataset.claims);
    setEvidenceMatrix(dataset.evidenceMatrix);
    setMissingMaterials(dataset.missingMaterials);
    setDrafts(dataset.drafts);
    setFindings(dataset.findings);
    setCalcParams(dataset.initialCalcParams);
    setLoaded(true);
  }, [dataset, loaded]);

  const addDocument = useCallback((d: CaseDocument) => {
    setDocuments((docs) => [...docs, d]);
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((docs) => docs.filter((d) => d.id !== id));
  }, []);

  const addClaim = useCallback((c: Claim) => {
    setClaims((cs) => [...cs, c]);
  }, []);

  const removeClaim = useCallback((id: string) => {
    setClaims((cs) => cs.filter((c) => c.id !== id));
  }, []);

  const addMissingMaterial = useCallback((item: string) => {
    setMissingMaterials((ms) => [...ms, item]);
  }, []);

  const removeMissingMaterial = useCallback((index: number) => {
    setMissingMaterials((ms) => ms.filter((_, i) => i !== index));
  }, []);

  const markDocumentParsed = useCallback((id: string) => {
    setDocuments((docs) =>
      docs.map((d) =>
        d.id === id ? { ...d, parseStatus: "parsed" as const } : d,
      ),
    );
  }, []);

  const setDocumentType = useCallback(
    (id: string, docType: CaseDocument["docType"]) => {
      setDocuments((docs) =>
        docs.map((d) =>
          d.id === id
            ? {
                ...d,
                docType,
                confidence: 1,
                classificationReason: "人工修正分类（律师确认）",
              }
            : d,
        ),
      );
      if (live) {
        patchDocumentTypeBackend(id, docType).catch(() => {
          /* 后端不可达时仅本地生效，刷新后以后端为准 */
        });
      }
    },
    [live],
  );

  const toggleEventDisputed = useCallback((id: string) => {
    setTimeline((evts) =>
      evts.map((e) => (e.id === id ? { ...e, disputed: !e.disputed } : e)),
    );
  }, []);

  const removeEvent = useCallback((id: string) => {
    setTimeline((evts) => evts.filter((e) => e.id !== id));
  }, []);

  const addEvent = useCallback((e: TimelineEvent) => {
    setTimeline((evts) =>
      [...evts, e].sort((a, b) => a.date.localeCompare(b.date)),
    );
  }, []);

  const setClaimStatus = useCallback((id: string, status: ClaimStatus) => {
    setClaims((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
  }, []);

  const updateDraft = useCallback((id: string, content: string) => {
    setDrafts((ds) =>
      ds.map((d) => (d.id === id ? { ...d, contentMarkdown: content } : d)),
    );
  }, []);

  const toggleFindingResolved = useCallback((id: string) => {
    setFindings((fs) =>
      fs.map((f) => (f.id === id ? { ...f, resolved: !f.resolved } : f)),
    );
  }, []);

  const setCalcParam = useCallback(
    (key: keyof CalcParams, value: number | null) => {
      setCalcParams((p) => ({ ...p, [key]: value }));
    },
    [],
  );

  const toggleApproval = useCallback((key: string) => {
    setApprovals((a) => ({ ...a, [key]: !a[key] }));
  }, []);

  const value = useMemo<CaseContextValue>(
    () => ({
      matter,
      hasData: loaded,
      workflowAvailable: !!dataset || live,
      isLive: live,
      refreshing,
      backendError,
      refresh,
      backendCalcs,
      backendLimitation,
      documents,
      parties,
      facts,
      timeline,
      claims,
      evidenceMatrix,
      missingMaterials,
      drafts,
      findings,
      calcKinds: loaded && dataset ? dataset.calcKinds : [],
      unpaidItem: dataset?.unpaidItem,
      calcParams,
      approvals,
      confirmation,
      completeWorkflowRun,
      addDocument,
      removeDocument,
      markDocumentParsed,
      setDocumentType,
      addClaim,
      removeClaim,
      addMissingMaterial,
      removeMissingMaterial,
      toggleEventDisputed,
      removeEvent,
      addEvent,
      setClaimStatus,
      updateDraft,
      toggleFindingResolved,
      setCalcParam,
      toggleApproval,
      confirmLawyer,
    }),
    [
      matter,
      loaded,
      dataset,
      live,
      refreshing,
      backendError,
      refresh,
      backendCalcs,
      backendLimitation,
      documents,
      parties,
      facts,
      timeline,
      claims,
      evidenceMatrix,
      missingMaterials,
      drafts,
      findings,
      calcParams,
      approvals,
      confirmation,
      completeWorkflowRun,
      addDocument,
      removeDocument,
      markDocumentParsed,
      setDocumentType,
      addClaim,
      removeClaim,
      addMissingMaterial,
      removeMissingMaterial,
      toggleEventDisputed,
      removeEvent,
      addEvent,
      setClaimStatus,
      updateDraft,
      toggleFindingResolved,
      setCalcParam,
      toggleApproval,
      confirmLawyer,
    ],
  );

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase(): CaseContextValue {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error("useCase must be used within CaseProvider");
  return ctx;
}
