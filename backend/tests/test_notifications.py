import pytest
from datetime import date
from freezegun import freeze_time
from app import models


def test_notification_generation_and_once_read_rule(client, test_user, db_session):
    """
    Tests that deadline notifications are created 2 days before the end_date,
    and once marked as read (is_read=True), they do not appear in unread lists.
    """
    # Create period with end date 2026-09-15 (1st half)
    period = models.NewsletterPeriod(
        group_name=test_user.group_name,
        title="SMC Newsletter Sept 1-15",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 15),
        created_by=test_user.id,
        edit=True,
    )
    db_session.add(period)
    db_session.commit()
    db_session.refresh(period)

    # 1. On 2026-09-10 (5 days before 15th), scheduler should NOT create notification
    with freeze_time("2026-09-10"):
        res = client.get(f"/notifications/?user_id={test_user.id}&unread_only=true")
        assert res.status_code == 200
        assert len(res.json()) == 0

    # 2. On 2026-09-13 (2 days before 15th), scheduler SHOULD create notification
    with freeze_time("2026-09-13"):
        res = client.get(f"/notifications/?user_id={test_user.id}&unread_only=true")
        assert res.status_code == 200
        notifs = res.json()
        assert len(notifs) == 1
        notif_id = notifs[0]["id"]
        assert notifs[0]["is_read"] is False

        # Unread count endpoint
        cnt_res = client.get(f"/notifications/unread-count?user_id={test_user.id}")
        assert cnt_res.status_code == 200
        assert cnt_res.json()["unread_count"] == 1

        # 3. Mark notification as read
        read_res = client.put(f"/notifications/{notif_id}/read")
        assert read_res.status_code == 200
        assert read_res.json()["is_read"] is True

        # 4. Now fetching unread_only should return 0 (Once Read, Don't Show Again rule)
        unread_res = client.get(f"/notifications/?user_id={test_user.id}&unread_only=true")
        assert unread_res.status_code == 200
        assert len(unread_res.json()) == 0

        # Unread count should be 0
        cnt_res2 = client.get(f"/notifications/unread-count?user_id={test_user.id}")
        assert cnt_res2.json()["unread_count"] == 0
