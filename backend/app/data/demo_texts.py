"""演示案件材料文本（张某案，全部虚构）。MVP-1 接入文件上传与解析前的替身。"""

DEMO_MATERIALS: dict[str, dict[str, str]] = {
    "doc_001": {
        "filename": "labor_contract.pdf",
        "text": (
            "劳动合同\n甲方：上海星河科技有限公司\n乙方：张某\n"
            "合同期限自2024年7月1日起至2027年6月30日止。\n"
            "乙方从事运营专员岗位工作。\n月工资人民币12,000元。"
        ),
    },
    "doc_002": {
        "filename": "termination_notice.pdf",
        "text": (
            "解除劳动合同通知书\n张某：\n"
            "因组织架构调整，公司决定于2026年3月15日与您解除劳动合同。\n"
            "上海星河科技有限公司（盖章）\n2026年3月15日"
        ),
    },
    "doc_004": {
        "filename": "chat_record_wechat.txt",
        "text": (
            "2026-03-08 张某：2月工资怎么只发了一半？\n"
            "2026-03-08 HR-王经理：公司现金流紧张，剩下的之后补。"
        ),
    },
    "doc_006": {
        "filename": "client_statement.md",
        "text": (
            "客户口述：公司3月15日口头加书面通知解除，没有提前30天，"
            "也没给我看任何裁员依据。2月工资只发了6000。"
        ),
    },
}

DEMO_MATTERS = [
    {
        "id": "m_001",
        "client_code": "C-26021",
        "title": "张某 与 上海星河科技有限公司 劳动争议（演示案件）",
        "jurisdiction": "上海",
        "status": "review",
        "case_type": "劳动争议",
    },
    {
        "id": "m_002",
        "client_code": "C-26018",
        "title": "刘某 与 某商贸公司 加班费争议（演示占位）",
        "jurisdiction": "北京",
        "status": "intake",
        "case_type": "劳动争议",
    },
]
