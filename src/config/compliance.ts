/**
 * 合规与风险措辞统一配置。
 * 产品定位：律师/律师助理内部辅助工作台。
 * 红线：不输出最终法律意见，不承诺结果，不替代律师判断。
 */

export const PRODUCT_NAME = "LawDesk Junior";
export const PRODUCT_NAME_ZH = "初级律师工作台";

export const POSITIONING_BADGE = "内部辅助工具 · 输出均为草稿";

export const GLOBAL_DISCLAIMER =
  "本系统为律师及律师助理的内部辅助工作台，所有内容均为基于已上传材料的草稿与建议，" +
  "不构成法律意见或法律咨询，不得直接对外提交或交付客户。" +
  "全部事实、引用、金额须由承办律师逐项核实并确认后方可使用。";

export const DRAFT_BANNER =
  "草稿 · 未经律师审核 — 本文书由系统根据已上传材料自动生成，仅供内部审阅，不得直接对外提交。";

export const CALC_DISCLAIMER =
  "金额由确定性计算服务按公开公式计算，不由模型推测。计算依据与输入均已列明，结果仍需律师结合地区标准与案件事实复核。";

export const SOURCE_RULE =
  "无材料来源的事实不进入草稿；无法确定的字段显示为缺失占位，不做推测补全。";

export const PRIVACY_NOTE =
  "身份证号、联系方式等敏感个人信息已脱敏显示；对外导出前需再次确认脱敏（《个人信息保护法》要求）。";

export const LEGAL_SOURCE_CAVEAT =
  "法条与类案摘要为人工整理的演示样例，附生效日期与出处；正式引用前须以国家法律法规数据库等官方文本核对。";

export const REVIEW_GATE_NOTE =
  "导出前必须由承办律师完成复核确认。系统不提供“最终法律意见”，不评估胜诉概率。";

/** 复核确认清单（导出门槛） */
export const APPROVAL_CHECKLIST = [
  { key: "facts", label: "事实与时间线已逐项核对材料来源" },
  { key: "citations", label: "引用法条已对照官方文本核实（含生效日期）" },
  { key: "amounts", label: "请求金额与计算输入已复核" },
  { key: "privacy", label: "敏感个人信息已确认脱敏" },
] as const;
