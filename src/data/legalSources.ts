import type { LegalSourceCard } from "../lib/types";

/**
 * 法条/类案卡片（人工整理的演示样例知识库）。
 * 摘要为简化转述，正式引用前必须以国家法律法规数据库等官方文本核对。
 * 每条均带 effective_date 与出处，体现"法律会更新"的设计（见计划 §18.4）。
 */
export const LEGAL_SOURCES: LegalSourceCard[] = [
  {
    id: "ls_47",
    sourceType: "law",
    title: "《中华人民共和国劳动合同法》",
    article: "第四十七条",
    summary:
      "经济补偿按劳动者在本单位工作的年限，每满一年支付一个月工资；六个月以上不满一年的按一年计算；不满六个月的支付半个月工资。月工资高于当地社平工资三倍的，按三倍封顶且年限最高不超过十二年。",
    relevance: "经济补偿金计算依据",
    effectiveDate: "2013-07-01（2012修正）",
    citation: "国家法律法规数据库 flk.npc.gov.cn",
    needsVerification: true,
  },
  {
    id: "ls_87",
    sourceType: "law",
    title: "《中华人民共和国劳动合同法》",
    article: "第八十七条",
    summary:
      "用人单位违反本法规定解除或终止劳动合同的，应当依照第四十七条规定的经济补偿标准的二倍向劳动者支付赔偿金。",
    relevance: "违法解除赔偿金计算依据（与经济补偿二者择一）",
    effectiveDate: "2013-07-01（2012修正）",
    citation: "国家法律法规数据库 flk.npc.gov.cn",
    needsVerification: true,
  },
  {
    id: "ls_82",
    sourceType: "law",
    title: "《中华人民共和国劳动合同法》",
    article: "第八十二条",
    summary:
      "用人单位自用工之日起超过一个月不满一年未与劳动者订立书面劳动合同的，应当向劳动者每月支付二倍的工资。",
    relevance: "本案已签订书面合同，初步判断不适用（需律师确认）",
    effectiveDate: "2013-07-01（2012修正）",
    citation: "国家法律法规数据库 flk.npc.gov.cn",
    needsVerification: true,
  },
  {
    id: "ls_zcjcf27",
    sourceType: "law",
    title: "《中华人民共和国劳动争议调解仲裁法》",
    article: "第二十七条",
    summary:
      "劳动争议申请仲裁的时效期间为一年，从当事人知道或者应当知道其权利被侵害之日起计算（劳动关系存续期间拖欠劳动报酬争议有特别规则）。",
    relevance: "仲裁时效检查依据",
    effectiveDate: "2008-05-01",
    citation: "国家法律法规数据库 flk.npc.gov.cn",
    needsVerification: true,
  },
  {
    id: "ls_jieshi2",
    sourceType: "judicial_interpretation",
    title: "最高人民法院关于审理劳动争议案件适用法律问题的解释（二）",
    article: "法释〔2025〕12号（节选）",
    summary:
      "用人单位与劳动者约定或承诺不缴纳社会保险费的约定无效；劳动者以用人单位未依法缴纳社保为由解除劳动合同并主张经济补偿的，人民法院依法予以支持。",
    relevance: "本案社保缴纳情况尚未查明——若存在未依法缴纳社保情形，可能影响请求项设计（需补充社保记录后由律师评估）",
    effectiveDate: "2025-09-01 施行",
    citation: "最高人民法院公报 / court.gov.cn",
    needsVerification: true,
  },
  {
    id: "ls_case_demo",
    sourceType: "case",
    title: "类案参考：某科技公司以“组织架构调整”解除劳动合同被认定违法（摘要）",
    summary:
      "裁判要旨（人工整理样例）：用人单位以客观情况发生重大变化为由解除合同的，应举证证明变化的客观性，并履行协商变更程序；仅以内部架构调整为由、未经协商径行解除的，构成违法解除。",
    relevance: "支持违法解除主张的论证思路参考。类案仅供参考，不构成必然裁判结果",
    effectiveDate: "入库日期 2026-06-01",
    citation: "人民法院案例库 rmfyalk.court.gov.cn（演示样例，需核实）",
    needsVerification: true,
  },
];
