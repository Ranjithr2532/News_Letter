from urllib.parse import quote
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
# TEST 4b: Brand New Department Login in 2nd Half Auto-Creates 1st Half
# ============================================================================
def test_new_department_login_in_second_half_creates_first_half(client, test_user, db_session):
    # Brand new department never seen before in database
    new_dept_name = "Artificial_Intelligence"
    
    # User logs in on Sept 22nd (2nd Half)
    with freeze_time("2026-09-22"):
        res = client.post(
            f"/periods/ensure-current?group_name={new_dept_name}&created_by={test_user.id}"
        )
        assert res.status_code == 200
        current_period = res.json()
        
        # Current active period is 2nd half
        assert current_period["start_date"] == "2026-09-16"
        assert current_period["end_date"] == "2026-09-30"

        # Check all periods created for this brand new department in Sept 2026
        periods = (
            db_session.query(models.NewsletterPeriod)
            .filter(models.NewsletterPeriod.group_name == new_dept_name)
            .order_by(models.NewsletterPeriod.start_date.asc())
            .all()
        )
        ranges = [(str(p.start_date), str(p.end_date)) for p in periods]

        # Verify BOTH 1st Half (Sept 1-15) and 2nd Half (Sept 16-30) were created!
        assert ("2026-09-01", "2026-09-15") in ranges
        assert ("2026-09-16", "2026-09-30") in ranges
        assert len(ranges) == 2


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
        period_id = res.json()["id"]

        # Create category and entry
        cat = models.CategoryStage(name="Research & Development", stage_number=1, is_active=True)
        db_session.add(cat)
        db_session.commit()

        entry = models.NewsletterEntry(
            period_id=period_id,
            group_name=test_user.group_name,
            category_id=cat.id,
            title="Sample Project Achievement",
            description="Testing automated docx generation",
            created_by=test_user.id,
            updated_by=test_user.id,
        )
        db_session.add(entry)
        db_session.commit()

        # Request combined docx for center SMPM
        docx_res = client.get("/periods/center/generate-combined-docx?center=SMPM")
        assert docx_res.status_code == 200
        assert docx_res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        # Request docx for specific department under SMPM
        dept_docx_res = client.get(f"/periods/center/generate-combined-docx?center=SMPM&group_name={quote(test_user.group_name or '')}")
        assert dept_docx_res.status_code == 200
        assert dept_docx_res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        # Request docx with exact half start_date & end_date
        date_docx_res = client.get("/periods/center/generate-combined-docx?center=SMPM&start_date=2026-09-01&end_date=2026-09-15")
        assert date_docx_res.status_code == 200
        assert date_docx_res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        # Request docx with year & month
        ym_docx_res = client.get("/periods/center/generate-combined-docx?center=SMPM&year=2026&month=9")
        assert ym_docx_res.status_code == 200
        assert ym_docx_res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


# ============================================================================
# TEST 5b: Empty Department and Partial Department Download Behavior
# ============================================================================
def test_empty_department_and_partial_downloads(client, test_user, db_session):
    test_user.center = "SMPM"
    test_user.group = "Civil"

    # Create a second user in another department
    user2 = models.User(
        name="Mechanical Head",
        email="mech_head@test.com",
        password="hashedpassword",
        center="SMPM",
        group="Mechanical",
        role="gh",
    )
    db_session.add(user2)
    db_session.commit()

    with freeze_time("2026-09-10"):
        # Auto-create periods for both departments in SMPM
        client.post(f"/periods/ensure-current-center?center=SMPM&created_by={test_user.id}")

        # 1. When NO entries exist for any dept -> downloading Civil returns 404
        empty_dept_res = client.get("/periods/center/generate-combined-docx?center=SMPM&group_name=Civil&start_date=2026-09-01&end_date=2026-09-15")
        assert empty_dept_res.status_code == 404
        assert "No entries found for Civil in this period." in empty_dept_res.json()["detail"]

        # When NO entries exist in entire center -> downloading center returns 404
        empty_center_res = client.get("/periods/center/generate-combined-docx?center=SMPM&start_date=2026-09-01&end_date=2026-09-15")
        assert empty_center_res.status_code == 404
        assert "No entries found for SMPM in this period." in empty_center_res.json()["detail"]

        # 2. Add entry ONLY for Mechanical (Civil has 0 entries)
        mech_period = (
            db_session.query(models.NewsletterPeriod)
            .filter(models.NewsletterPeriod.group_name == "Mechanical")
            .first()
        )
        cat = models.CategoryStage(name="Mechanical Works", stage_number=1, is_active=True)
        db_session.add(cat)
        db_session.commit()

        entry = models.NewsletterEntry(
            period_id=mech_period.id,
            group_name="Mechanical",
            category_id=cat.id,
            title="Turbine Overhaul",
            description="Completed maintenance",
            created_by=user2.id,
            updated_by=user2.id,
        )
        db_session.add(entry)
        db_session.commit()

        # 3. CH downloads All Departments for SMPM -> Succeeds (200), skipping empty Civil
        combined_res = client.get("/periods/center/generate-combined-docx?center=SMPM&start_date=2026-09-01&end_date=2026-09-15")
        assert combined_res.status_code == 200
        assert combined_res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        # 4. CH downloads specific empty department (Civil) -> 404 with indication
        civil_res = client.get("/periods/center/generate-combined-docx?center=SMPM&group_name=Civil&start_date=2026-09-01&end_date=2026-09-15")
        assert civil_res.status_code == 404
        assert "No entries found for Civil in this period." in civil_res.json()["detail"]

        # 5. CH downloads specific filled department (Mechanical) -> 200
        mech_res = client.get("/periods/center/generate-combined-docx?center=SMPM&group_name=Mechanical&start_date=2026-09-01&end_date=2026-09-15")
        assert mech_res.status_code == 200


