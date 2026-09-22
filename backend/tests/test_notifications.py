import pytest
from datetime import date, datetime
from freezegun import freeze_time
from app import models


def test_stage1_first_half_notifications(client, test_user, db_session):
    """
    Tests Stage 1 (1st-15th):
    - On Jan 10 (early collection): No notification
    - On Jan 16 (first half concluded, 4 days left to Jan 20): Creates notification with "4 days left"
    - On Jan 19 (tomorrow is Jan 20): Updates message to "tomorrow"
    - Mark as read: unread count goes to 0
    """
    with freeze_time("2026-01-01"):
        period = models.NewsletterPeriod(
            group_name=test_user.group_name,
            title="January 2026 Edition",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            created_by=test_user.id,
            created_at=datetime(2026, 1, 1, 10, 0, 0),
            edit=True,
        )
        db_session.add(period)
        db_session.commit()

    # 1. On Jan 10 (early collection phase)
    with freeze_time("2026-01-10"):
        res = client.get(f"/notifications/?user_id={test_user.id}&unread_only=true")
        assert res.status_code == 200
        assert len(res.json()) == 0

    # 2. On Jan 16 (4 days left until Jan 20)
    with freeze_time("2026-01-16"):
        res = client.get(f"/notifications/?user_id={test_user.id}&unread_only=true")
        assert res.status_code == 200
        notifs = res.json()
        assert len(notifs) == 1
        assert notifs[0]["title"] == "Newsletter Update Reminder"
        assert "4 days left" in notifs[0]["message"]
        assert "descriptions and photos" in notifs[0]["message"]

    # 3. On Jan 19 (tomorrow is deadline) - should update existing row, not create duplicate
    with freeze_time("2026-01-19"):
        res = client.get(f"/notifications/?user_id={test_user.id}&unread_only=true")
        assert res.status_code == 200
        notifs = res.json()
        assert len(notifs) == 1
        assert "tomorrow" in notifs[0]["message"]

        # Mark as read
        notif_id = notifs[0]["id"]
        read_res = client.put(f"/notifications/{notif_id}/read")
        assert read_res.status_code == 200

        # Unread count should now be 0
        unread_res = client.get(f"/notifications/?user_id={test_user.id}&unread_only=true")
        assert len(unread_res.json()) == 0


def test_stage2_and_gh_finalization_notifications(client, db_session):
    """
    Tests Stage 2 (Feb 1 - Feb 5):
    - Regular user receives "Final Newsletter Update" (deadline 05-Feb)
    - Group Head receives "Review & Finalize Newsletter" (deadline is on 05-Feb)
    - On Feb 6 (after deadline): Group Head message updates to "deadline was on 05-Feb"
    """
    with freeze_time("2026-01-01"):
        user = models.User(
            name="Reg User",
            email="reg@example.com",
            password="pwd",
            role="User",
            group="SMC",
            type="user",
        )
        gh_user = models.User(
            name="GH User",
            email="gh@example.com",
            password="pwd",
            role="GH",
            group="SMC",
            type="user",
        )
        db_session.add_all([user, gh_user])
        db_session.commit()

        period = models.NewsletterPeriod(
            group_name="SMC",
            title="January 2026 Edition",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            created_by=gh_user.id,
            created_at=datetime(2026, 1, 1, 10, 0, 0),
            edit=True,
        )
        db_session.add(period)
        db_session.commit()

    # On Feb 1 (4 days left until Feb 5)
    with freeze_time("2026-02-01"):
        # Regular user
        res_user = client.get(f"/notifications/?user_id={user.id}&unread_only=true")
        notifs_user = res_user.json()
        assert len(notifs_user) == 1
        assert notifs_user[0]["title"] == "Final Newsletter Update"
        assert "4 days left" in notifs_user[0]["message"]

        # GH user
        res_gh = client.get(f"/notifications/?user_id={gh_user.id}&unread_only=true")
        notifs_gh = res_gh.json()
        assert len(notifs_gh) == 1
        assert notifs_gh[0]["title"] == "Review & Finalize Newsletter"
        assert "is on 05-Feb" in notifs_gh[0]["message"]
        assert "descriptions and photos" in notifs_gh[0]["message"]

    # On Feb 6 (after Feb 5 deadline)
    with freeze_time("2026-02-06"):
        res_gh = client.get(f"/notifications/?user_id={gh_user.id}&unread_only=true")
        notifs_gh = res_gh.json()
        assert len(notifs_gh) == 1
        assert "was on 05-Feb" in notifs_gh[0]["message"]
