from datetime import date, timedelta
from sqlalchemy.orm import Session
from app import models


def check_and_generate_deadline_notifications(db: Session):
    """
    Checks active newsletter periods and manages deadline notifications
    for department members and Group Heads (GH):
    - Active periods (within 2 days before end_date up to end_date):
      - Regular Users: "Reminder: Please review and add entries for '[Title]'. Deadline is today / tomorrow / in X days (DD-Mon-YYYY)."
      - Group Heads: "The newsletter edition reaches its deadline on DD-Mon-YYYY. Please review entries and click 'Finalize Newsletter'."
    - Past-deadline unfinalized periods (today > end_date):
      - Regular Users: "The deadline for '[Title]' passed on DD-Mon-YYYY. Please review and update your entries."
      - Group Heads: "The newsletter edition '[Title]' reached its deadline on DD-Mon-YYYY. Please review remaining entries and click 'Finalize Newsletter'."
    - is_read is NOT automatically marked True by date crossing; notifications stay unread until the user clicks 'Got it!' or 'Mark as read'.
    """
    today = date.today()

    # Process active periods (edit == True)
    active_periods = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.edit == True).all()

    for period in active_periods:
        if not period.end_date:
            continue

        group_name = period.group_name
        if not group_name:
            continue

        # Standard reminder window: 2 days before end_date
        reminder_date = period.end_date - timedelta(days=2)

        # Only process if within reminder window or past end_date
        if today < reminder_date:
            continue

        # Fetch all users belonging to this department
        users = db.query(models.User).filter(
            models.User.group == group_name
        ).all()

        is_past_deadline = today > period.end_date
        days_left = (period.end_date - today).days

        if days_left == 0:
            time_phrase = f"is today ({period.end_date.strftime('%d-%b-%Y')})"
        elif days_left == 1:
            time_phrase = f"is tomorrow ({period.end_date.strftime('%d-%b-%Y')})"
        else:
            time_phrase = f"is in {days_left} days ({period.end_date.strftime('%d-%b-%Y')})"

        for user in users:
            is_gh = user.role and user.role.strip().lower() == "gh"
            notification_type = "GH_FINALIZE" if is_gh else "USER_DEADLINE"

            if is_past_deadline:
                # Deadline has passed
                if is_gh:
                    title = "Action Required: Finalize Newsletter"
                    msg = (
                        f"The newsletter edition '{period.title}' for department {group_name} "
                        f"reached its deadline on {period.end_date.strftime('%d-%b-%Y')}. "
                        f"Please review remaining entries and click 'Finalize Newsletter'."
                    )
                else:
                    title = "Deadline Notice"
                    msg = (
                        f"The deadline for '{period.title}' "
                        f"passed on {period.end_date.strftime('%d-%b-%Y')}. "
                        f"Please review and update your entries."
                    )
            else:
                # Active reminder window
                if is_gh:
                    title = "Action Required: Finalize Newsletter"
                    msg = (
                        f"The newsletter edition '{period.title}' for department {group_name} "
                        f"reaches its deadline on {period.end_date.strftime('%d-%b-%Y')}. "
                        f"Please review entries and click 'Finalize Newsletter'."
                    )
                else:
                    title = "Newsletter Deadline Reminder"
                    msg = (
                        f"Reminder: Please review and add entries for '{period.title}'. "
                        f"Deadline {time_phrase}."
                    )

            existing = db.query(models.Notification).filter(
                models.Notification.user_id == user.id,
                models.Notification.period_id == period.id,
                models.Notification.notification_type == notification_type,
            ).first()

            if existing:
                # Update text dynamically if notification is still unread by user
                if not existing.is_read:
                    if existing.title != title:
                        existing.title = title
                    if existing.message != msg:
                        existing.message = msg
            else:
                notif = models.Notification(
                    user_id=user.id,
                    period_id=period.id,
                    title=title,
                    message=msg,
                    notification_type=notification_type,
                    is_read=False,
                )
                db.add(notif)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error generating deadline notifications: {e}")
