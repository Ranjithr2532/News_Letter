from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from docx import Document
import os
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

GENERATED_DIR = "generated_docs"
os.makedirs(GENERATED_DIR, exist_ok=True)


@router.get("/{period_id}/generate-docx")
def generate_docx(period_id: int, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    categories = (
        db.query(models.CategoryStage)
        .filter(models.CategoryStage.is_active == True)
        .order_by(models.CategoryStage.stage_number.asc())
        .all()
    )

    doc = Document()
    doc.add_heading(period.title, level=0)
    doc.add_paragraph(f"{period.start_date} to {period.end_date}")

    for category in categories:
        entries = (
            db.query(models.NewsletterEntry)
            .filter(
                models.NewsletterEntry.period_id == period_id,
                models.NewsletterEntry.category_id == category.id,
            )
            .order_by(models.NewsletterEntry.display_order.asc())
            .all()
        )

        if not entries:
            continue  # skip empty categories

        doc.add_heading(category.name, level=1)

        for entry in entries:
            doc.add_heading(entry.title, level=2)
            doc.add_paragraph(entry.description or "")

            for photo in entry.photos:
                if os.path.exists(photo.file_path):
                    try:
                        doc.add_picture(photo.file_path, width=None)
                    except Exception:
                        pass  # skip if image fails to load

            doc.add_paragraph("")  # spacing between entries

    file_path = os.path.join(GENERATED_DIR, f"newsletter_period_{period_id}.docx")
    doc.save(file_path)

    return FileResponse(
        path=file_path,
        filename=f"{period.title.replace(' ', '_')}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )