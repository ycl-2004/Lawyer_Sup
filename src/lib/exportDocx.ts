import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(text: string, filename: string) {
  downloadBlob(new Blob([text], { type: "text/markdown;charset=utf-8" }), filename);
}

/** 去掉行内 markdown 标记（** 加粗等），导出为纯文本 run */
function stripInline(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}

/**
 * 简化版 Markdown → docx 转换（标题/引用/列表/表格行/正文）。
 * 文档首部强制加入草稿水印段落 —— 导出件不得伪装为定稿。
 */
export async function exportMarkdownAsDocx(markdown: string, filename: string) {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "草稿 · 未经律师审核 · 不得直接对外提交",
          bold: true,
          color: "B91C1C",
          size: 24,
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `由 LawDesk Junior 自动生成（${new Date().toLocaleString("zh-CN")}），全部内容需承办律师逐项核实。`,
          color: "888888",
          size: 18,
        }),
      ],
      spacing: { after: 300 },
    }),
  ];

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      children.push(new Paragraph({ spacing: { after: 80 } }));
    } else if (line.startsWith("# ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: stripInline(line.slice(2)) })],
          spacing: { before: 200, after: 150 },
        }),
      );
    } else if (line.startsWith("## ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: stripInline(line.slice(3)) })],
          spacing: { before: 150, after: 100 },
        }),
      );
    } else if (line.startsWith("> ")) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: stripInline(line.slice(2)), italics: true, color: "92400E" }),
          ],
          spacing: { after: 80 },
        }),
      );
    } else if (/^(-|\d+\.)\s/.test(line)) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: stripInline(line.replace(/^(-|\d+\.)\s/, "")) })],
        }),
      );
    } else if (line.startsWith("|")) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: stripInline(line), font: "Courier New", size: 18 }),
          ],
        }),
      );
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: stripInline(line) })],
          spacing: { after: 80 },
        }),
      );
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, filename);
}