# ============================================================================
# TEST 5c: Admin All Centers & Multi-Center Download Behavior
# ============================================================================
def test_admin_all_centers_downloads(client, test_user, db_session):
    test_user.center = "SMPM"
    test_user.group = "Robotics"

    # User in another center
    cair_user = models.User(
        name="CAIR Head",
        email="cair_head@test.com",
        password="hashedpassword",
        center="CAIR",
        group="Sensors",
        role="gh",
    )
    db_session.add(cair_user)
    db_session.commit()

    with freeze_time("2026-09-10"):
        # Auto-create periods for SMPM and CAIR
        client.post(f"/periods/ensure-current-center?center=SMPM&created_by={test_user.id}")
        client.post(f"/periods/ensure-current-center?center=CAIR&created_by={cair_user.id}")

        # 1. When NO entries exist anywhere -> Admin All Centers download returns 404
        all_empty_res = client.get("/periods/center/generate-combined-docx?center=all&start_date=2026-09-01&end_date=2026-09-15")
        assert all_empty_res.status_code == 404
        assert "No entries found for this selection in the specified period." in all_empty_res.json()["detail"]

        # 2. Add entry only in SMPM Robotics
        smpm_period = (
            db_session.query(models.NewsletterPeriod)
            .filter(models.NewsletterPeriod.group_name == "Robotics")
            .first()
        )
        cat = models.CategoryStage(name="Robotics Lab", stage_number=1, is_active=True)
        db_session.add(cat)
        db_session.commit()

        entry = models.NewsletterEntry(
            period_id=smpm_period.id,
            group_name="Robotics",
            category_id=cat.id,
            title="Autonomous Rover Test",
            description="Testing autonomous vehicle rover",
            created_by=test_user.id,
            updated_by=test_user.id,
        )
        db_session.add(entry)
        db_session.commit()

        # 3. Admin downloads All Centers -> Succeeds (200), including SMPM and omitting empty CAIR
        all_centers_res = client.get("/periods/center/generate-combined-docx?center=all&start_date=2026-09-01&end_date=2026-09-15")
        assert all_centers_res.status_code == 200
        assert all_centers_res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        # 4. Admin downloads empty CAIR center -> 404 with indication
        cair_empty_res = client.get("/periods/center/generate-combined-docx?center=CAIR&start_date=2026-09-01&end_date=2026-09-15")
        assert cair_empty_res.status_code == 404
        assert "No entries found for CAIR in this period." in cair_empty_res.json()["detail"]

        # 5. Admin downloads filled SMPM center -> 200
        smpm_res = client.get("/periods/center/generate-combined-docx?center=SMPM&start_date=2026-09-01&end_date=2026-09-15")
        assert smpm_res.status_code == 200


# ============================================================================
# TEST 6: Finalize and Re-open Period
# ============================================================================
def test_finalize_and_reopen_period(client, test_user):
    with freeze_time("2026-09-10"):
        res = client.post(
            f"/periods/ensure-current?group_name={test_user.group_name}&created_by={test_user.id}"
        )
        assert res.status_code == 200
        period_id = res.json()["id"]

        # 1. Finalize period -> edit should become False
        fin_res = client.post(f"/periods/{period_id}/finalize")
        assert fin_res.status_code == 200
        assert fin_res.json()["edit"] is False

        # 2. Re-open period -> edit should become True
        reopen_res = client.post(f"/periods/{period_id}/reopen")
        assert reopen_res.status_code == 200
        assert reopen_res.json()["edit"] is True


# ============================================================================
# TEST 7: Auto-Ensure Current Periods for Center (CH Login Flow)
# ============================================================================
def test_ensure_current_periods_for_center(client, test_user, db_session):
    test_user.center = "CAIR"
    test_user.group = "AMC&NV"

    # Create another user in a second department under same center
    user2 = models.User(
        name="Dept2 Head",
        email="dept2@test.com",
        password="hashedpassword",
        center="CAIR",
        group="SMC",
        role="gh",
    )
    db_session.add(user2)
    db_session.commit()

    with freeze_time("2026-09-10"):
        res = client.post(f"/periods/ensure-current-center?center=CAIR&created_by={test_user.id}")
        assert res.status_code == 200
        periods = res.json()

        # Both departments in CAIR center must have their period created
        dept_names = {p["group_name"] for p in periods}
        assert "AMC&NV" in dept_names
        assert "SMC" in dept_names

        # Both must share identical start_date and end_date bounds
        for p in periods:
            assert p["start_date"] == "2026-09-01"
            assert p["end_date"] == "2026-09-15"
            assert p["edit"] is True


