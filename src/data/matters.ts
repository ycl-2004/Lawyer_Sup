import type { Matter } from "../lib/types";

/** 案件列表（演示数据，均为虚构匿名案件） */
export const MATTERS: Matter[] = [
  {
    id: "m_001",
    clientCode: "C-26021",
    title: "张某 与 上海星河科技有限公司 劳动争议（演示案件）",
    clientAlias: "张某（申请人）",
    opposingParty: "上海星河科技有限公司",
    caseType: "劳动争议",
    jurisdiction: "上海",
    leadLawyer: "李律师",
    status: "review",
    riskLevel: "medium",
    summary:
      "公司以组织架构调整为由解除劳动合同，欠付2026年2月部分工资。拟主张拖欠工资及违法解除赔偿金/经济补偿金（择一）。",
    createdAt: "2026-05-28",
    updatedAt: "2026-06-10",
  },
  {
    id: "m_002",
    clientCode: "C-26018",
    title: "刘某 与 某商贸公司 加班费争议（演示占位）",
    clientAlias: "刘某（申请人）",
    opposingParty: "某商贸有限公司",
    caseType: "劳动争议",
    jurisdiction: "北京",
    leadLawyer: "王律师",
    status: "intake",
    riskLevel: "low",
    summary: "材料收集中，尚未开始抽取。",
    createdAt: "2026-06-08",
    updatedAt: "2026-06-09",
  },
  {
    id: "m_003",
    clientCode: "C-26006",
    title: "陈某 与 某餐饮公司 离职证明纠纷（演示占位）",
    clientAlias: "陈某（申请人）",
    opposingParty: "某餐饮管理有限公司",
    caseType: "劳动争议",
    jurisdiction: "深圳",
    leadLawyer: "李律师",
    status: "done",
    riskLevel: "low",
    summary: "已结案归档（演示占位）。",
    createdAt: "2026-04-02",
    updatedAt: "2026-05-15",
  },
];

export function getMatter(id: string): Matter | undefined {
  return MATTERS.find((m) => m.id === id);
}
