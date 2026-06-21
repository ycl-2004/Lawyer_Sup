/**
 * 复核导出门槛（review gate）纯逻辑。
 *
 * 红线：高风险复核发现必须全部处理、四项确认清单全部勾选、且填写承办律师姓名，
 * 三者同时满足方可「确认复核完成」（确认后才解锁材料包导出）。
 * 抽离为纯函数以便单测，并被 ReviewSection 复用，避免门槛逻辑散落在 UI 中漂移。
 */
import { APPROVAL_CHECKLIST } from "../config/compliance";

/** 仅依赖 severity / resolved 的结构化类型，避免与具体 ReviewFinding 强耦合。 */
export interface GateFinding {
  severity: string;
  resolved: boolean;
}

export interface ReviewGateInput {
  approvals: Record<string, boolean>;
  findings: GateFinding[];
  lawyerName: string;
}

/** 未处理的高风险复核发现（处理完成前阻断确认）。 */
export function highUnresolvedFindings<T extends GateFinding>(findings: T[]): T[] {
  return findings.filter((f) => f.severity === "high" && !f.resolved);
}

/** 四项确认清单是否全部勾选。 */
export function allChecklistApproved(approvals: Record<string, boolean>): boolean {
  return APPROVAL_CHECKLIST.every((c) => approvals[c.key]);
}

/** 是否可确认复核完成（导出门槛）。 */
export function canConfirmReview({ approvals, findings, lawyerName }: ReviewGateInput): boolean {
  return (
    allChecklistApproved(approvals) &&
    highUnresolvedFindings(findings).length === 0 &&
    lawyerName.trim().length > 0
  );
}
