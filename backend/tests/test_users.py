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
