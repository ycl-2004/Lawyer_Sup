# 规则抽取器评估报告（自动生成）

> 由 `python -m app.eval.run_eval` 生成。全部为虚构标注数据。
> 仅评估**确定性规则层**（离线可复现）；LLM 增强层非确定性，不在此离线评估。

## 汇总

- 案件数：8
- 标注真值字段总数：25
- 抽取器产出非空字段：21
- **召回 Recall：84.0%**（正确 21 / 真值 25；漏抽 4）
- **精确 Precision：100.0%**（正确 21 / 产出 21；值错 0）
- **编造 Fabrication：0**（红线指标，应为 0：抽取了真值中不存在的字段）
- **来源引用有效率：100.0%**（共 21 条引用，每条须为原文逐字子串）

## 分字段

| 字段 | 真值数 | 正确 | 漏抽 | 值错 |
|---|---|---|---|---|
| contract_signed | 4 | 4 | 0 | 0 |
| employee_name | 5 | 4 | 1 | 0 |
| employer_name | 5 | 4 | 1 | 0 |
| monthly_salary | 3 | 2 | 1 | 0 |
| start_date | 4 | 4 | 0 | 0 |
| termination_date | 2 | 1 | 1 | 0 |
| termination_reason | 2 | 2 | 0 | 0 |

## 分案件

| 案件 | 真值 | 产出 | 正确 | 漏抽 | 值错 | 编造 |
|---|---|---|---|---|---|---|
| eval_01_contract_standard | 5 | 5 | 5 | 0 | 0 | 0 |
| eval_02_termination_standard | 4 | 2 | 2 | 2 | 0 | 0 |
| eval_03_contract_comma_salary | 5 | 5 | 5 | 0 | 0 | 0 |
| eval_04_contract_alt_salary_phrasing | 5 | 4 | 4 | 1 | 0 | 0 |
| eval_05_termination_alt_date_phrasing | 2 | 1 | 1 | 1 | 0 | 0 |
| eval_06_chat_record_no_fields | 0 | 0 | 0 | 0 | 0 | 0 |
| eval_07_client_statement_no_fields | 0 | 0 | 0 | 0 | 0 | 0 |
| eval_08_contract_missing_salary | 4 | 4 | 4 | 0 | 0 | 0 |

## 诚实解读

- 规则层的设计取向是**高精确、低召回**：对制式文书（含「甲方/乙方/月工资…元/于…解除」锚点）抽取稳定；
  对非制式表述（如「每月薪资」「自…起解除」「姓名：」无甲乙方前缀）会**主动漏抽**而非猜测——
  这正是「不许猜」红线的体现，漏抽由 LLM 增强层与人工在工作台补齐。
- **编造数应恒为 0、引用有效率应恒为 100%**：这两项是反幻觉护栏的硬指标，比召回更关键。
- 召回数字偏低是**诚实的规则层基线**，不代表系统整体能力（LLM 增强 + 人工确认未计入）。
