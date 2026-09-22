from datetime import date, timedelta
from sqlalchemy.orm import Session
from app import models


def calculate_period_milestones(start_date: date, end_date: date):
    """
    Calculates the two-stage milestones and submission deadlines for any period:
    - Stage 1 (First Half):
        - Only applicable if period starts at beginning of month/quarter (start_date.day <= 5) and duration >= 20 days.
        - Activity range: start_date to 15th (or midpoint)
        - Submission window: 16th to 20th
        - Target deadline: 20th
    - Stage 2 (Second Half / Final):
        - Activity range: up to end_date
        - Submission window: day after end_date up to end_date + 5 days (1st–5th of next month)
        - Target deadline: final_deadline (5th of next month)
    """
    total_days = (end_date - start_date).days
    if total_days <= 0:
        total_days = 30

    has_first_half = (start_date.day <= 5) and (total_days >= 20)

    if has_first_half:
        if start_date.year == end_date.year and start_date.month == end_date.month:
            first_half_end = date(start_date.year, start_date.month, 15)
            first_half_deadline = date(start_date.year, start_date.month, 20)
        else:
            mid_days = total_days // 2
            first_half_end = start_date + timedelta(days=mid_days)
            first_half_deadline = first_half_end + timedelta(days=5)
    else:
        first_half_end = None
        first_half_deadline = None

    final_deadline = end_date + timedelta(days=5)
    return has_first_half, first_half_end, first_half_deadline, final_deadline


def check_and_generate_deadline_notifications(db: Session):
    """
    Checks active newsletter periods and manages two-checkpoint milestone notifications
    for department members and Group Heads (GH):

    1. First Half Milestone (e.g., Jan 16 to Jan 20):
       - Regular Users only: "First half (1st–15th) completed. Please add the descriptions and photos for your activities by 20-Jan (X days left)."
       - (GH does not receive midpoint notifications).
    2. Second Half / Final Milestone (e.g., Feb 1 to Feb 5):
       - Regular Users: "Period completed. Please add all remaining descriptions and photos by 05-Feb (X days left)."
       - Group Heads: "The entry deadline for '[Title]' is on 05-Feb. Please review the descriptions and photos, and finalize the newsletter edition."
    3. Post-Deadline Finalization (from Feb 6 onwards):
       - Group Heads: "The entry deadline for '[Title]' was on 05-Feb. Please review all descriptions and photos, and click 'Finalize Newsletter'."
    """
    today = date.today()

    # 0. Clean up stale notifications from past calendar years
    db.query(models.Notification).filter(
        models.Notification.period_id.in_(
            db.query(models.NewsletterPeriod.id).filter(
                models.NewsletterPeriod.end_date < date(today.year, 1, 1)
            )
        )
    ).delete(synchronize_session=False)

    # 1. Clean up notifications for finalized periods (edit == False)
    db.query(models.Notification).filter(
        models.Notification.period_id.in_(
            db.query(models.NewsletterPeriod.id).filter(
                models.NewsletterPeriod.edit == False
            )
        )
    ).delete(synchronize_session=False)

    # 2. Clean up any obsolete GH midpoint notifications
    db.query(models.Notification).filter(
        models.Notification.notification_type == "GH_MIDPOINT"
    ).delete(synchronize_session=False)

    # Process active periods (edit == True)
    active_periods = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.edit == True).all()

    for period in active_periods:
        if not period.start_date or not period.end_date:
            continue

        # Ignore periods from previous calendar years
        if period.end_date.year < today.year:
            continue

        # Retroactive creation safeguard (>30 days after end_date)
        if period.created_at and (period.created_at.date() - period.end_date).days > 30 and today >= period.created_at.date():
            continue

        group_name = period.group_name
        if not group_name:
            continue

        has_first_half, first_half_end, first_half_deadline, final_deadline = calculate_period_milestones(
            period.start_date, period.end_date
        )

        # Determine which stage is active today
        is_stage_1 = bool(
            has_first_half
            and first_half_end
            and today > first_half_end
            and today <= period.end_date
        )
        is_stage_2 = today > period.end_date

        if not is_stage_1 and not is_stage_2:
            # Still in early collection phase: No notifications needed
            continue

        users = db.query(models.User).filter(
            models.User.group == group_name
        ).all()

        for user in users:
            is_gh = bool(user.role and user.role.strip().lower() == "gh")

            if is_stage_2:
                # Stage 2: Second Half / Final Window (e.g., Feb 1 to Feb 5, and after)
                days_left = (final_deadline - today).days

                if is_gh:
                    notification_type = "GH_FINALIZE"
                    title = "Review & Finalize Newsletter"
                    if days_left >= 0:
                        msg = (
                            f"The entry deadline for '{period.title}' is on {final_deadline.strftime('%d-%b-%Y')}. "
                            f"Please review the descriptions and photos, and finalize the newsletter edition."
                        )
                    else:
                        msg = (
                            f"The entry deadline for '{period.title}' was on {final_deadline.strftime('%d-%b-%Y')}. "
                            f"Please review all descriptions and photos, and click 'Finalize Newsletter'."
                        )
                else:
                    notification_type = "USER_FINAL"
                    title = "Final Newsletter Update"
                    if days_left > 1:
                        msg = (
                            f"Period completed. Please add all remaining descriptions and photos "
                            f"by {final_deadline.strftime('%d-%b')} ({days_left} days left)."
                        )
                    elif days_left == 1:
                        msg = (
                            f"Period completed. Please add all remaining descriptions and photos "
                            f"by tomorrow ({final_deadline.strftime('%d-%b')})."
                        )
                    elif days_left == 0:
                        msg = (
                            f"Period completed. Today is the last day to add all remaining descriptions and photos "
                            f"({final_deadline.strftime('%d-%b')})."
                        )
                    else:
                        msg = (
                            f"The entry deadline for '{period.title}' passed on {final_deadline.strftime('%d-%b')}. "
                            f"Please add any remaining descriptions and photos."
                        )

            else:
                # Stage 1: First Half Window (16th to 20th)
                # Group Head (GH) does NOT receive Stage 1 notifications (only regular contributors)
                if is_gh:
                    continue

                notification_type = "USER_MIDPOINT"
                title = "Newsletter Update Reminder"
                days_left = (first_half_deadline - today).days

                start_fmt = period.start_date.strftime('%d-%b')
                end_fmt = first_half_end.strftime('%d-%b')
                dead_fmt = first_half_deadline.strftime('%d-%b')

                if days_left > 1:
                    msg = (
                        f"First half ({start_fmt}–{end_fmt}) completed. "
                        f"Please add the descriptions and photos for your activities by {dead_fmt} ({days_left} days left)."
                    )
                elif days_left == 1:
                    msg = (
                        f"First half ({start_fmt}–{end_fmt}) completed. "
                        f"Please add the descriptions and photos for your activities by tomorrow ({dead_fmt})."
                    )
                elif days_left == 0:
                    msg = (
                        f"First half ({start_fmt}–{end_fmt}) completed. "
                        f"Today is the last day to add the descriptions and photos ({dead_fmt})."
                    )
                else:
                    msg = (
                        f"The first half deadline for '{period.title}' passed on {dead_fmt}. "
                        f"Please add your descriptions and photos."
                    )

            existing = db.query(models.Notification).filter(
                models.Notification.user_id == user.id,
                models.Notification.period_id == period.id,
                models.Notification.notification_type == notification_type,
            ).first()

            if existing:
                # Dynamically update existing unread notification text without creating duplicate rows
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
