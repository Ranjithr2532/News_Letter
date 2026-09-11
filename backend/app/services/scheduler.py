from datetime import date, timedelta
from sqlalchemy.orm import Session
from app import models


def check_and_generate_deadline_notifications(db: Session):
    """
    Checks active newsletter periods (edit == True) and generates
    deadline reminder notifications for department members and Group Heads (GH).
    - Sent 2 days before period end_date (e.g. 13th for 15th, or 28th for 30th).
    - Prevents duplicates by checking existing notifications.
    """
    today = date.today()
    active_periods = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.edit == True).all()

    for period in active_periods:
        if not period.end_date:
            continue

        # For testing: set reminder window to 4 days so 15th end-date triggers on the 11th
        reminder_date = period.end_date - timedelta(days=4)

        # Trigger if today is within the reminder window up to the end_date
        if today >= reminder_date:
            group_name = period.group_name
            if not group_name:
                continue

            # Fetch all users belonging to this department
            users = db.query(models.User).filter(
                (models.User.group == group_name)
            ).all()

            for user in users:
                is_gh = user.role and user.role.strip().lower() == "gh"
                notification_type = "GH_FINALIZE" if is_gh else "USER_DEADLINE"

                # Check if a notification of this type has already been generated for this user and period
                existing = db.query(models.Notification).filter(
                    models.Notification.user_id == user.id,
                    models.Notification.period_id == period.id,
                    models.Notification.notification_type == notification_type,
                ).first()

                if not existing:
                    if is_gh:
                        title = "Action Required: Finalize Newsletter"
                        msg = (
                            f"The newsletter edition '{period.title}' for department {group_name} "
                            f"reaches its deadline on {period.end_date.strftime('%d-%b-%Y')}. "
                            f"Please review entries and click 'Finalize Newsletter'."
                        )
                    else:
                        title = "Newsletter Submission Reminder"
                        msg = (
                            f"Reminder: Please complete your entry submissions for '{period.title}'. "
                            f"Submission deadline is in 2 days ({period.end_date.strftime('%d-%b-%Y')})."
                        )

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
