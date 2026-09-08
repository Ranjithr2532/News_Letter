from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.post("/", response_model=schemas.PeriodRead)
def create_period(payload: schemas.PeriodCreate, db: Session = Depends(get_db)):
    period = models.NewsletterPeriod(**payload.model_dump())
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


@router.get("/", response_model=List[schemas.PeriodRead])
def list_periods(group_name: str, db: Session = Depends(get_db)):
    return (
        db.query(models.NewsletterPeriod)
        .filter(models.NewsletterPeriod.group_name == group_name)
        .order_by(models.NewsletterPeriod.start_date.desc())
        .all()
    )


@router.get("/{period_id}", response_model=schemas.PeriodRead)
def get_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    return period