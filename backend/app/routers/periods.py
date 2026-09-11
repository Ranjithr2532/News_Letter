from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from docx import Document
import os
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from datetime import date
import calendar


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
    group_name: Optional[str] = None,
    center: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    months: Optional[float] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.NewsletterPeriod)

    # Filter by center if provided (for CH role)
    if center is not None and center.strip() != "":
        query = query.join(models.User, models.NewsletterPeriod.created_by == models.User.id).filter(
            models.User.center == center
        )
        # If CH also selected a specific group
        if group_name and group_name.strip().lower() not in ("all", "all groups", "", "undefined", "null"):
            query = query.filter(models.NewsletterPeriod.group_name == group_name)
    elif group_name and group_name.strip().lower() not in ("all", "all groups", "", "undefined", "null"):
        query = query.filter(models.NewsletterPeriod.group_name == group_name)

    if year is not None:
        query = query.filter(extract('year', models.NewsletterPeriod.start_date) == year)

    if month is not None:
        query = query.filter(extract('month', models.NewsletterPeriod.start_date) == month)

    if months is not None and months > 0:
        cutoff = date.today() - timedelta(days=int(months * 30))
        query = query.filter(models.NewsletterPeriod.start_date >= cutoff)

    # Default to current year if no year, month, or months filter was provided
    if year is None and month is None and months is None:
        query = query.filter(extract('year', models.NewsletterPeriod.start_date) == date.today().year)

    return query.order_by(models.NewsletterPeriod.start_date.desc()).all()


