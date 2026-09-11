import pytest
from freezegun import freeze_time
from app import models


# ============================================================================
# TEST 1: Correct start_date/end_date calculation for different days of month
# ============================================================================
@pytest.mark.parametrize(
    "frozen_date, expected_start, expected_end",
    [
        ("2026-09-01", "2026-09-01", "2026-09-15"),  # 1st of month (1st half)
        ("2026-09-15", "2026-09-01", "2026-09-15"),  # 15th of month (end of 1st half)
        ("2026-09-16", "2026-09-16", "2026-09-30"),  # 16th of month (start of 2nd half)
        ("2026-09-30", "2026-09-16", "2026-09-30"),  # Last day of month (end of 2nd half)
    ],
)
def test_ensure_current_period_date_bounds(
    client, test_user, frozen_date, expected_start, expected_end
):
    with freeze_time(frozen_date):
        response = client.post(
            f"/periods/ensure-current?group_name={test_user.group_name}&created_by={test_user.id}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["start_date"] == expected_start
        assert data["end_date"] == expected_end
        assert data["group_name"] == test_user.group_name


# ============================================================================
# TEST 2: Handling different month lengths (30-day, 31-day, Feb leap/non-leap)
# ============================================================================
@pytest.mark.parametrize(
    "frozen_date, expected_start, expected_end",
    [
        ("2026-07-20", "2026-07-16", "2026-07-31"),  # 31-day month (July 2026)
        ("2026-04-20", "2026-04-16", "2026-04-30"),  # 30-day month (April 2026)
        ("2026-02-20", "2026-02-16", "2026-02-28"),  # Feb non-leap year (2026 -> 28 days)
        ("2028-02-20", "2028-02-16", "2028-02-29"),  # Feb leap year (2028 -> 29 days)
    ],
)
def test_ensure_current_period_month_lengths(
    client, test_user, frozen_date, expected_start, expected_end
):
    with freeze_time(frozen_date):
        response = client.post(
            f"/periods/ensure-current?group_name={test_user.group_name}&created_by={test_user.id}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["start_date"] == expected_start
        assert data["end_date"] == expected_end


# ============================================================================
# TEST 3: Idempotency (calling twice on same date does NOT create duplicate)
# ============================================================================
def test_ensure_current_period_no_duplicates(client, test_user, db_session):
    with freeze_time("2026-09-10"):
        # First call
        res1 = client.post(
            f"/periods/ensure-current?group_name={test_user.group_name}&created_by={test_user.id}"
        )
        assert res1.status_code == 200
        period1 = res1.json()

        # Second call on exact same fake date
        res2 = client.post(
            f"/periods/ensure-current?group_name={test_user.group_name}&created_by={test_user.id}"
        )
        assert res2.status_code == 200
        period2 = res2.json()

        # Must return the exact same period ID
        assert period1["id"] == period2["id"]

        # Database must contain exactly 1 period row for this group
        count = (
            db_session.query(models.NewsletterPeriod)
            .filter(models.NewsletterPeriod.group_name == test_user.group_name)
            .count()
        )
        assert count == 1


# ============================================================================
# TEST 4: Safety guard check (verifying safety guard validation)
# ============================================================================
def test_ensure_current_period_current_year_safety_guard(client, test_user):
    with freeze_time("2026-09-10"):
        response = client.post(
            f"/periods/ensure-current?group_name={test_user.group_name}&created_by={test_user.id}"
        )
        assert response.status_code == 200
        data = response.json()
        # Verify created period year matches current year 2026
        assert data["start_date"].startswith("2026")
        assert data["end_date"].startswith("2026")


# ============================================================================
# TEST 5: Center Combined DOCX Generation
# ============================================================================
def test_center_combined_docx_generation(client, test_user, db_session):
    test_user.center = "SMPM"
    db_session.commit()

    with freeze_time("2026-09-10"):
        res = client.post(
            f"/periods/ensure-current?group_name={test_user.group_name}&created_by={test_user.id}"
        )
        assert res.status_code == 200

        # Request combined docx for center SMPM
        docx_res = client.get("/periods/center/generate-combined-docx?center=SMPM")
        assert docx_res.status_code == 200
        assert docx_res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

