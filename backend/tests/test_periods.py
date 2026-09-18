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


# ============================================================================
# TEST 11: Multi-period query & docx generation without personal names
# ============================================================================
def test_multi_period_query_and_clean_docx_headers(client, test_user, db_session):
    test_user.center = "SMPM"
    test_user.group = "AMC&NV"
    db_session.commit()

    with freeze_time("2026-09-10"):
        # Period 1 for AMC&NV
        p1_res = client.post(
            f"/periods/ensure-current?group_name=AMC%26NV&created_by={test_user.id}"
        )
        p1_id = p1_res.json()["id"]

        # Period 2 for SMC
        user2 = models.User(
            name="SMC Member",
            email="smc_mem@test.com",
            password="hashedpassword",
            center="SMPM",
            group="SMC",
            role="member",
        )
        db_session.add(user2)
        db_session.commit()

        p2_res = client.post(
            f"/periods/ensure-current?group_name=SMC&created_by={user2.id}"
        )
        p2_id = p2_res.json()["id"]

        # Global category & custom category
        cat1 = models.CategoryStage(name="Research & Development", stage_number=1, is_active=True)
        cat2 = models.CategoryStage(name="Custom Period 1 Cat", stage_number=2, is_active=True, period_id=p1_id)
        db_session.add_all([cat1, cat2])
        db_session.commit()

        # Add entries in p1 and p2
        entry1 = models.NewsletterEntry(
            period_id=p1_id,
            group_name="AMC&NV",
            category_id=cat1.id,
            title="AMC Project Alpha",
            description="AMC Description",
            created_by=test_user.id,
            updated_by=test_user.id,
        )
        entry2 = models.NewsletterEntry(
            period_id=p2_id,
            group_name="SMC",
            category_id=cat1.id,
            title="SMC Project Beta",
            description="SMC Description",
            created_by=user2.id,
            updated_by=user2.id,
        )
        db_session.add_all([entry1, entry2])
        db_session.commit()

        # Test querying categories with comma-separated period IDs
        cat_res = client.get(f"/categories/?period_id={p1_id},{p2_id}")
        assert cat_res.status_code == 200
        cat_names = [c["name"] for c in cat_res.json()]
        assert "Research & Development" in cat_names
        assert "Custom Period 1 Cat" in cat_names

        # Test querying entries with comma-separated period IDs
        entries_res = client.get(f"/entries/?period_id={p1_id},{p2_id}")
        assert entries_res.status_code == 200
        titles = [e["title"] for e in entries_res.json()]
        assert "AMC Project Alpha" in titles
        assert "SMC Project Beta" in titles

        # Test contributors with comma-separated period IDs
        contrib_res = client.get(f"/periods/{p1_id},{p2_id}/contributors")
        assert contrib_res.status_code == 200
        c_names = [c["name"] for c in contrib_res.json()]
        assert test_user.name in c_names
        assert "SMC Member" in c_names

        # Test downloading combined docx for center SMPM
        docx_res = client.get("/periods/center/generate-combined-docx?center=SMPM&start_date=2026-09-01&end_date=2026-09-15")
        assert docx_res.status_code == 200
        assert docx_res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        # Verify Word document content has NO "(Centre Head:" or "(Group Head:" text
        from io import BytesIO
        from docx import Document
        doc = Document(BytesIO(docx_res.content))
        full_text = "\n".join([p.text for p in doc.paragraphs])
        assert "(Centre Head:" not in full_text
        assert "(Group Head:" not in full_text
        assert "AMC Project Alpha" in full_text
        assert "SMC Project Beta" in full_text


