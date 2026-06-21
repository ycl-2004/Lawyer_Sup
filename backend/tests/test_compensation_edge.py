"""金额计算边界用例：日期冲突、零/负金额、负小时数——一律拒绝计算，不编数字。"""
from app.services.compensation_service import (
    calc_economic_compensation,
    calc_overtime_pay,
    calc_unlawful_termination_damages,
    calc_unpaid_wages,
    check_limitation_period,
)


def test_economic_compensation_refuses_on_date_conflict():
    # 解除日期早于入职日期 → 日期冲突，拒绝计算
    r = calc_economic_compensation(12000, "2026-03-15", "2024-07-01")
    assert r.result is None
    assert any("日期冲突" in w for w in r.warnings)


def test_unlawful_termination_propagates_date_conflict():
    r = calc_unlawful_termination_damages(12000, "2026-03-15", "2024-07-01")
    assert r.result is None


def test_economic_compensation_refuses_zero_salary():
    r = calc_economic_compensation(0, "2024-07-01", "2026-03-15")
    assert r.result is None
    assert "月工资" in r.missing_inputs


def test_economic_compensation_refuses_negative_salary():
    r = calc_economic_compensation(-5000, "2024-07-01", "2026-03-15")
    assert r.result is None
    assert "月工资" in r.missing_inputs


def test_same_day_start_end_is_zero_not_crash():
    # 入职与解除同日：合法但补偿月数为 0（不应崩溃，也不应拒绝）
    r = calc_economic_compensation(12000, "2026-03-15", "2026-03-15")
    assert r.result == 0


def test_unpaid_wages_refuses_negative_amount():
    r = calc_unpaid_wages([{"period": "2026年2月", "amount_owed": -6000}])
    assert r.result is None
    assert any("为负" in w for w in r.warnings)


def test_unpaid_wages_mixed_negative_refused():
    r = calc_unpaid_wages([
        {"period": "2026年1月", "amount_owed": 6000},
        {"period": "2026年2月", "amount_owed": -100},
    ])
    assert r.result is None


def test_overtime_refuses_negative_hours():
    r = calc_overtime_pay(8700, -10, None, None)
    assert r.result is None
    assert any("不能为负" in w for w in r.warnings)


def test_overtime_zero_hours_allowed_returns_zero():
    # 明确填 0 小时（非缺失）→ 合法，结果为 0
    r = calc_overtime_pay(8700, 0, 0, 0)
    assert r.result == 0


def test_limitation_invalid_date_is_unknown():
    assert check_limitation_period("not-a-date", "2026-06-11")["status"] == "unknown"
