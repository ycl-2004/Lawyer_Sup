"""金额计算服务 golden cases（与前端 compensation.test.ts 同一套用例）。"""
from app.services.compensation_service import (
    calc_economic_compensation,
    calc_overtime_pay,
    calc_unlawful_termination_damages,
    calc_unpaid_wages,
    check_limitation_period,
    derive_tenure,
    full_months_between,
)


def test_full_months_between():
    assert full_months_between("2024-07-01", "2026-03-15") == (20, True)
    assert full_months_between("2024-07-01", "2025-07-01") == (12, False)
    assert full_months_between("2024-07-15", "2024-08-01") == (0, True)


def test_derive_tenure_article_47():
    t = derive_tenure("2024-07-01", "2026-03-15")
    assert (t.full_years, t.remainder_months, t.compensated_months) == (1, 8, 2)
    assert derive_tenure("2024-01-01", "2024-06-01").compensated_months == 0.5
    assert derive_tenure("2024-01-01", "2024-07-01").compensated_months == 1
    assert derive_tenure("2022-03-01", "2025-03-01").compensated_months == 3


def test_economic_compensation_demo_case():
    r = calc_economic_compensation(12000, "2024-07-01", "2026-03-15")
    assert r.result == 24000
    assert not r.missing_inputs


def test_economic_compensation_refuses_on_missing_input():
    r = calc_economic_compensation(None, "2024-07-01", "2026-03-15")
    assert r.result is None
    assert "月工资" in r.missing_inputs


def test_economic_compensation_triple_cap():
    r = calc_economic_compensation(60000, "2010-01-01", "2025-01-01", regional_avg_monthly_wage=12000)
    assert r.result == 36000 * 12


def test_unlawful_termination_is_double():
    r = calc_unlawful_termination_damages(12000, "2024-07-01", "2026-03-15")
    assert r.result == 48000
    assert any("二者择一" in w for w in r.warnings)


def test_unpaid_wages():
    assert calc_unpaid_wages([{"period": "2026年2月", "amount_owed": 6000}]).result == 6000
    assert calc_unpaid_wages([{"period": "2026年2月", "amount_owed": None}]).result is None


def test_overtime_pay():
    r = calc_overtime_pay(8700, 10, 8, 0)  # 8700/21.75/8 = 50 元/小时
    assert r.result == 50 * (1.5 * 10 + 2 * 8)
    refused = calc_overtime_pay(9000, None, None, None)
    assert refused.result is None
    assert "经核定的加班小时数" in refused.missing_inputs


def test_limitation_period():
    assert check_limitation_period("2026-03-15", "2026-06-11")["status"] == "ok"
    assert check_limitation_period("2026-03-15", "2027-02-20")["status"] == "approaching"
    assert check_limitation_period("2024-01-01", "2026-06-11")["status"] == "expired"
    assert check_limitation_period(None, "2026-06-11")["status"] == "unknown"
