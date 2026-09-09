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
    existing = (
        db.query(models.NewsletterPeriod)
        .filter(
            models.NewsletterPeriod.group_name == payload.group_name,
            models.NewsletterPeriod.start_date == payload.start_date,
            models.NewsletterPeriod.end_date == payload.end_date,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A newsletter period for this date range already exists in your group.",
        )

    period = models.NewsletterPeriod(**payload.model_dump())
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


from typing import List, Optional
from datetime import date, timedelta
from sqlalchemy import extract

@router.get("/", response_model=List[schemas.PeriodRead])
def list_periods(
    group_name: str,
    year: Optional[int] = None,
    month: Optional[int] = None,
    months: Optional[float] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.group_name == group_name)

    if year is not None:
        query = query.filter(extract('year', models.NewsletterPeriod.start_date) == year)

    if month is not None:
        query = query.filter(extract('month', models.NewsletterPeriod.start_date) == month)

    if months is not None and months > 0:
        cutoff = date.today() - timedelta(days=int(months * 30))
        query = query.filter(models.NewsletterPeriod.start_date >= cutoff)

    return query.order_by(models.NewsletterPeriod.start_date.desc()).all()


@router.get("/years/", response_model=List[int])
def list_period_years(group_name: str, db: Session = Depends(get_db)):
    results = (
        db.query(extract('year', models.NewsletterPeriod.start_date))
        .filter(models.NewsletterPeriod.group_name == group_name)
        .distinct()
        .all()
    )
    years = sorted([int(r[0]) for r in results if r[0] is not None], reverse=True)
    return years


@router.get("/{period_id}", response_model=schemas.PeriodRead)
def get_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    return period


@router.delete("/{period_id}")
def delete_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    db.delete(period)
    db.commit()
    return {"detail": "Period deleted"}

from docx.shared import Inches, Pt, RGBColor

GENERATED_DIR = "generated_docs"
os.makedirs(GENERATED_DIR, exist_ok=True)


def build_newsletter_docx(period_title: str, entries: list) -> Document:
    doc = Document()

    # 1. Word Header for ALL pages
    section = doc.sections[0]
    header = section.header
    header_p = header.paragraphs[0]
    header_p.text = period_title
    for r in header_p.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(0, 0, 0)


    # 3. Add entries sequentially
    entry_counter = 1
    for entry in entries:
        entry_p = doc.add_paragraph()
        entry_run = entry_p.add_run(f"{entry_counter}. {entry.title}")
        entry_run.bold = True
        entry_run.font.size = Pt(13)
        entry_run.font.color.rgb = RGBColor(0, 0, 0)

        if entry.description:
            desc_p = doc.add_paragraph(entry.description)
            for r in desc_p.runs:
                r.font.color.rgb = RGBColor(0, 0, 0)

        for photo in entry.photos:
            if photo.file_path and os.path.exists(photo.file_path):
                try:
                    doc.add_picture(photo.file_path, width=Inches(5.5))
                except Exception as e:
                    print(f"Error adding picture {photo.file_path}: {e}")

        doc.add_paragraph("")  # spacing
        entry_counter += 1

    return doc


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

    all_entries = []
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
        all_entries.extend(entries)

    doc = build_newsletter_docx(period.title, all_entries)

    file_path = os.path.join(GENERATED_DIR, f"newsletter_period_{period_id}.docx")
    doc.save(file_path)

    clean_filename = f"{period.title.replace(' ', '_')}.docx"
    return FileResponse(
        path=file_path,
        filename=clean_filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/{period_id}/categories/{category_id}/generate-docx")
def generate_category_docx(period_id: int, category_id: int, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    category = db.query(models.CategoryStage).filter(models.CategoryStage.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    entries = (
        db.query(models.NewsletterEntry)
        .filter(
            models.NewsletterEntry.period_id == period_id,
            models.NewsletterEntry.category_id == category_id,
        )
        .order_by(models.NewsletterEntry.display_order.asc())
        .all()
    )

    doc = build_newsletter_docx(period.title, entries)

    file_path = os.path.join(GENERATED_DIR, f"category_{category_id}_period_{period_id}.docx")
    doc.save(file_path)

    clean_category_name = category.name.replace(' ', '_')
    clean_filename = f"{clean_category_name}_event.docx"
    return FileResponse(
        path=file_path,
        filename=clean_filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
