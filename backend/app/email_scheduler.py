import smtplib
import calendar
import re
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any
import logging

from sqlalchemy import or_
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models import User, NewsletterPeriod, NewsletterEntry, EmailNotificationLog
from app.config import SMTP_SERVER, SMTP_PORT, SENDER_EMAIL, APP_PASSWORD

logger = logging.getLogger("email_scheduler")

# ==============================================================================
# 🎯 TARGET ROLES: Group Heads (GH) & Centre Heads (CH), including dual-roles
# ==============================================================================
DEFAULT_TARGET_ROLES = ["GH", "CH"]

# Target recipients: All GH, CH, and dual role (GH & CH) users across all centers/departments.

# Global Background Scheduler
scheduler = BackgroundScheduler()


def is_valid_email_syntax(email: str) -> bool:
    """Checks basic email syntax (supports .cmti.res.in, .gov.in, .com, etc.)."""
    if not email:
        return False
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return bool(re.match(pattern, email.strip()))


def send_html_email(to_email: str, subject: str, html_body: str) -> Dict[str, Any]:
    """Sends an HTML email via SMTP credentials configured in .env."""
    if not SENDER_EMAIL or not APP_PASSWORD:
        err_msg = "SENDER_EMAIL or APP_PASSWORD not configured in .env"
        logger.error(err_msg)
        return {"success": False, "error": err_msg}

    if not is_valid_email_syntax(to_email):
        err_msg = f"Invalid email format: '{to_email}'"
        logger.warning(err_msg)
        return {"success": False, "error": err_msg}

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=15)
        server.starttls()
        server.login(SENDER_EMAIL, APP_PASSWORD)

        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))

        server.send_message(msg)
        server.quit()
        logger.info(f"Notification email sent to {to_email}")
        return {"success": True, "error": None}
    except smtplib.SMTPRecipientsRefused as e:
        err_msg = f"Recipient address rejected by mail server: {str(e)}"
        logger.error(f"Failed to send email to {to_email}: {err_msg}")
        return {"success": False, "error": err_msg}
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return {"success": False, "error": str(e)}


