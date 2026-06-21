# 如何给法律 AI 设计「不许猜」的工程约束

> 一个劳动争议仲裁工作台（LawDesk Junior）的实践复盘。
> 结论先行：在高风险领域，**让模型「不许猜」比让它「更聪明」更重要**，而「不许猜」不是写在 prompt 里的祈使句，是写在代码、测试和 UI 里的硬约束。

## 一、问题：法律 AI 的「可信度赤字」

把一份解除通知喂给大模型，让它「生成一份仲裁申请书」，几秒钟就能得到一篇结构完整、措辞专业的文书。问题是——

- 它会**编金额**：材料里没写工龄，它照样算出一个「经济补偿 36000 元」。
- 它会**幻觉法条**：引用《劳动合同法》第九百条（该法没有第九百条）。
- 它会**无中生有**：把「2 月工资只发了一半」脑补成具体的拖欠数额。

在写代码、写营销文案的场景，这种「自信的错误」是可接受的噪声；在法律场景，它是**事故**。律师不能拿一份「看起来对」的文书去开庭。

所以这个项目的设计起点不是「怎么让 AI 写得更好」，而是「**怎么让 AI 在不确定的时候闭嘴**」。

## 二、四条「不许猜」约束

### 约束 1：金额不交给模型——缺输入就拒绝计算

经济补偿、加班费、二倍工资差额这些金额，公式是**确定的**（《劳动合同法》第四十七条等）。既然确定，就没有任何理由交给概率模型去「推测」。我们把公式写死在代码里，并且——**缺输入时返回 `null`，而不是猜一个数**：

```python
def calc_economic_compensation(monthly_salary, start_date, end_date, ...):
    missing = []
    if not monthly_salary or monthly_salary <= 0: missing.append("月工资")
    if not start_date: missing.append("入职日期")
    if not end_date:   missing.append("离职/解除日期")
    # 日期冲突也算「无效输入」——解除日期早于入职日期，拒绝计算
    if date_conflict: 
        r.warnings.append("解除/离职日期早于入职日期（日期冲突），拒绝计算。")
        return r              # result 保持 None
    if missing:
        r.warnings.append(f"缺少必要输入（{'、'.join(missing)}），拒绝计算，不做推测。")
        return r              # result 保持 None
    ...
```

UI 层忠实地把这个「拒绝」呈现出来——计算卡片显示**「无法计算 — 缺少输入：加班小时数」**，而不是一个看起来合理的假数字：

```tsx
{refused ? (
  <p className="text-red-700">无法计算 — 缺少输入：{result.missingInputs.join("、")}（不做推测）</p>
) : (
  <p>{formatCurrency(result.result!)} <Badge>草稿 · 需律师复核</Badge></p>
)}
```

> **演示效果最好的一幕**：加班费案里加班小时数为空 → 卡片拒绝计算 → 律师手动填入考勤核定的小时数 → 金额立即算出。一拒一算，把「系统不替你推测工时」这条红线讲得明明白白。

### 约束 2：事实必须有来源——引用不在原文里就强制复核

抽取出来的每一个事实，都必须附带一段**逐字出自原文**的引用。如果模型给出的引用在原文里找不到（说明它在改写或幻觉），就强制降置信度 + 标记 `needs_review`：

```python
def _validate(facts, source_text, document_id):
    for f in facts:
        quote = (f.get("source") or {}).get("quote")
        if f["value"] is not None:
            if not quote:                      # 有值无引用 → 复核
                f["needs_review"] = True
            elif quote not in source_text:     # 引用不在原文 → 疑似幻觉
                f["needs_review"] = True
                f["confidence"] = min(f["confidence"], 0.5)
```

这条约束有个容易被忽略的细节：**规则抽取自己也要守规矩**。我们的评估集就抓到一个 bug——`contract_signed` 字段用了一段拼接的示意引用 `"劳动合同…甲方…乙方"`（带省略号，不是原文子串），违反了「引用必须逐字」的不变量。修复方式是改用真实出现的「甲方…」行：

```python
party_line = re.search(r"甲方[^\n]{0,40}", text)
quote = party_line.group(0) if party_line else "劳动合同"
```