# ============================================================================
# TEST 8: Gap Period Backfilling (Multi-Month Inactivity Scenario)
# ============================================================================
def test_ensure_current_period_backfills_gaps(client, test_user, db_session):
    test_user.group = "AMC&NV"
    db_session.commit()

    # Step 1: User logs in Sept 1st half (Sept 10, 2026)
    with freeze_time("2026-09-10"):
        res1 = client.post(
            f"/periods/ensure-current?group_name={quote(test_user.group_name)}&created_by={test_user.id}"
        )
        assert res1.status_code == 200
        assert res1.json()["start_date"] == "2026-09-01"
        assert res1.json()["end_date"] == "2026-09-15"

    # Step 2: User doesn't log in for over 3 months, then logs in Dec 2nd half (Dec 20, 2026)
    with freeze_time("2026-12-20"):
        res2 = client.post(
            f"/periods/ensure-current?group_name={quote(test_user.group_name)}&created_by={test_user.id}"
        )
        assert res2.status_code == 200
        assert res2.json()["start_date"] == "2026-12-16"
        assert res2.json()["end_date"] == "2026-12-31"

        # Query all periods created for this group in 2026
        list_res = client.get(f"/periods/?group_name={quote(test_user.group_name)}&year=2026")
        assert list_res.status_code == 200
        periods = list_res.json()

        expected_ranges = [
            ("2026-09-01", "2026-09-15"),  # Sept 1st half
            ("2026-09-16", "2026-09-30"),  # Sept 2nd half
            ("2026-10-01", "2026-10-15"),  # Oct 1st half
            ("2026-10-16", "2026-10-31"),  # Oct 2nd half
            ("2026-11-01", "2026-11-15"),  # Nov 1st half
            ("2026-11-16", "2026-11-30"),  # Nov 2nd half
            ("2026-12-01", "2026-12-15"),  # Dec 1st half
            ("2026-12-16", "2026-12-31"),  # Dec 2nd half
        ]

        actual_ranges = [(p["start_date"], p["end_date"]) for p in periods]
        for exp in expected_ranges:
            assert exp in actual_ranges


# ============================================================================
# TEST 9: Center-Wide Gap Period Backfilling (CH Login Flow)
# ============================================================================
def test_ensure_current_center_backfills_all_departments(client, test_user, db_session):
    test_user.center = "SMPM"
    test_user.group = "AMC&NV"

    user2 = models.User(
        name="SMC Head",
        email="smc@test.com",
        password="hashedpassword",
        center="SMPM",
        group="SMC",
        role="gh",
    )
    db_session.add(user2)
    db_session.commit()

    # Step 1: Initial login in Sept 1st half
    with freeze_time("2026-09-10"):
        res = client.post(f"/periods/ensure-current-center?center=SMPM&created_by={test_user.id}")
        assert res.status_code == 200

    # Step 2: CH logs in Dec 2nd half -> all departments backfilled up to Dec 2nd half
    with freeze_time("2026-12-20"):
        res2 = client.post(f"/periods/ensure-current-center?center=SMPM&created_by={test_user.id}")
        assert res2.status_code == 200

        for dept in ["AMC&NV", "SMC"]:
            list_res = client.get(f"/periods/?group_name={quote(dept)}&year=2026")
            assert list_res.status_code == 200
            periods = list_res.json()
            actual_ranges = [(p["start_date"], p["end_date"]) for p in periods]
            assert ("2026-09-16", "2026-09-30") in actual_ranges
            assert ("2026-10-01", "2026-10-15") in actual_ranges
            assert ("2026-10-16", "2026-10-31") in actual_ranges
            assert ("2026-11-01", "2026-11-15") in actual_ranges
            assert ("2026-11-16", "2026-11-30") in actual_ranges
            assert ("2026-12-01", "2026-12-15") in actual_ranges
            assert ("2026-12-16", "2026-12-31") in actual_ranges


# ============================================================================
# TEST 10: First login in 2nd half automatically creates 1st half of that month
# ============================================================================
def test_first_login_in_second_half_creates_first_half(client, test_user, db_session):
    test_user.group = "SPMA"
    test_user.center = "CAIR"
    db_session.commit()

    # User / CH logs in on Sept 20, 2026 (2nd half) for the first time
    with freeze_time("2026-09-20"):
        res = client.post(
            f"/periods/ensure-current?group_name={quote(test_user.group_name)}&created_by={test_user.id}"
        )
        assert res.status_code == 200

        # Query all periods for SPMA in 2026
        list_res = client.get(f"/periods/?group_name={quote(test_user.group_name)}&year=2026")
        assert list_res.status_code == 200
        periods = list_res.json()
        ranges = [(p["start_date"], p["end_date"]) for p in periods]

        # Both Sept 1st half and Sept 2nd half MUST exist
        assert ("2026-09-01", "2026-09-15") in ranges
        assert ("2026-09-16", "2026-09-30") in ranges





