import os
import io
import calendar
from datetime import date, timedelta
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import extract
from sqlalchemy.orm import Session
from PIL import Image
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor

from app.database import get_db
from app import models, schemas

router = APIRouter()

GENERATED_DIR = "generated_docs"
os.makedirs(GENERATED_DIR, exist_ok=True)


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


@router.post("/{period_id}/reopen", response_model=schemas.PeriodRead)
def reopen_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    period.edit = True
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


def _append_entry_to_doc(doc: Document, entry, counter: int):
    entry_p = doc.add_paragraph()
    entry_run = entry_p.add_run(f"    {counter}. {entry.title}")
    entry_run.bold = True
    entry_run.font.size = Pt(12)
    entry_run.font.color.rgb = RGBColor(0, 0, 0)

    if entry.description:
        desc_p = doc.add_paragraph(f"       {entry.description}")
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

    doc.add_paragraph("")  # spacing


def build_combined_center_docx(
    center_name: str,
    period_label: str,
    structure_data: dict,
    is_all_centers: bool = False,
    group_name: Optional[str] = None,
) -> Document:
    doc = Document()

    # Word Header
    section = doc.sections[0]
    header = section.header
    header_p = header.paragraphs[0]
    if is_all_centers:
        header_p.text = f"CMTI Institutional Newsletter — All Centers Combined ({period_label})"
    elif group_name:
        header_p.text = f"{center_name} Center — {group_name} Department ({period_label})"
    else:
        header_p.text = f"{center_name} Center — Combined Newsletter ({period_label})"
    for r in header_p.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(100, 116, 139)

    # Document Main Title
    title_p = doc.add_paragraph()
    if is_all_centers:
        title_text = "CMTI Institutional Newsletter"
    elif group_name:
        title_text = f"{center_name} — {group_name} Newsletter"
    else:
        title_text = f"{center_name} Center Newsletter"
    title_run = title_p.add_run(title_text)
    title_run.bold = True
    title_run.font.size = Pt(18)
    title_run.font.color.rgb = RGBColor(37, 99, 235)
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    sub_p = doc.add_paragraph()
    if is_all_centers:
        sub_text = f"Consolidated All Centers & Departments — {period_label}"
    elif group_name:
        sub_text = f"{group_name} Department Activities — {period_label}"
    else:
        sub_text = f"Consolidated Department Activities — {period_label}"
    sub_run = sub_p.add_run(sub_text)
    sub_run.italic = True
    sub_run.font.size = Pt(12)
    sub_run.font.color.rgb = RGBColor(100, 116, 139)
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph("")

    entry_global_counter = 1

    if is_all_centers:
        for c_name, c_data in structure_data.items():
            ch_name = c_data.get("ch_name", "")
            depts = c_data.get("depts", {})
            has_entries = any(len(d.get("entries", [])) > 0 for d in depts.values())
            if not has_entries:
                continue

            center_p = doc.add_paragraph()
            center_run = center_p.add_run(f"★ CENTER: {c_name}")
            center_run.bold = True
            center_run.font.size = Pt(16)
            center_run.font.color.rgb = RGBColor(30, 58, 138)
            if ch_name:
                ch_run = center_p.add_run(f"  (Centre Head: {ch_name})")
                ch_run.font.size = Pt(12)
                ch_run.italic = True
                ch_run.font.color.rgb = RGBColor(180, 83, 9)

            for dept_name, data in depts.items():
                gh_name = data.get("gh_name", "")
                entries = data.get("entries", [])
                if not entries:
                    continue

                dept_p = doc.add_paragraph()
                dept_run = dept_p.add_run(f"  ■ Department: {dept_name}")
                dept_run.bold = True
                dept_run.font.size = Pt(13)
                dept_run.font.color.rgb = RGBColor(15, 23, 42)
                if gh_name:
                    gh_run = dept_p.add_run(f"  (Group Head: {gh_name})")
                    gh_run.font.size = Pt(11)
                    gh_run.italic = True
                    gh_run.font.color.rgb = RGBColor(71, 85, 105)

                for entry in entries:
                    _append_entry_to_doc(doc, entry, entry_global_counter)
                    entry_global_counter += 1

                doc.add_paragraph("")
            doc.add_paragraph("")
    else:
        for dept_name, data in structure_data.items():
            gh_name = data.get("gh_name", "")
            entries = data.get("entries", [])
            if not entries:
                continue

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
                _append_entry_to_doc(doc, entry, entry_global_counter)
                entry_global_counter += 1

            doc.add_paragraph("")

    if entry_global_counter == 1:
        empty_p = doc.add_paragraph()
        empty_run = empty_p.add_run("No newsletter activity entries recorded for this selection.")
        empty_run.italic = True
        empty_run.font.color.rgb = RGBColor(100, 116, 139)
        empty_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    return doc


@router.get("/center/generate-combined-docx")
def generate_center_combined_docx(
    center: Optional[str] = None,
    group_name: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
):
    is_all = center is None or center.strip().lower() in ("all", "all centers", "", "undefined", "null")
    is_all_groups = group_name is None or group_name.strip().lower() in ("all", "all departments", "all groups", "", "undefined", "null")

    query = (
        db.query(models.NewsletterPeriod)
        .join(models.User, models.NewsletterPeriod.created_by == models.User.id)
    )
    if not is_all:
        query = query.filter(models.User.center == center)
    if not is_all_groups:
        query = query.filter(models.NewsletterPeriod.group_name == group_name)

    if start_date and end_date:
        query = query.filter(
            models.NewsletterPeriod.start_date == start_date,
            models.NewsletterPeriod.end_date == end_date,
        )
    elif year:
        query = query.filter(extract('year', models.NewsletterPeriod.start_date) == year)
        if month:
            query = query.filter(extract('month', models.NewsletterPeriod.start_date) == month)

    periods = query.order_by(models.User.center.asc(), models.NewsletterPeriod.group_name.asc(), models.NewsletterPeriod.start_date.asc()).all()
    if not periods:
        raise HTTPException(status_code=404, detail="No newsletter periods found for this selection.")

    # Pre-fetch CHs and GHs for accurate hierarchy mapping
    all_chs = db.query(models.User).filter(models.User.role.ilike("ch")).all()
    ch_by_center = {ch.center.strip().upper(): ch.name.strip() for ch in all_chs if ch.center}
    all_ghs = db.query(models.User).filter(models.User.role.ilike("gh")).all()
    gh_by_center_group = {
        f"{(gh.center or '').strip().upper()}_{(gh.group or '').strip().upper()}": gh.name.strip()
        for gh in all_ghs if gh.group
    }
    gh_by_group = {
        (gh.group or '').strip().upper(): gh.name.strip()
        for gh in all_ghs if gh.group
    }

    if is_all:
        structure_data = {}
        for p in periods:
            c_name = p.creator.center if (p.creator and p.creator.center) else "General"
            dept = p.group_name or "General"
            c_key = c_name.strip().upper()
            d_key = dept.strip().upper()
            official_gh = gh_by_center_group.get(f"{c_key}_{d_key}") or gh_by_group.get(d_key) or p.creator_name

            if c_name not in structure_data:
                structure_data[c_name] = {
                    "ch_name": ch_by_center.get(c_key, ""),
                    "depts": {},
                }
            if dept not in structure_data[c_name]["depts"]:
                structure_data[c_name]["depts"][dept] = {
                    "gh_name": official_gh,
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
                structure_data[c_name]["depts"][dept]["entries"].extend(cat_entries)
    else:
        structure_data = {}
        for p in periods:
            c_name = p.creator.center if (p.creator and p.creator.center) else (center or "General")
            dept = p.group_name or "General"
            c_key = c_name.strip().upper()
            d_key = dept.strip().upper()
            official_gh = gh_by_center_group.get(f"{c_key}_{d_key}") or gh_by_group.get(d_key) or p.creator_name

            if dept not in structure_data:
                structure_data[dept] = {
                    "gh_name": official_gh,
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
                structure_data[dept]["entries"].extend(cat_entries)

    if start_date and end_date:
        period_label = f"{start_date.strftime('%b %d')} – {end_date.strftime('%b %d, %Y')}"
    elif year and month:
        period_label = f"{calendar.month_name[month]} {year}"
    elif year:
        period_label = f"Full Year {year}"
    else:
        period_label = "Consolidated Edition"

    center_display = "All_Centers" if is_all else center.replace(' ', '_')
    group_display = f"_{group_name.replace(' ', '_')}" if not is_all_groups else ""
    doc = build_combined_center_docx(
        center if not is_all else "CMTI",
        period_label,
        structure_data,
        is_all_centers=is_all,
        group_name=group_name if not is_all_groups else None,
    )

    clean_label = period_label.replace(' ', '_').replace('–', '-')
    filename = f"CMTI_{center_display}{group_display}_Newsletter_{clean_label}.docx"
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

def get_current_period_bounds() -> Tuple[date, date]:
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


def get_half_month_bounds(year: int, month: int, half: int) -> Tuple[date, date]:
    """Returns (start_date, end_date) for a specific year, month, and half (1 or 2)."""
    if half == 1:
        return date(year, month, 1), date(year, month, 15)
    else:
        last_day = calendar.monthrange(year, month)[1]
        return date(year, month, 16), date(year, month, last_day)


def get_all_period_bounds_up_to_today(start_from: Optional[date] = None) -> List[Tuple[date, date]]:
    """
    Returns a chronological list of (start_date, end_date) tuples for every half-month
    from start_from (or Jan 1st of current year if None / past year) up to today's current half-month.
    """
    today = date.today()
    curr_year = today.year
    curr_month = today.month
    curr_half = 1 if today.day <= 15 else 2

    if start_from is None or start_from.year < curr_year:
        start_year = curr_year
        start_month = curr_month
        start_half = 1
    else:
        start_year = start_from.year
        start_month = start_from.month
        start_half = 1 if start_from.day <= 15 else 2

    bounds = []
    y = start_year
    m = start_month
    h = start_half

    while (y < curr_year) or (y == curr_year and m < curr_month) or (y == curr_year and m == curr_month and h <= curr_half):
        s_date, e_date = get_half_month_bounds(y, m, h)
        bounds.append((s_date, e_date))
        if h == 1:
            h = 2
        else:
            h = 1
            m += 1
            if m > 12:
                m = 1
                y += 1

    return bounds


def ensure_all_periods_for_group(group_name: str, created_by: int, db: Session) -> models.NewsletterPeriod:
    """
    Backfills and auto-creates all missing half-month periods for this group from either
    the earliest existing period in the current year (or Jan 1st of current year) up to and
    including today's current half-month period.
    Returns today's current period.
    """
    today = date.today()
    curr_start, curr_end = get_current_period_bounds()

    # Find earliest existing period in current year for this group
    earliest_period = (
        db.query(models.NewsletterPeriod)
        .filter(
            models.NewsletterPeriod.group_name == group_name,
            extract('year', models.NewsletterPeriod.start_date) == today.year
        )
        .order_by(models.NewsletterPeriod.start_date.asc())
        .first()
    )

    start_anchor = earliest_period.start_date if earliest_period else None
    all_bounds = get_all_period_bounds_up_to_today(start_anchor)

    current_period = None

    for s_date, e_date in all_bounds:
        existing = (
            db.query(models.NewsletterPeriod)
            .filter(
                models.NewsletterPeriod.group_name == group_name,
                models.NewsletterPeriod.start_date == s_date,
                models.NewsletterPeriod.end_date == e_date,
            )
            .first()
        )
        if existing:
            if s_date == curr_start and e_date == curr_end:
                current_period = existing
            continue

        month_name = s_date.strftime("%b")
        title = f"{group_name} Event Details — {month_name} {s_date.day}-{e_date.day}, {s_date.year}"
        new_period = models.NewsletterPeriod(
            group_name=group_name,
            title=title,
            start_date=s_date,
            end_date=e_date,
            created_by=created_by,
        )
        db.add(new_period)
        if s_date == curr_start and e_date == curr_end:
            current_period = new_period

    db.commit()

    if current_period:
        db.refresh(current_period)
    else:
        current_period = (
            db.query(models.NewsletterPeriod)
            .filter(
                models.NewsletterPeriod.group_name == group_name,
                models.NewsletterPeriod.start_date == curr_start,
                models.NewsletterPeriod.end_date == curr_end,
            )
            .first()
        )
    return current_period


@router.post("/ensure-current", response_model=schemas.PeriodRead)
def ensure_current_period(group_name: str, created_by: int, db: Session = Depends(get_db)):
    """Auto-creates all missing half-month periods for this group up to today's current
    half-month period, ensuring continuous history across months without gaps."""
    today = date.today()
    start, end = get_current_period_bounds()

    if not group_name or group_name.strip().lower() in ("", "undefined", "null", "none"):
        raise HTTPException(status_code=400, detail="Invalid group name provided")

    # Safety guard — never create a period outside the current year
    if start.year != today.year or end.year != today.year:
        raise HTTPException(status_code=400, detail="Cannot create period outside current year")

    return ensure_all_periods_for_group(group_name, created_by, db)


@router.post("/ensure-current-center", response_model=List[schemas.PeriodRead])
def ensure_current_periods_for_center(center: str, created_by: int, db: Session = Depends(get_db)):
    """Auto-creates all missing half-month periods up to today for all departments/groups 
    under the given center, ensuring synchronized and gapless periods across all departments."""
    today = date.today()
    start, end = get_current_period_bounds()

    if not center or center.strip().lower() in ("", "undefined", "null", "none"):
        raise HTTPException(status_code=400, detail="Invalid center provided")

    # Safety guard — never create a period outside the current year
    if start.year != today.year or end.year != today.year:
        raise HTTPException(status_code=400, detail="Cannot create period outside current year")

    # Get all distinct groups belonging to this center from users table
    groups_query = (
        db.query(models.User.group)
        .filter(
            models.User.center == center,
            models.User.group.isnot(None),
            models.User.group != ""
        )
        .distinct()
        .all()
    )
    center_groups = sorted(list({g[0].strip() for g in groups_query if g[0] and g[0].strip()}))

    ensured_periods = []

    for group_name in center_groups:
        # Find the GH for this group (if any) or fallback to created_by (e.g. CH)
        gh_user = (
            db.query(models.User)
            .filter(
                models.User.center == center,
                models.User.group == group_name,
                models.User.role.ilike("gh")
            )
            .first()
        )
        creator_id = gh_user.id if gh_user else created_by

        current_p = ensure_all_periods_for_group(group_name, creator_id, db)
        if current_p:
            ensured_periods.append(current_p)

    return ensured_periods


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