@router.get("/years/", response_model=List[int])
def list_period_years(
    group_name: Optional[str] = None,
    center: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(extract('year', models.NewsletterPeriod.start_date))

    if center is not None and center.strip() != "":
        query = query.join(models.User, models.NewsletterPeriod.created_by == models.User.id).filter(
            models.User.center == center
        )
        if group_name and group_name.strip().lower() not in ("all", "all groups", "", "undefined", "null"):
            query = query.filter(models.NewsletterPeriod.group_name == group_name)
    elif group_name and group_name.strip().lower() not in ("all", "all groups", "", "undefined", "null"):
        query = query.filter(models.NewsletterPeriod.group_name == group_name)

    results = query.distinct().all()
    years = sorted([int(r[0]) for r in results if r[0] is not None], reverse=True)
    return years


@router.get("/{period_id}", response_model=schemas.PeriodRead)
def get_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    return period


@router.put("/{period_id}", response_model=schemas.PeriodRead)
def update_period(period_id: int, payload: schemas.PeriodUpdate, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(period, key, value)

    db.commit()
    db.refresh(period)
    return period


@router.post("/{period_id}/finalize", response_model=schemas.PeriodRead)
def finalize_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    period.edit = False
    db.commit()
    db.refresh(period)
    return period


@router.delete("/{period_id}")
def delete_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    db.delete(period)
    db.commit()
    return {"detail": "Period deleted"}

import io
from PIL import Image
from docx.enum.text import WD_ALIGN_PARAGRAPH
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

    # 2. Add entries sequentially
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
            if not photo.file_path:
                continue

            photo_file = photo.file_path
            if not os.path.exists(photo_file):
                filename_only = os.path.basename(photo.file_path)
                d_path = os.path.join(r"D:\Newsletter_Uploads", filename_only)
                local_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", filename_only)
                if os.path.exists(d_path):
                    photo_file = d_path
                elif os.path.exists(local_path):
                    photo_file = local_path

            if os.path.exists(photo_file):
                try:
                    img_p = doc.add_paragraph()
                    img_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

                    # Uniform standardized dimensions: 4.8 inches width x 3.2 inches height
                    target_w_in, target_h_in = 4.8, 3.2
                    target_px_w, target_px_h = 1200, 800
                    target_aspect = target_px_w / target_px_h

                    with Image.open(photo_file) as img:
                        if img.mode in ("RGBA", "P"):
                            img = img.convert("RGB")

                        w, h = img.size
                        aspect = (w / h) if h > 0 else 1.0

                        if aspect > target_aspect:
                            new_w = int(h * target_aspect)
                            left = (w - new_w) // 2
                            img_cropped = img.crop((left, 0, left + new_w, h))
                        else:
                            new_h = int(w / target_aspect)
                            top = (h - new_h) // 2
                            img_cropped = img.crop((0, top, w, top + new_h))

                        resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
                        img_resized = img_cropped.resize((target_px_w, target_px_h), resample_filter)

                        img_buf = io.BytesIO()
                        img_resized.save(img_buf, format="JPEG", quality=95)
                        img_buf.seek(0)

                    img_p.add_run().add_picture(img_buf, width=Inches(target_w_in), height=Inches(target_h_in))

                except Exception as e:
                    print(f"Error processing picture {photo_file}: {e}")
                    try:
                        img_p.add_run().add_picture(photo_file, width=Inches(4.8), height=Inches(3.2))
                    except Exception as fallback_err:
                        print(f"Fallback picture insertion failed for {photo_file}: {fallback_err}")

        doc.add_paragraph("")  # spacing
        entry_counter += 1

    return doc


def build_combined_center_docx(center_name: str, period_label: str, depts_entries: dict) -> Document:
    doc = Document()

    # Word Header
    section = doc.sections[0]
    header = section.header
    header_p = header.paragraphs[0]
    header_p.text = f"{center_name} Center — Combined Newsletter ({period_label})"
    for r in header_p.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(100, 116, 139)

    # Document Main Title
    title_p = doc.add_paragraph()
    title_run = title_p.add_run(f"{center_name} Center Newsletter")
    title_run.bold = True
    title_run.font.size = Pt(18)
    title_run.font.color.rgb = RGBColor(37, 99, 235)
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    sub_p = doc.add_paragraph()
    sub_run = sub_p.add_run(f"Consolidated Department Activities — {period_label}")
    sub_run.italic = True
    sub_run.font.size = Pt(12)
    sub_run.font.color.rgb = RGBColor(100, 116, 139)
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph("")  # spacing

    entry_global_counter = 1
    for dept_name, data in depts_entries.items():
        gh_name = data.get("gh_name", "")
        entries = data.get("entries", [])
        if not entries:
            continue

        # Department Heading
        dept_p = doc.add_paragraph()
        dept_run = dept_p.add_run(f"■ Department: {dept_name}")
        dept_run.bold = True
        dept_run.font.size = Pt(14)
        dept_run.font.color.rgb = RGBColor(15, 23, 42)
        if gh_name:
            gh_run = dept_p.add_run(f"  (Group Head: {gh_name})")
            gh_run.font.size = Pt(11)
            gh_run.italic = True
            gh_run.font.color.rgb = RGBColor(71, 85, 105)

        for entry in entries:
            entry_p = doc.add_paragraph()
            entry_run = entry_p.add_run(f"  {entry_global_counter}. {entry.title}")
            entry_run.bold = True
            entry_run.font.size = Pt(12)
            entry_run.font.color.rgb = RGBColor(0, 0, 0)

            if entry.description:
                desc_p = doc.add_paragraph(f"     {entry.description}")
                for r in desc_p.runs:
                    r.font.color.rgb = RGBColor(51, 65, 85)

            for photo in entry.photos:
                if not photo.file_path:
                    continue

                photo_file = photo.file_path
                if not os.path.exists(photo_file):
                    filename_only = os.path.basename(photo.file_path)
                    d_path = os.path.join(r"D:\Newsletter_Uploads", filename_only)
                    local_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", filename_only)
                    if os.path.exists(d_path):
                        photo_file = d_path
                    elif os.path.exists(local_path):
                        photo_file = local_path

                if os.path.exists(photo_file):
                    try:
                        img_p = doc.add_paragraph()
                        img_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        target_w_in, target_h_in = 4.8, 3.2
                        target_px_w, target_px_h = 1200, 800
                        target_aspect = target_px_w / target_px_h

                        with Image.open(photo_file) as img:
                            if img.mode in ("RGBA", "P"):
                                img = img.convert("RGB")
                            w, h = img.size
                            aspect = (w / h) if h > 0 else 1.0
                            if aspect > target_aspect:
                                new_w = int(h * target_aspect)
                                left = (w - new_w) // 2
                                img_cropped = img.crop((left, 0, left + new_w, h))
                            else:
                                new_h = int(w / target_aspect)
                                top = (h - new_h) // 2
                                img_cropped = img.crop((0, top, w, top + new_h))

                            resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
                            img_resized = img_cropped.resize((target_px_w, target_px_h), resample_filter)
                            img_buf = io.BytesIO()
                            img_resized.save(img_buf, format="JPEG", quality=95)
                            img_buf.seek(0)

                        img_p.add_run().add_picture(img_buf, width=Inches(target_w_in), height=Inches(target_h_in))
                    except Exception as e:
                        print(f"Error inserting picture {photo_file}: {e}")

            doc.add_paragraph("")
            entry_global_counter += 1

        doc.add_paragraph("")  # spacing between departments

    if entry_global_counter == 1:
        empty_p = doc.add_paragraph()
        empty_run = empty_p.add_run("No newsletter activity entries recorded for this period.")
        empty_run.italic = True
        empty_run.font.color.rgb = RGBColor(100, 116, 139)
        empty_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    return doc


@router.get("/center/generate-combined-docx")
def generate_center_combined_docx(
    center: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.NewsletterPeriod)
        .join(models.User, models.NewsletterPeriod.created_by == models.User.id)
        .filter(models.User.center == center)
    )
    if start_date and end_date:
        query = query.filter(
            models.NewsletterPeriod.start_date == start_date,
            models.NewsletterPeriod.end_date == end_date,
        )
    elif year:
        query = query.filter(extract('year', models.NewsletterPeriod.start_date) == year)
        if month:
            query = query.filter(extract('month', models.NewsletterPeriod.start_date) == month)

    periods = query.order_by(models.NewsletterPeriod.group_name.asc(), models.NewsletterPeriod.start_date.asc()).all()
    if not periods:
        raise HTTPException(status_code=404, detail="No newsletter periods found for this center and selection.")

    depts_entries = {}
    for p in periods:
        dept = p.group_name or "General"
        if dept not in depts_entries:
            depts_entries[dept] = {
                "gh_name": p.creator_name,
                "entries": [],
            }

        categories = (
            db.query(models.CategoryStage)
            .filter(
                models.CategoryStage.is_active == True,
                (models.CategoryStage.period_id == None) | (models.CategoryStage.period_id == p.id),
            )
            .order_by(models.CategoryStage.stage_number.asc(), models.CategoryStage.id.asc())
            .all()
        )
        for cat in categories:
            cat_entries = (
                db.query(models.NewsletterEntry)
                .filter(
                    models.NewsletterEntry.period_id == p.id,
                    models.NewsletterEntry.category_id == cat.id,
                )
                .order_by(models.NewsletterEntry.display_order.asc(), models.NewsletterEntry.id.asc())
                .all()
            )
            depts_entries[dept]["entries"].extend(cat_entries)

    if start_date and end_date:
        period_label = f"{start_date.strftime('%b %d')} – {end_date.strftime('%b %d, %Y')}"
    elif year and month:
        period_label = f"{calendar.month_name[month]} {year}"
    elif year:
        period_label = f"Full Year {year}"
    else:
        period_label = "Consolidated Edition"

    doc = build_combined_center_docx(center, period_label, depts_entries)

    clean_center = center.replace(' ', '_')
    clean_label = period_label.replace(' ', '_').replace('–', '-')
    filename = f"{clean_center}_Combined_Newsletter_{clean_label}.docx"
    file_path = os.path.join(GENERATED_DIR, filename)
    doc.save(file_path)

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/{period_id}/generate-docx")
def generate_docx(period_id: int, created_by: Optional[int] = None, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    categories = (
        db.query(models.CategoryStage)
        .filter(
            models.CategoryStage.is_active == True,
            (models.CategoryStage.period_id == None) | (models.CategoryStage.period_id == period_id),
        )
        .order_by(models.CategoryStage.stage_number.asc(), models.CategoryStage.id.asc())
        .all()
    )

    all_entries = []
    for category in categories:
        query = (
            db.query(models.NewsletterEntry)
            .filter(
                models.NewsletterEntry.period_id == period_id,
                models.NewsletterEntry.category_id == category.id,
            )
        )
        if created_by is not None:
            query = query.filter(models.NewsletterEntry.created_by == created_by)
        entries = query.order_by(models.NewsletterEntry.display_order.asc()).all()
        all_entries.extend(entries)

    doc = build_newsletter_docx(period.title, all_entries)

    file_path = os.path.join(GENERATED_DIR, f"newsletter_period_{period_id}.docx")
    doc.save(file_path)

    clean_title = period.title.replace(' ', '_')
    if created_by is not None:
        user_obj = db.query(models.User).filter(models.User.id == created_by).first()
        if user_obj and (user_obj.name or user_obj.email):
            user_name_clean = (user_obj.name or user_obj.email).replace(' ', '_')
            clean_filename = f"{clean_title}_{user_name_clean}.docx"
        else:
            clean_filename = f"{clean_title}_user_{created_by}.docx"
    else:
        clean_filename = f"{clean_title}.docx"

    return FileResponse(
        path=file_path,
        filename=clean_filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/{period_id}/categories/{category_id}/generate-docx")
def generate_category_docx(period_id: int, category_id: int, created_by: Optional[int] = None, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    category = db.query(models.CategoryStage).filter(models.CategoryStage.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    query = (
        db.query(models.NewsletterEntry)
        .filter(
            models.NewsletterEntry.period_id == period_id,
            models.NewsletterEntry.category_id == category_id,
        )
    )
    if created_by is not None:
        query = query.filter(models.NewsletterEntry.created_by == created_by)
    entries = query.order_by(models.NewsletterEntry.display_order.asc()).all()

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

def get_current_period_bounds():
    """Returns (start_date, end_date) for whichever half of the current 
    month today's real date falls into."""
    today = date.today()
    year, month, day = today.year, today.month, today.day

    if day <= 15:
        start = date(year, month, 1)
        end = date(year, month, 15)
    else:
        start = date(year, month, 16)
        last_day = calendar.monthrange(year, month)[1]
        end = date(year, month, last_day)

    return start, end


@router.post("/ensure-current", response_model=schemas.PeriodRead)
def ensure_current_period(group_name: str, created_by: int, db: Session = Depends(get_db)):
    """Auto-creates today's current half-month period for this group, 
    if it doesn't already exist. Safe to call repeatedly — never creates 
    duplicates, never creates anything outside the current year."""
    today = date.today()
    start, end = get_current_period_bounds()

    if not group_name or group_name.strip().lower() in ("", "undefined", "null", "none"):
        raise HTTPException(status_code=400, detail="Invalid group name provided")

    # Safety guard — never create a period outside the current year
    if start.year != today.year or end.year != today.year:
        raise HTTPException(status_code=400, detail="Cannot create period outside current year")

    existing = (
        db.query(models.NewsletterPeriod)
        .filter(
            models.NewsletterPeriod.group_name == group_name,
            models.NewsletterPeriod.start_date == start,
            models.NewsletterPeriod.end_date == end,
        )
        .first()
    )
    if existing:
        return existing

    month_name = start.strftime("%b")
    title = f"{group_name} Event Details — {month_name} {start.day}-{end.day}, {start.year}"

    period = models.NewsletterPeriod(
        group_name=group_name,
        title=title,
        start_date=start,
        end_date=end,
        created_by=created_by,
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


@router.get("/{period_id}/contributors")
def get_period_contributors(period_id: int, db: Session = Depends(get_db)):
    """Returns the list of members who actually contributed/created entries in this period."""
    entries = db.query(models.NewsletterEntry).filter(models.NewsletterEntry.period_id == period_id).all()
    user_ids = set()
    entry_counts = {}
    for entry in entries:
        if entry.created_by:
            user_ids.add(entry.created_by)
            entry_counts[entry.created_by] = entry_counts.get(entry.created_by, 0) + 1

    if not user_ids:
        return []

    users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()
    contributors = []
    for u in users:
        contributors.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "designation": u.designation,
            "role": u.role,
            "group": getattr(u, "group_name", None) or u.group,
            "entry_count": entry_counts.get(u.id, 0),
        })

    # Sort descending by number of entries, then alphabetically by name
    contributors.sort(key=lambda item: (-item["entry_count"], item["name"] or ""))
    return contributors