def build_email_template(
    period_label: str,
    start_date_str: str,
    end_date_str: str,
    default_password: str = "Your Password / 123456",
    portal_url: str = "http://172.18.7.91:3055"
) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 600px; padding: 16px;">
        <p style="margin-top: 0;">Dear Sir/Madam,</p>
        
        <p>This is a gentle reminder to please submit the activities, achievements, and photographs for your department for the upcoming newsletter issue:</p>
        
        <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 10px 14px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: 600; color: #0f172a;">• Issue: {period_label} ({start_date_str} to {end_date_str})</p>
        </div>
        
        <p>Please use the link below to log in and update the details:<br/>
        <a href="{portal_url}" style="color: #2563eb; font-weight: bold; text-decoration: underline;" target="_blank">{portal_url}</a>
        </p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 14px; margin: 16px 0; border-radius: 6px;">
            <p style="margin: 0 0 6px 0; font-weight: 600; color: #334155;">Login Credentials:</p>
            <p style="margin: 2px 0;">• <strong>Username:</strong> Your Official CMTI Email ID</p>
            <p style="margin: 2px 0;">• <strong>Password:</strong> {default_password}</p>
        </div>
        
        <p style="margin-bottom: 0;">Thank you,<br/>
        <strong>CMTI Newsletter - "The Science of Making"</strong><br/>
        <span style="color: #64748b; font-size: 13px;">CMTI, Bengaluru</span>
        </p>
    </div>
    """


def send_timeline_reminder_emails() -> Dict[str, Any]:
    """
    100% Automated Reminder Dispatcher (0 parameters needed):
    1. Auto-detects 1st Half vs 2nd Half from today's calendar date.
    2. Queries target users from PostgreSQL.
    3. Checks EmailNotificationLog to guarantee zero duplicate emails.
    4. Sends emails and records audit logs with timestamps.
    """
    today = date.today()

    # 1. Auto-determine target reporting half:
    # - On the 1st (days 1-15): Reminds for PREVIOUS month's 2nd Half (e.g. Nov 1 -> Oct 16 to 31)
    # - On the 16th (days 16+): Reminds for CURRENT month's 1st Half (e.g. Nov 16 -> Nov 01 to 15)
    if today.day <= 15:
        if today.month == 1:
            prev_year = today.year - 1
            prev_month = 12
        else:
            prev_year = today.year
            prev_month = today.month - 1

        last_day_prev = calendar.monthrange(prev_year, prev_month)[1]
        target_start = date(prev_year, prev_month, 16)
        target_end = date(prev_year, prev_month, last_day_prev)
        period_label = f"{target_start.strftime('%B %Y')} - 2nd Half (16-{last_day_prev})"
    else:
        target_start = date(today.year, today.month, 1)
        target_end = date(today.year, today.month, 15)
        period_label = f"{target_start.strftime('%B %Y')} - 1st Half (01-15)"

    db: Session = SessionLocal()
    try:
        # 2. Count submissions recorded in this window
        periods = db.query(NewsletterPeriod).filter(
            NewsletterPeriod.start_date == target_start,
            NewsletterPeriod.end_date == target_end
        ).all()
        period_ids = [p.id for p in periods]
        total_entries = 0
        if period_ids:
            total_entries = db.query(NewsletterEntry).filter(
                NewsletterEntry.period_id.in_(period_ids)
            ).count()

        # 3. Query target users: supports 'GH', 'CH', and dual roles like 'CH, GH' / 'GH / CH'
        target_filters = [
            or_(
                User.role.ilike("%gh%"),
                User.role.ilike("%ch%"),
                User.role.ilike("%group head%"),
                User.role.ilike("%centre head%"),
                User.role.ilike("%center head%")
            ),
            ~User.role.ilike("%tech%"),  # Exclude technical staff
            User.email.isnot(None)
        ]


        users = db.query(User).filter(*target_filters).all()

        dispatch_results = []
        sent_emails = set()
        subject = f"Reminder: CMTI Newsletter - Please submit details for {period_label} Issue"

        for u in users:
            email = (u.email or "").strip().lower()
            if not email or email in sent_emails:
                continue

            # 4. Duplicate Check: Skip if already sent for this period
            already_sent = db.query(EmailNotificationLog).filter(
                EmailNotificationLog.period_label == period_label,
                EmailNotificationLog.recipient_email == email,
                EmailNotificationLog.status == "SENT"
            ).first()

            if already_sent:
                dispatch_results.append({
                    "name": u.name.strip(),
                    "email": email,
                    "role": u.role,
                    "status": "ALREADY_SENT"
                })
                sent_emails.add(email)
                continue

            # 5. Format and dispatch email
            html_body = build_email_template(
                period_label=period_label,
                start_date_str=target_start.strftime("%d-%b-%Y"),
                end_date_str=target_end.strftime("%d-%b-%Y"),
                default_password="Your Password / 123456",
                portal_url="http://172.18.7.91:3055"
            )

            res = send_html_email(email, subject, html_body)

            # 6. Record audit log in PostgreSQL
            try:
                log_entry = EmailNotificationLog(
                    period_label=period_label,
                    recipient_email=email,
                    recipient_name=u.name.strip(),
                    recipient_role=u.role,
                    status="SENT" if res["success"] else "FAILED",
                    error_message=res.get("error")
                )
                db.add(log_entry)
                db.commit()
            except Exception as log_err:
                db.rollback()
                logger.error(f"Failed to record email log: {str(log_err)}")

            dispatch_results.append({
                "name": u.name.strip(),
                "email": email,
                "role": u.role,
                "status": "SENT" if res["success"] else "FAILED"
            })
            sent_emails.add(email)

        sent_count = len([d for d in dispatch_results if d["status"] == "SENT"])
        already_count = len([d for d in dispatch_results if d["status"] == "ALREADY_SENT"])
        logger.info(f"✅ Reminder check complete for {period_label}: {sent_count} sent, {already_count} already sent.")

        return {
            "period": period_label,
            "dispatched_count": sent_count,
            "already_sent_count": already_count,
            "results": dispatch_results
        }

    finally:
        db.close()


def automated_scheduled_reminder():
    """Triggered automatically by APScheduler cron job."""
    logger.info("⏰ [APScheduler] Waking up to process automated newsletter reminder...")
    try:
        send_timeline_reminder_emails()
    except Exception as e:
        logger.error(f"❌ [APScheduler Error]: {str(e)}")
