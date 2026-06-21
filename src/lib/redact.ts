/**
 * 数据层脱敏（defense in depth）：
 * 展示层与导出层统一调用，避免敏感个人信息（PIPL）以明文出现在预览或导出件中。
 * 已脱敏文本（含 * 号）不受影响。
 */

/** 18位身份证号（含尾位X） */
const ID_RE = /\b\d{17}[\dXx]\b/g;
/** 中国大陆手机号 */
const PHONE_RE = /\b1[3-9]\d{9}\b/g;
/** 银行卡/长账号（12-19位连续数字） */
const ACCOUNT_RE = /\b\d{12,19}\b/g;

export function maskSensitive(text: string): string {
  return text
    .replace(ID_RE, (m) => `${m.slice(0, 3)}***********${m.slice(-4)}`)
    .replace(PHONE_RE, (m) => `${m.slice(0, 3)}****${m.slice(-4)}`)
    .replace(ACCOUNT_RE, (m) => `${m.slice(0, 4)}****${m.slice(-4)}`);
}
