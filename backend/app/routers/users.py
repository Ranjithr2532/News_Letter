import smtplib
import random
import string
import logging
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/login", response_model=schemas.UserRead)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or user.password != payload.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return user


@router.post("/", response_model=schemas.UserRead)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    data = payload.model_dump()
    group_val = data.get("group") or data.get("group_name")
    data["group"] = group_val
    if "group_name" in data:
        del data["group_name"]

    user = models.User(**data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=List[schemas.UserRead])
def list_users(
    group: Optional[str] = None,
    group_name: Optional[str] = None,
    role: Optional[str] = None,
    center: Optional[str] = None,
    type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.User)
    target_group = group or group_name
    if target_group is not None:
        query = query.filter(models.User.group == target_group)
    if role is not None:
        query = query.filter(models.User.role == role)
    if center is not None:
        query = query.filter(models.User.center == center)
    if type is not None:
        query = query.filter(models.User.type == type)

    return query.order_by(models.User.id.asc()).all()


@router.get("/groups/list", response_model=List[str])
def list_center_groups(center: Optional[str] = None, db: Session = Depends(get_db)):
    group_set = set()
    u_query = db.query(models.User.group).filter(models.User.group.isnot(None), models.User.group != "")
    if center and center.strip().lower() not in ("all", "all centers", "", "undefined", "null"):
        u_query = u_query.filter(models.User.center == center)
    for row in u_query.distinct().all():
        if row[0] and row[0].strip():
            group_set.add(row[0].strip())

    if center and center.strip().lower() not in ("all", "all centers", "", "undefined", "null"):
        p_query = (
            db.query(models.NewsletterPeriod.group_name)
            .join(models.User, models.NewsletterPeriod.created_by == models.User.id)
            .filter(models.User.center == center)
        )
        for row in p_query.distinct().all():
            if row[0] and row[0].strip():
                group_set.add(row[0].strip())
    else:
        p_query = db.query(models.NewsletterPeriod.group_name)
        for row in p_query.distinct().all():
            if row[0] and row[0].strip():
                group_set.add(row[0].strip())

    groups = sorted(list(group_set))
    return groups


@router.get("/centers/list", response_model=List[str])
def list_centers(db: Session = Depends(get_db)):
    center_set = set()
    for row in db.query(models.User.center).filter(models.User.center.isnot(None), models.User.center != "").distinct().all():
        if row[0] and row[0].strip():
            center_set.add(row[0].strip())
    centers = sorted(list(center_set))
    return centers


@router.get("/chs/list", response_model=List[schemas.UserRead])
def list_centre_heads(db: Session = Depends(get_db)):
    chs = db.query(models.User).filter(models.User.role.ilike("ch")).order_by(models.User.center.asc(), models.User.name.asc()).all()
    return chs


@router.get("/ghs/list", response_model=List[schemas.UserRead])
def list_group_heads(db: Session = Depends(get_db)):
    ghs = db.query(models.User).filter(models.User.role.ilike("gh")).order_by(models.User.center.asc(), models.User.group.asc(), models.User.name.asc()).all()
    return ghs


@router.get("/{user_id}", response_model=schemas.UserRead)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=schemas.UserRead)
def update_user(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"] != user.email:
        conflict = db.query(models.User).filter(models.User.email == update_data["email"]).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Email already in use by another account")

    # Handle group_name alias if provided
    if "group_name" in update_data:
        if "group" not in update_data or not update_data["group"]:
            update_data["group"] = update_data.pop("group_name")
        else:
            update_data.pop("group_name")

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"detail": "User deleted successfully"}


# Helper: Send Email via Gmail SMTP
def send_otp_email(email: str, otp: str):
    SMTP_SERVER = "smtp.gmail.com"
    SMTP_PORT = 587
    SENDER_EMAIL = "ranju23052002@gmail.com"# Later replace with the what email required
    APP_PASSWORD = "xeeg ishe zcpy unxa"# replace with actual name

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, APP_PASSWORD)

        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = email
        msg["Subject"] = "Your OTP for Password Reset - CMTI Newsletter"

        body = f"""
Dear User,

Your OTP for password reset is: {otp}

This OTP will expire in 5 minutes.
Please do not share this OTP with anyone.

"""
        msg.attach(MIMEText(body, "plain"))
        server.send_message(msg)
        server.quit()
        logger.info(f"OTP sent successfully to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email: {str(e)}")
        return False


def generate_otp():
    return ''.join(random.choices(string.digits, k=6))


# ============================================================================
# 1. REQUEST OTP (Sends 6-digit OTP to Email)
# ============================================================================
@router.post("/request-otp")
def request_otp(request: schemas.EmailRequest, db: Session = Depends(get_db)):
    try:
        user = db.query(models.User).filter(models.User.email == request.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="No user found with this email address")

        otp = generate_otp()
        expires_at = datetime.now() + timedelta(minutes=5)

        # Save OTP to database
        new_otp = models.OTP(
            email=request.email,
            otp_code=otp,
            expires_at=expires_at,
            is_used=False
        )
        db.add(new_otp)
        db.commit()

        # Send email
        if not send_otp_email(request.email, otp):
            raise HTTPException(status_code=500, detail="Failed to send OTP email. Please check internet or SMTP credentials.")

        return {"message": "OTP sent successfully to your email"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in request_otp: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# 2. VERIFY OTP
# ============================================================================
@router.post("/verify-otp")
def verify_otp(verification: schemas.OTPVerification, db: Session = Depends(get_db)):
    try:
        otp_record = (
            db.query(models.OTP)
            .filter(
                and_(
                    models.OTP.email == verification.email,
                    models.OTP.is_used == False,
                    models.OTP.expires_at > datetime.now()
                )
            )
            .order_by(models.OTP.id.desc())
            .first()
        )

        if not otp_record:
            raise HTTPException(status_code=400, detail="No valid OTP found or OTP has expired")

        if otp_record.otp_code != verification.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP entered")

        # Mark OTP as used
        otp_record.is_used = True
        db.commit()

        return {"message": "OTP verified successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in verify_otp: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# 3. UPDATE PASSWORD (Direct password update)
# ============================================================================
@router.post("/update-password")
def update_password(request: schemas.PasswordUpdateRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No user found with this email address")

    if len(request.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters long")

    user.password = request.new_password.strip()
    db.commit()

    return {
        "message": "Password updated successfully",
        "email": user.email
    }