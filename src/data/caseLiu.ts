import type { CaseDataset } from "../lib/types";

/**
 * 演示案件 m_002：刘某 与 某商贸公司 加班费争议（北京，全部虚构）。
 * 该数据集需点击「运行 Agent 工作流」后载入，用于演示工作流动效。
 * 设计要点：加班小时数初始为 null —— 计算服务会"拒绝计算"，
 * 演示"系统不从打卡记录推测加班时长"的红线。
 */
export const DATASET_M002: CaseDataset = {
  requiresRun: true,
  calcKinds: ["overtime", "economic", "limitation"],
  initialCalcParams: {
    monthlySalary: 9000,
    regionalAvgMonthlyWage: null,
    unpaidAmount: null,
    otHours150: null,
    otHours200: null,
    otHours300: null,
  },
  documents: [
    {
      id: "doc_101",
      matterId: "m_002",
      filename: "labor_contract_liu.pdf",
      fileType: "pdf",
      docType: "labor_contract",
      pages: 5,
      parseStatus: "parsed",
      ocrStatus: "not_needed",
      confidence: 0.95,
      classificationReason: "含合同期限、岗位、工资标准条款",
      keyExcerpt: "合同期限自2023年3月1日起；月工资人民币9,000元；标准工时制。",
    },
    {
      id: "doc_102",
      matterId: "m_002",
      filename: "attendance_2025q4_2026q1.txt",
      fileType: "txt",
      docType: "attendance",
      pages: 6,
      parseStatus: "parsed",
      ocrStatus: "not_needed",
      confidence: 0.82,
      classificationReason: "打卡时间表格，含工号与日期",
      keyExcerpt: "2025年10月至2026年3月期间多个工作日21:00后下班打卡，多个周六出勤记录。",
    },
    {
      id: "doc_103",
      matterId: "m_002",
      filename: "payslips_2026.pdf",
      fileType: "pdf",
      docType: "payslip",
      pages: 3,
      parseStatus: "parsed",
      ocrStatus: "not_needed",
      confidence: 0.9,
      classificationReason: "工资条结构，含应发/实发明细",
      keyExcerpt: "工资条中无“加班费”项目。",
      sensitive: true,
    },
    {
      id: "doc_104",
      matterId: "m_002",
      filename: "chat_dingtalk.txt",
      fileType: "txt",
      docType: "chat_record",
      pages: 2,
      parseStatus: "parsed",
      ocrStatus: "not_needed",
      confidence: 0.86,
      classificationReason: "钉钉对话记录，含加班安排沟通",
      keyExcerpt: "主管：本周六全员到岗赶项目。刘某：收到。",
      sensitive: true,
    },
    {
      id: "doc_105",
      matterId: "m_002",
      filename: "resignation_notice.pdf",
      fileType: "pdf",
      docType: "termination_notice",
      pages: 1,
      parseStatus: "parsed",
      ocrStatus: "not_needed",
      confidence: 0.88,
      classificationReason: "劳动者单方解除通知，载明解除理由",
      keyExcerpt: "因公司长期安排加班且未足额支付加班工资，本人依据劳动合同法第三十八条解除劳动合同（2026年4月30日）。",
    },
  ],
  parties: [
    {
      id: "p_101",
      role: "申请人（劳动者）",
      name: "刘某",
      idNumberRedacted: "110***********5678（敏感信息已脱敏）",
      sourceDocumentId: "doc_101",
    },
    {
      id: "p_102",
      role: "被申请人（用人单位）",
      name: "某商贸有限公司",
      idNumberRedacted: "统一社会信用代码【待核实：需工商信息材料】",
    },
  ],
  facts: [
    {
      id: "f_101",
      fieldKey: "employee_name",
      label: "劳动者姓名",
      value: "刘某",
      confidence: 0.96,
      source: { documentId: "doc_101", page: 1, quote: "乙方：刘某" },
      needsReview: false,
    },
    {
      id: "f_102",
      fieldKey: "employer_name",
      label: "用人单位名称",
      value: "某商贸有限公司",
      confidence: 0.94,
      source: { documentId: "doc_101", page: 1 },
      needsReview: false,
    },
    {
      id: "f_103",
      fieldKey: "start_date",
      label: "入职日期",
      value: "2023-03-01",
      confidence: 0.95,
      source: { documentId: "doc_101", page: 1, quote: "合同期限自2023年3月1日起" },
      needsReview: false,
    },
    {
      id: "f_104",
      fieldKey: "monthly_salary",
      label: "月工资",
      value: "9,000元",
      confidence: 0.92,
      source: { documentId: "doc_101", page: 2, quote: "月工资人民币9,000元" },
      needsReview: true,
      missingNote: "与工资条实发金额的差异口径需核实",
    },
    {
      id: "f_105",
      fieldKey: "termination_date",
      label: "解除日期（劳动者依38条解除）",
      value: "2026-04-30",
      confidence: 0.9,
      source: { documentId: "doc_105", page: 1 },
      needsReview: true,
      missingNote: "38条解除的事实基础（未足额支付报酬）能否成立需律师评估",
    },
    {
      id: "f_106",
      fieldKey: "overtime_hours",
      label: "经核定的加班小时数",
      value: null,
      confidence: null,
      source: { documentId: "doc_102", page: 1 },
      needsReview: true,
      missingNote:
        "考勤显示晚下班与周六出勤，但缺少加班审批记录，小时数未核定——系统不从打卡记录推测，需律师与客户逐月核对后人工输入",
    },
    {
      id: "f_107",
      fieldKey: "overtime_payment",
      label: "加班费支付情况",
      value: "工资条中无加班费项目",
      confidence: 0.85,
      source: { documentId: "doc_103", page: 1 },
      needsReview: false,
    },
  ],
  timeline: [
    {
      id: "t_101",
      date: "2023-03-01",
      eventType: "入职",
      title: "刘某入职某商贸有限公司",
      description: "约定月工资9,000元，标准工时制。",
      sources: [{ documentId: "doc_101", page: 1 }],
      confidence: 0.95,
      disputed: false,
      needsReview: false,
    },
    {
      id: "t_102",
      date: "2025-10-01",
      eventType: "其他",
      title: "高频加班期开始（待核定）",
      description: "考勤显示自2025年10月起多个工作日晚下班、周六出勤；是否构成加班待审批记录核定。",
      sources: [{ documentId: "doc_102", page: 1 }],
      confidence: 0.7,
      disputed: false,
      needsReview: true,
    },
    {
      id: "t_103",
      date: "2026-03-14",
      eventType: "争议沟通",
      title: "主管在钉钉群安排周末到岗",
      description: "可作为用人单位安排加班的佐证之一。",
      sources: [{ documentId: "doc_104", page: 1 }],
      confidence: 0.86,
      disputed: false,
      needsReview: false,
    },
    {
      id: "t_104",
      date: "2026-04-30",
      eventType: "离职",
      title: "刘某依《劳动合同法》第三十八条解除劳动合同",
      description: "解除理由：未足额支付加班工资。该解除依据能否成立为本案核心争点。",
      sources: [{ documentId: "doc_105", page: 1 }],
      confidence: 0.9,
      disputed: true,
      needsReview: true,
    },
  ],
  claims: [
    {
      id: "c_101",
      claimType: "overtime_pay",
      title: "支付加班费",
      status: "suggested",
      basisFacts: ["考勤显示工作日延时与周六出勤", "钉钉记录显示公司安排加班", "工资条无加班费项目"],
      legalBasis: ["《劳动法》第四十四条", "《劳动合同法》第三十一条"],
      requiredEvidence: ["考勤记录", "加班审批/安排记录", "工资条"],
      missingEvidence: ["加班审批记录", "逐月核定的加班小时数清单"],
      riskLevel: "medium",
      note: "加班小时数未核定前金额无法计算；劳动者对加班事实负初步举证责任。",
    },
    {
      id: "c_102",
      claimType: "economic_compensation",
      title: "支付经济补偿金（38条解除）",
      status: "suggested",
      basisFacts: ["刘某以未足额支付劳动报酬为由解除合同（第三十八条）"],
      legalBasis: ["《劳动合同法》第三十八条", "第四十六条", "第四十七条"],
      requiredEvidence: ["解除通知", "加班费欠付的证明（依赖请求1）"],
      missingEvidence: ["加班费欠付金额的固定证据"],
      riskLevel: "high",
      note: "经济补偿成立与否取决于“未足额支付报酬”能否认定，与加班费请求强关联，策略需律师统筹。",
    },
  ],
  evidenceMatrix: [
    {
      id: "e_101",
      issue: "是否存在应支付而未支付的加班费",
      claimantPosition: "公司安排加班但从未支付加班费",
      factsToProve: ["加班事实与时长", "公司安排或知悉加班", "未支付加班费"],
      existingEvidence: ["考勤记录（doc_102）", "钉钉记录（doc_104）", "工资条（doc_103）"],
      missingEvidence: ["加班审批记录", "逐月加班小时核定表"],
      riskLevel: "medium",
      lawyerNote: "对方可能抗辩打卡≠加班、实行弹性工时；需核实公司工时制度审批情况。",
    },
    {
      id: "e_102",
      issue: "劳动者依38条解除能否获得经济补偿",
      claimantPosition: "公司未足额支付劳动报酬，解除有据，应付经济补偿",
      factsToProve: ["欠付加班费事实成立", "解除程序与理由载明"],
      existingEvidence: ["解除通知（doc_105）"],
      missingEvidence: ["加班费欠付金额固定", "送达证据"],
      riskLevel: "high",
      lawyerNote: "若加班费请求不成立，38条解除的经济补偿大概率不被支持，需评估主张顺序。",
    },
  ],
  missingMaterials: [
    "加班审批/安排记录（OA、邮件、群通知导出）",
    "逐月核定的加班小时数清单（律师与客户共同核对）",
    "公司工时制度及审批文件（是否综合工时制）",
    "解除通知的送达证据（快递单/签收记录）",
    "2023年以来完整工资条或银行流水（核定补偿基数）",
  ],
  drafts: [
    {
      id: "d_101",
      draftType: "arbitration_application",
      title: "劳动仲裁申请书（加班费，草稿 v1）",
      contentMarkdown: `> ⚠️ 草稿 · 未经律师审核 · 不得直接对外提交
> 本文书由系统根据已上传材料自动生成，结构参照劳动仲裁申请书通用格式整理；
> 提交前由承办律师按管辖仲裁委要求核对调整。全部事实、金额、引用须逐项核实。

# 劳动仲裁申请书（草稿）

**申请人**：刘某，【待律师确认：性别】，【待律师确认：出生日期】出生，【待律师确认：民族】，住【待律师确认：住址】，公民身份号码 110***********5678（已脱敏），联系电话【待律师确认】。

**被申请人**：某商贸有限公司，住所地【待核实：注册地址——需补充工商信息材料】，统一社会信用代码【待核实】。
法定代表人：【待核实：姓名】，职务：【待核实】。

## 仲裁请求

一、裁决被申请人支付申请人加班费人民币【待计算：加班小时数经考勤与审批记录核定并人工输入后，由计算服务按〈劳动法〉第四十四条标准生成，系统不推测时长】；

二、裁决被申请人支付解除劳动合同经济补偿金人民币【待计算：依赖请求一欠付事实的认定，金额由计算服务按第四十七条生成】。

## 事实与理由

申请人于2023年3月1日入职被申请人处，约定月工资9,000元，实行标准工时制 [来源: doc_101 劳动合同]。

2025年10月起，考勤记录显示申请人存在多个工作日延时下班及周六出勤情形 [来源: doc_102 考勤记录]；部门主管曾在钉钉群安排周末到岗 [来源: doc_104 聊天记录]。申请人工资条中无加班费发放项目 [来源: doc_103 工资条]。加班小时数尚未经审批记录核定【待核实：逐月加班小时清单】。

2026年4月30日，申请人以被申请人未足额支付劳动报酬为由，依据《劳动合同法》第三十八条解除劳动合同 [来源: doc_105 解除通知]。依照《劳动合同法》第四十六条、第四十七条之规定，被申请人应当支付经济补偿。特依据《劳动争议调解仲裁法》第二条、第五条之规定，向贵委申请仲裁，请求依法裁决。

## 证据和证据来源

1. 劳动合同（doc_101）——证明劳动关系、工资标准与工时制度；
2. 考勤记录（doc_102）——证明延时下班与周六出勤情形；
3. 工资条（doc_103）——证明未发放加班费；
4. 钉钉聊天记录（doc_104）——证明用人单位安排加班；
5. 解除通知（doc_105）——证明解除事实与依据。
（证据原件待律师当面核对）

## 此致

【待律师确认：有管辖权的劳动人事争议仲裁委员会名称】

附：一、本申请书副本【待确认份数】；
　　二、证据清单及证据材料一式【待确认】份；
　　三、申请人身份证明复印件一份。

申请人（签名）：刘某

【待律师确认：提交日期】年　月　日
`,
      version: 1,
      generatedAt: "2026-06-11（演示生成）",
      basedOn: ["事实抽取结果", "时间线", "请求项识别", "确定性金额计算（待输入）"],
    },
  ],
  findings: [
    {
      id: "r_101",
      severity: "high",
      findingType: "missing_evidence",
      message: "两项仲裁请求金额均依赖加班小时数核定，目前为空。草稿中金额为占位符，不可在核定前填入估算值。",
      location: "仲裁申请书草稿 · 仲裁请求",
      suggestion: "与客户逐月核对考勤并整理加班小时清单后，在“请求项与计算”页人工输入小时数。",
      resolved: false,
    },
    {
      id: "r_102",
      severity: "medium",
      findingType: "citation_check",
      message: "草稿引用第三十八条解除，但“未足额支付劳动报酬”的认定依赖加班费请求成立，论证链条需律师确认。",
      location: "仲裁申请书草稿 · 事实与理由",
      suggestion: "评估若加班费部分败诉对经济补偿请求的影响，必要时调整请求结构。",
      resolved: false,
    },
    {
      id: "r_103",
      severity: "medium",
      findingType: "privacy",
      message: "工资条与钉钉记录含个人信息与同事姓名，导出前需脱敏处理。",
      location: "证据材料 doc_103 / doc_104",
      suggestion: "对外提交版本遮蔽无关第三人信息。",
      resolved: false,
    },
  ],
};
