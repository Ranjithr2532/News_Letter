import pytest
from unittest.mock import patch
from datetime import datetime, timedelta
from app import models


def test_request_otp_nonexistent_email(client):
    res = client.post("/users/request-otp", json={"email": "nobody@example.com"})
    assert res.status_code == 404
    assert "No user found" in res.json()["detail"]


def test_request_otp_and_verify_flow(client, test_user, db_session):
    # Mock send_otp_email to avoid sending real network emails during automated test
    with patch("app.routers.users.send_otp_email", return_value=True):
        res = client.post("/users/request-otp", json={"email": test_user.email})
        assert res.status_code == 200
        assert "OTP sent successfully" in res.json()["message"]

        # Check OTP saved in database
        otp_row = (
            db_session.query(models.OTP)
            .filter(models.OTP.email == test_user.email)
            .first()
        )
        assert otp_row is not None
        assert len(otp_row.otp_code) == 6
        assert otp_row.is_used is False

        # Verify with wrong OTP -> 400
        wrong_res = client.post(
            "/users/verify-otp",
            json={"email": test_user.email, "otp": "000000"},
        )
        assert wrong_res.status_code == 400
        assert "Invalid OTP" in wrong_res.json()["detail"]

        # Verify with correct OTP -> 200
        correct_res = client.post(
            "/users/verify-otp",
            json={"email": test_user.email, "otp": otp_row.otp_code},
        )
        assert correct_res.status_code == 200
        assert "OTP verified successfully" in correct_res.json()["message"]

        # Check OTP marked as used
        db_session.refresh(otp_row)
        assert otp_row.is_used is True

        # Updating password -> 200
        pw_res = client.post(
            "/users/update-password",
            json={"email": test_user.email, "new_password": "newSecurePassword123"},
        )
        assert pw_res.status_code == 200
        assert "Password updated successfully" in pw_res.json()["message"]

        # Verify login with new password
        login_res = client.post(
            "/users/login",
            json={"email": test_user.email, "password": "newSecurePassword123"},
        )
        assert login_res.status_code == 200


def test_rbac_permissions(client, test_user, db_session):
    test_user.role = "member"
    db_session.commit()

    # Create a period
    period = models.NewsletterPeriod(
        title="Test RBAC Period",
        start_date=datetime.now().date(),
        end_date=datetime.now().date() + timedelta(days=14),
        group_name=test_user.group,
        created_by=test_user.id,
        edit=True,
    )
    db_session.add(period)
    db_session.commit()

    # Member trying to finalize -> 403 Forbidden
    fin_res = client.post(f"/periods/{period.id}/finalize?user_id={test_user.id}")
    assert fin_res.status_code == 403
    assert "Only Group Heads and Editors" in fin_res.json()["detail"]

    # Member trying to re-open -> 403 Forbidden
    reopen_res = client.post(f"/periods/{period.id}/reopen?user_id={test_user.id}")
    assert reopen_res.status_code == 403
    assert "Only Group Heads and Editors" in reopen_res.json()["detail"]

    # Now create another user (GH)
    gh_user = models.User(
        name="GH User",
        email="gh_user@example.com",
        password="hashedpassword",
        role="gh",
        group=test_user.group,
    )
    db_session.add(gh_user)
    db_session.commit()

    # GH finalizing -> 200 OK
    gh_fin_res = client.post(f"/periods/{period.id}/finalize?user_id={gh_user.id}")
    assert gh_fin_res.status_code == 200
    assert gh_fin_res.json()["edit"] is False


def test_cors_origin_headers(client):
    # Allowed origin receives CORS header
    res = client.get("/", headers={"Origin": "http://localhost:5173"})
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"

    # Intranet IP origin receives CORS header
    lan_res = client.get("/", headers={"Origin": "http://172.18.100.55:5173"})
    assert lan_res.headers.get("access-control-allow-origin") == "http://172.18.100.55:5173"

    # Unlisted port (e.g. 4000) does NOT receive CORS allow header
    port_blocked_res = client.get("/", headers={"Origin": "http://localhost:4000"})
    assert port_blocked_res.headers.get("access-control-allow-origin") is None

    # Unauthorized external origin does NOT receive CORS allow header
    blocked_res = client.get("/", headers={"Origin": "http://unauthorized-evil-website.com"})
    assert blocked_res.headers.get("access-control-allow-origin") is None


def test_delete_user_with_notifications_and_otps(client, test_user, db_session):
    # Create period and notification for this user
    period = models.NewsletterPeriod(
        title="Sample Period",
        start_date=datetime.now().date(),
        end_date=datetime.now().date() + timedelta(days=14),
        group_name=test_user.group,
        created_by=test_user.id,
    )
    db_session.add(period)
    db_session.commit()

    notification = models.Notification(
        user_id=test_user.id,
        period_id=period.id,
        title="Deadline Notice",
        message="Deadline approaching",
        notification_type="USER_DEADLINE",
    )
    otp = models.OTP(
        email=test_user.email,
        otp_code="123456",
        expires_at=datetime.now() + timedelta(minutes=5),
    )
    db_session.add_all([notification, otp])
    db_session.commit()

    # Delete the user -> should cleanly delete user and cascade clean notifications & OTPs without not-null constraint errors
    del_res = client.delete(f"/users/{test_user.id}")
    assert del_res.status_code == 200
    assert del_res.json()["detail"] == "User deleted successfully"

    # Verify user is deleted
    assert db_session.query(models.User).filter(models.User.id == test_user.id).first() is None
    # Verify notification is cleaned up
    assert db_session.query(models.Notification).filter(models.Notification.user_id == test_user.id).first() is None