def test_category_first_combined_and_gh_downloads(client, test_user, db_session):
    """Verify that combined CH download and single GH download group entries category-by-category."""
    test_user.center = "SMPM"
    test_user.group = "SMC"
    user_amc = models.User(
        name="AMC Head",
        email="amc_head@test.com",
        password="hashedpassword",
        center="SMPM",
        group="AMC",
        role="gh",
    )
    db_session.add(user_amc)
    db_session.commit()

    with freeze_time("2026-09-10"):
        # Create periods for SMC and AMC
        p_smc_res = client.post(
            "/periods/",
            json={
                "title": "SMC Newsletter - Sep 2026 H1",
                "start_date": "2026-09-01",
                "end_date": "2026-09-15",
                "group_name": "SMC",
                "created_by": test_user.id,
            },
        )
        p_smc_id = p_smc_res.json()["id"]

        p_amc_res = client.post(
            "/periods/",
            json={
                "title": "AMC Newsletter - Sep 2026 H1",
                "start_date": "2026-09-01",
                "end_date": "2026-09-15",
                "group_name": "AMC",
                "created_by": user_amc.id,
            },
        )
        p_amc_id = p_amc_res.json()["id"]

        # Categories: Training (stage 1) and Events (stage 2)
        cat_training = models.CategoryStage(name="Training Programs", stage_number=1, is_active=True)
        cat_events = models.CategoryStage(name="Events & Workshops", stage_number=2, is_active=True)
        db_session.add_all([cat_training, cat_events])
        db_session.commit()

        # SMC entries (1 Training, 1 Event)
        e1 = models.NewsletterEntry(
            period_id=p_smc_id,
            group_name="SMC",
            category_id=cat_training.id,
            title="SMC AI Training",
            description="SMC AI Workshop",
            created_by=test_user.id,
            updated_by=test_user.id,
        )
        e2 = models.NewsletterEntry(
            period_id=p_smc_id,
            group_name="SMC",
            category_id=cat_events.id,
            title="SMC Annual Summit",
            description="SMC Summit details",
            created_by=test_user.id,
            updated_by=test_user.id,
        )
        # AMC entries (1 Training, 1 Event)
        e3 = models.NewsletterEntry(
            period_id=p_amc_id,
            group_name="AMC",
            category_id=cat_training.id,
            title="AMC CNC Training",
            description="AMC CNC Workshop",
            created_by=user_amc.id,
            updated_by=user_amc.id,
        )
        e4 = models.NewsletterEntry(
            period_id=p_amc_id,
            group_name="AMC",
            category_id=cat_events.id,
            title="AMC Tech Expo",
            description="AMC Expo details",
            created_by=user_amc.id,
            updated_by=user_amc.id,
        )
        db_session.add_all([e1, e2, e3, e4])
        db_session.commit()

        # 1. Test Combined CH Download across SMPM center
        comb_res = client.get("/periods/center/generate-combined-docx?center=SMPM&start_date=2026-09-01&end_date=2026-09-15")
        assert comb_res.status_code == 200

        from io import BytesIO
        from docx import Document
        doc = Document(BytesIO(comb_res.content))
        full_text = "\n".join([p.text for p in doc.paragraphs])

        # Verify Category 1 comes before Category 2
        pos_cat1 = full_text.find("1. TRAINING PROGRAMS")
        pos_cat2 = full_text.find("2. EVENTS & WORKSHOPS")
        assert pos_cat1 != -1 and pos_cat2 != -1
        assert pos_cat1 < pos_cat2

        # Verify both SMC and AMC training entries are within Category 1
        pos_smc_train = full_text.find("SMC AI Training")
        pos_amc_train = full_text.find("AMC CNC Training")
        assert pos_smc_train != -1 and pos_amc_train != -1
        assert pos_cat1 < pos_smc_train < pos_cat2
        assert pos_cat1 < pos_amc_train < pos_cat2

        # Verify both SMC and AMC event entries are within Category 2
        pos_smc_event = full_text.find("SMC Annual Summit")
        pos_amc_event = full_text.find("AMC Tech Expo")
        assert pos_smc_event != -1 and pos_amc_event != -1
        assert pos_cat2 < pos_smc_event
        assert pos_cat2 < pos_amc_event

        # 2. Test GH Single Period Download for SMC
        smc_doc_res = client.get(f"/periods/{p_smc_id}/generate-docx")
        assert smc_doc_res.status_code == 200
        smc_doc = Document(BytesIO(smc_doc_res.content))
        smc_text = "\n".join([p.text for p in smc_doc.paragraphs])
        assert "1. TRAINING PROGRAMS" in smc_text
        assert "2. EVENTS & WORKSHOPS" in smc_text
        assert "SMC AI Training" in smc_text
        assert "SMC Annual Summit" in smc_text
        assert "AMC CNC Training" not in smc_text


