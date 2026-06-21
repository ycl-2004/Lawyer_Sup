"""解析服务边界用例：空文件、乱码、不支持类型、图片、真实 PDF/docx、超长文档。"""
import pytest

from app.services.parse_service import parse_file


def test_empty_bytes_returns_clear_error():
    r = parse_file("anything.txt", b"")
    assert not r.ok
    assert r.error and "空" in r.error


def test_whitespace_only_text_flagged_failed():
    r = parse_file("blank.txt", "   \n\n  \t".encode("utf-8"))
    assert not r.ok
    assert r.error


def test_plain_txt_parses():
    r = parse_file("note.txt", "劳动合同：月工资9000元".encode("utf-8"))
    assert r.ok
    assert "月工资9000元" in r.text


def test_gb18030_encoding_falls_back():
    # GB18030 编码的中文，应被编码兜底正确解码
    raw = "解除劳动合同通知书".encode("gb18030")
    r = parse_file("legacy.txt", raw)
    assert r.ok
    assert "解除劳动合同" in r.text


def test_garbled_bytes_do_not_crash():
    # 随机二进制伪装成 txt：不应抛异常，最坏返回替换字符
    r = parse_file("weird.txt", bytes(range(256)))
    assert isinstance(r.text, str)  # 不崩溃即可


def test_unsupported_type_returns_guidance():
    r = parse_file("archive.zip", b"PK\x03\x04som'thing")
    assert not r.ok
    assert "粘贴文本" in (r.error or "")


def test_image_type_points_to_manual_paste():
    r = parse_file("scan.png", b"\x89PNG\r\n\x1a\n")
    assert not r.ok
    assert r.ocr_status == "pending"
    assert "粘贴文本" in (r.error or "")


def test_real_pdf_round_trips():
    fitz = pytest.importorskip("fitz")
    doc = fitz.open()
    page = doc.new_page()
    page.insert_textbox(fitz.Rect(40, 40, 540, 760), "甲方：测试公司\n乙方：测试劳动者",
                        fontname="china-s", fontsize=14)
    data = doc.tobytes()
    doc.close()
    r = parse_file("contract.pdf", data)
    assert r.ok
    assert "测试公司" in r.text


def test_real_docx_round_trips():
    docx = pytest.importorskip("docx")
    from io import BytesIO
    d = docx.Document()
    d.add_paragraph("解除劳动合同通知书")
    d.add_paragraph("乙方：测试劳动者")
    buf = BytesIO()
    d.save(buf)
    r = parse_file("notice.docx", buf.getvalue())
    assert r.ok
    assert "解除劳动合同通知书" in r.text


def test_very_long_document_parses():
    big = ("劳动合同条款第N条。\n" * 20000).encode("utf-8")  # ~> 数十万字符
    r = parse_file("long.txt", big)
    assert r.ok
    assert r.pages > 1