### 约束 3：引用不许幻觉——草稿里的法条要和知识库对账

文书草稿里引用的每一条《法律》第 X 条，都要和法条知识库**对账**。命中不了的，当场标红为高风险（疑似幻觉引用或库未覆盖）：

```python
check_citations("依据《劳动合同法》第四十七条、第八十七条及《不存在法》第一条…第九百条。")
# → total=5, matched=3, unmatched=2（《不存在法》幻觉法名 + 第九百条幻觉条号各一条 high）
```

这套核对支持「第 A 条、第 B 条」枚举与法律简称，golden 用例覆盖了「幻觉法名」和「幻觉条号」两类。

### 约束 4：律师说了才算——确认门槛锁死导出

再好的草稿也只是草稿。导出前必须**同时**满足：高风险复核发现全部处理 + 四项确认清单全勾 + 填写承办律师姓名。我们把这条门槛从 UI 里抽成纯函数，既可单测、又防止逻辑散落漂移：

```typescript
export function canConfirmReview({ approvals, findings, lawyerName }): boolean {
  return allChecklistApproved(approvals)
    && highUnresolvedFindings(findings).length === 0
    && lawyerName.trim().length > 0;
}
```

任一不满足，「确认」按钮禁用、导出不可点。**「AI 生成」和「可以交付」之间，永远隔着一个律师的签名。**

## 三、评估：让「不许猜」成为可回归的数字

主张「我们不幻觉」是廉价的，得有数字。我们建了一个 8 案标注评估集，**诚实地**只评估确定性规则层（LLM 层非确定性，单列）：

```
召回 Recall：84.0%    （正确 21 / 真值 25；漏抽 4）
精确 Precision：100%  （抽出来的值无一错）
编造 Fabrication：0   ← 红线：绝不产出真值中不存在的字段
来源引用有效率：100%  ← 红线：每条引用都是原文逐字子串
```

关键不是召回 84% 这个数，而是**两条红线指标（编造 0、引用有效 100%）被写成了 CI 里的断言**：

```python
def test_no_fabrication_red_line():
    assert run_eval()["fabricated"] == 0
def test_source_quotes_all_verbatim():
    assert run_eval()["quote_validity"] == 1.0
```

而且——**这个评估集第一次跑就抓出两个真实 bug**：一个是上面说的非原文引用；另一个是抽取器把解除条款里的「自 2026 年 2 月 1 日**起**解除劳动合同」误判成了入职日期（`自…起` 的正则贪婪匹配）。修一个负向先行就解决：

```python
r"(?:期限自|合同期限自|自)\s*(" + CN_DATE_RE + r")\s*起(?!\s*(?:解除|终止))"
```

> **召回故意不追求 100%**：对「每月薪资」（非「月工资」）、「自…起解除」这类非制式表述，规则层**主动漏抽而不是猜**——漏抽交给 LLM 增强和人工补齐。这正是「不许猜」在召回/精确权衡上的体现：**宁可漏，不可错。**

## 四、几条可迁移的经验

1. **「不许猜」是系统属性，不是 prompt 属性。** 写在 prompt 里的「请不要编造」会被概率淹没；写在代码里的 `return None`、写在测试里的 `assert fabricated == 0`、写在 UI 里的「无法计算」才是硬约束。
2. **确定性的部分就别交给模型。** 金额有公式、法条能对账——这些用规则/检索做，既可解释又可测试，把模型的不确定性挡在核心计算之外。
3. **高精确 + 诚实低召回 > 虚高的全覆盖。** 在高风险域，一个「我不知道」远比一个「自信的错误」有价值。
4. **评估集的第一价值是抓 bug。** 它逼你把「我觉得对」变成「我测过对」，往往第一次跑就打脸——这是好事。
5. **证据链要四层对应。** 主张→代码→测试→UI 行为，每一环都能点开看，才扛得住「这是真的吗」的追问。

---

*项目源码与运行说明见 [README](../../README.md)；架构见 [architecture.md](../architecture.md)。
全部为虚构演示数据；本系统为律师内部辅助工具，不构成法律意见。*
