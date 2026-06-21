import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CalculationResult } from "../../lib/compensation";
import { CalculationCard } from "./CalculationCard";

function makeResult(over: Partial<CalculationResult> = {}): CalculationResult {
  return {
    id: "calc_economic_compensation",
    calculationType: "economic_compensation",
    title: "经济补偿金（草稿）",
    inputs: [{ label: "月工资", value: 12000, needsReview: true }],
    steps: ["计算：12000 × 2 = 24000"],
    formula: "经济补偿 = 月工资基数 × 补偿月数",
    result: 24000,
    legalBasis: ["《劳动合同法》第四十七条"],
    warnings: ["月工资口径需律师复核。"],
    missingInputs: [],
    ...over,
  };
}

describe("CalculationCard", () => {
  it("有结果时显示金额与「草稿 · 需律师复核」徽章，不显示拒绝文案", () => {
    render(<CalculationCard result={makeResult()} />);
    expect(screen.getByText(/草稿 · 需律师复核/)).toBeInTheDocument();
    expect(screen.getByText(/经济补偿 = 月工资基数/)).toBeInTheDocument();
    expect(screen.queryByText(/无法计算/)).not.toBeInTheDocument();
  });

  it("缺少输入时显示「无法计算 — 缺少输入」并列出缺失项（不做推测）", () => {
    render(
      <CalculationCard
        result={makeResult({ result: null, missingInputs: ["月工资", "入职日期"] })}
      />,
    );
    const refusal = screen.getByText(/无法计算 — 缺少输入/);
    expect(refusal).toBeInTheDocument();
    expect(refusal.textContent).toContain("月工资");
    expect(refusal.textContent).toContain("入职日期");
    // 不应渲染「草稿 · 需律师复核」徽章（没有金额）
    expect(screen.queryByText(/草稿 · 需律师复核/)).not.toBeInTheDocument();
  });

  it("渲染警告项", () => {
    render(<CalculationCard result={makeResult({ warnings: ["社平工资需核对当地标准。"] })} />);
    expect(screen.getByText(/社平工资需核对当地标准/)).toBeInTheDocument();
  });

  it("默认折叠推导过程，点击后展开可见", () => {
    render(<CalculationCard result={makeResult()} />);
    // 折叠态：推导步骤不可见
    expect(screen.queryByText(/计算：12000 × 2 = 24000/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/查看输入与推导过程/));
    // 展开后可见推导过程与依据
    expect(screen.getByText(/计算：12000 × 2 = 24000/)).toBeInTheDocument();
    expect(screen.getByText(/《劳动合同法》第四十七条/)).toBeInTheDocument();
  });
});