def test_admin_all_centers_category_first_download(client, test_user, db_session):
    """Verify Admin downloading All Centers combined groups entries strictly category-by-category with [Center - Dept] tags."""
    test_user.center = "SMPM"
    test_user.group = "SMC"
    user_cair = models.User(
        name="CAIR Head",
        email="cair_head@test.com",
        password="hashedpassword",
        center="CAIR",
        group="Robotics",
        role="gh",
    )
    db_session.add(user_cair)
    db_session.commit()

    with freeze_time("2026-09-10"):
        # Create periods for SMPM-SMC and CAIR-Robotics
        p1 = client.post(
            "/periods/",
            json={
                "title": "SMPM SMC Newsletter",
                "start_date": "2026-09-01",
                "end_date": "2026-09-15",
                "group_name": "SMC",
                "created_by": test_user.id,
            },
        ).json()["id"]

        p2 = client.post(
            "/periods/",
            json={
                "title": "CAIR Robotics Newsletter",
                "start_date": "2026-09-01",
                "end_date": "2026-09-15",
                "group_name": "Robotics",
                "created_by": user_cair.id,
            },
        ).json()["id"]

        cat1 = models.CategoryStage(name="Technical Training", stage_number=1, is_active=True)
        cat2 = models.CategoryStage(name="Conferences", stage_number=2, is_active=True)
        db_session.add_all([cat1, cat2])
        db_session.commit()

        e1 = models.NewsletterEntry(
            period_id=p1,
            group_name="SMC",
            category_id=cat1.id,
            title="SMPM AI Workshop",
            created_by=test_user.id,
            updated_by=test_user.id,
        )
        e2 = models.NewsletterEntry(
            period_id=p2,
            group_name="Robotics",
            category_id=cat1.id,
            title="CAIR ROS Workshop",
            created_by=user_cair.id,
            updated_by=user_cair.id,
        )
        e3 = models.NewsletterEntry(
            period_id=p1,
            group_name="SMC",
            category_id=cat2.id,
            title="SMPM Annual Meet",
            created_by=test_user.id,
            updated_by=test_user.id,
        )
        e4 = models.NewsletterEntry(
            period_id=p2,
            group_name="Robotics",
            category_id=cat2.id,
            title="CAIR Automation Summit",
            created_by=user_cair.id,
            updated_by=user_cair.id,
        )
        db_session.add_all([e1, e2, e3, e4])
        db_session.commit()

        # Admin downloads All Centers combined (center=all)
        all_res = client.get("/periods/center/generate-combined-docx?center=all&start_date=2026-09-01&end_date=2026-09-15")
        assert all_res.status_code == 200

        from io import BytesIO
        from docx import Document
        doc = Document(BytesIO(all_res.content))
        full_text = "\n".join([p.text for p in doc.paragraphs])

        # Verify Category 1 is first, Category 2 is second
        pos_cat1 = full_text.find("1. TECHNICAL TRAINING")
        pos_cat2 = full_text.find("2. CONFERENCES")
        assert pos_cat1 != -1 and pos_cat2 != -1
        assert pos_cat1 < pos_cat2

        # Verify entries from different centers appear under Category 1 with clean titles (no dept tags)
        assert "SMPM AI Workshop" in full_text
        assert "CAIR ROS Workshop" in full_text
        assert "[SMPM - SMC]" not in full_text
        assert "[CAIR - Robotics]" not in full_text
        pos_e1 = full_text.find("SMPM AI Workshop")
        pos_e2 = full_text.find("CAIR ROS Workshop")
        assert pos_cat1 < pos_e1 < pos_cat2
        assert pos_cat1 < pos_e2 < pos_cat2

        # Verify Category 2 entries
        assert "SMPM Annual Meet" in full_text
        assert "CAIR Automation Summit" in full_text
        pos_e3 = full_text.find("SMPM Annual Meet")
        pos_e4 = full_text.find("CAIR Automation Summit")
        assert pos_cat2 < pos_e3
        assert pos_cat2 < pos_e4


def test_ch_can_edit_and_delete_entries(client, test_user, db_session):
    """Verify that a user with role CH can edit and delete entries in their center."""
    ch_user = models.User(
        name="SMPM Centre Head",
        email="smpm_ch@test.com",
        password="hashedpassword",
        center="SMPM",
        role="ch",
    )
    author_user = models.User(
        name="Staff Member",
        email="staff@test.com",
        password="hashedpassword",
        center="SMPM",
        group="SMC",
        role="member",
    )
    db_session.add_all([ch_user, author_user])
    db_session.commit()

    with freeze_time("2026-09-10"):
        p_res = client.post(
            "/periods/",
            json={
                "title": "SMPM Period",
                "start_date": "2026-09-01",
                "end_date": "2026-09-15",
                "group_name": "SMC",
                "created_by": author_user.id,
            },
        )
        period_id = p_res.json()["id"]

        cat = models.CategoryStage(name="Research", stage_number=1, is_active=True)
        db_session.add(cat)
        db_session.commit()

        # Author creates entry
        e_res = client.post(
            "/entries/",
            json={
                "period_id": period_id,
                "category_id": cat.id,
                "group_name": "SMC",
                "title": "Original Title",
                "description": "Original Description",
                "created_by": author_user.id,
            },
        )
        assert e_res.status_code == 200
        entry_id = e_res.json()["id"]

        # CH updates entry
        put_res = client.put(
            f"/entries/{entry_id}",
            json={
                "title": "Updated by CH Title",
                "description": "Updated by CH Description",
                "updated_by": ch_user.id,
            },
        )
        assert put_res.status_code == 200
        assert put_res.json()["title"] == "Updated by CH Title"

        # CH deletes entry
        del_res = client.delete(f"/entries/{entry_id}?user_id={ch_user.id}")
        assert del_res.status_code == 200
        assert del_res.json()["detail"] == "Entry deleted"









