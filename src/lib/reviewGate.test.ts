import { describe, expect, it } from "vitest";
import {
  allChecklistApproved,
  canConfirmReview,
  highUnresolvedFindings,
} from "./reviewGate";

const ALL_APPROVED = { facts: true, citations: true, amounts: true, privacy: true };

describe("highUnresolvedFindings", () => {
  it("只取高风险且未处理项", () => {
    const findings = [
      { severity: "high", resolved: false },
      { severity: "high", resolved: true }, // 已处理 → 不阻断
      { severity: "medium", resolved: false }, // 非高风险 → 不阻断
      { severity: "low", resolved: false },
    ];
    expect(highUnresolvedFindings(findings)).toHaveLength(1);
  });
});

describe("allChecklistApproved", () => {
  it("四项全勾才算通过", () => {
    expect(allChecklistApproved(ALL_APPROVED)).toBe(true);
    expect(allChecklistApproved({ ...ALL_APPROVED, privacy: false })).toBe(false);
    expect(allChecklistApproved({})).toBe(false);
  });
});

describe("canConfirmReview (导出门槛红线)", () => {
  it("全部满足 → 可确认", () => {
    expect(
      canConfirmReview({ approvals: ALL_APPROVED, findings: [], lawyerName: "张律师" }),
    ).toBe(true);
  });

  it("有未处理高风险发现 → 阻断", () => {
    expect(
      canConfirmReview({
        approvals: ALL_APPROVED,
        findings: [{ severity: "high", resolved: false }],
        lawyerName: "张律师",
      }),
    ).toBe(false);
  });

  it("高风险已处理 → 不阻断", () => {
    expect(
      canConfirmReview({
        approvals: ALL_APPROVED,
        findings: [{ severity: "high", resolved: true }],
        lawyerName: "张律师",
      }),
    ).toBe(true);
  });

  it("清单未全勾 → 阻断", () => {
    expect(
      canConfirmReview({
        approvals: { ...ALL_APPROVED, amounts: false },
        findings: [],
        lawyerName: "张律师",
      }),
    ).toBe(false);
  });

  it("律师姓名为空或纯空格 → 阻断", () => {
    expect(canConfirmReview({ approvals: ALL_APPROVED, findings: [], lawyerName: "" })).toBe(false);
    expect(canConfirmReview({ approvals: ALL_APPROVED, findings: [], lawyerName: "   " })).toBe(
      false,
    );
  });
});
