from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.services.scheduler import check_and_generate_deadline_notifications

router = APIRouter()


@router.get("/", response_model=List[schemas.NotificationRead])
def list_user_notifications(
    user_id: int,
    unread_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    # Run dynamic deadline check to ensure notifications are up to date
    check_and_generate_deadline_notifications(db)

    query = db.query(models.Notification).filter(models.Notification.user_id == user_id)
    if unread_only:
        query = query.filter(models.Notification.is_read == False)
    return query.order_by(models.Notification.created_at.desc()).all()


@router.get("/unread-count")
def get_unread_count(user_id: int, db: Session = Depends(get_db)):
    check_and_generate_deadline_notifications(db)
    count = db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.is_read == False,
    ).count()
    return {"unread_count": count}


@router.put("/{notification_id}/read", response_model=schemas.NotificationRead)
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    notif = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.put("/read-all")
def mark_all_read(user_id: int, db: Session = Depends(get_db)):
    db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.is_read == False,
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read"}
