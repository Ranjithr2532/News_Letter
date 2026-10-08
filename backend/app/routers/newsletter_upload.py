import os
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.services import minio_service
from app.routers.periods import sanitize_header_filename

router = APIRouter()


@router.post("/", response_model=schemas.NewsletterUploadRead)
def upload_published_newsletter(
    start_date: date = Form(...),
    end_date: date = Form(...),
    uploaded_by: int = Form(...),
    title: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Allows an Editor or Admin to upload or replace the official published PDF newsletter for a cycle date range.
    The upload is linked by start_date and end_date so all departments in this cycle see it.
    The file is stored in-memory directly to MinIO Object Storage.
    """
    user = db.query(models.User).filter(models.User.id == uploaded_by).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_role = (user.role or "").strip().lower()
    if user_role not in ("edit", "editor", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Permission denied. Only an Editor can upload the published newsletter PDF."
        )

    # Validate file extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext != ".pdf":
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file format '{ext}'. Only PDF documents (.pdf) can be uploaded as published newsletters."
        )

    file_bytes = file.file.read()
    max_size = 50 * 1024 * 1024  # 50 MB
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=400,
            detail="PDF file is too large. Maximum allowed size is 50 MB."
        )

    # Check if a published PDF already exists for this exact cycle (start_date to end_date)
    existing_upload = (
        db.query(models.NewsletterUpload)
        .filter(
            models.NewsletterUpload.start_date == start_date,
            models.NewsletterUpload.end_date == end_date,
        )
        .first()
    )

    if existing_upload and existing_upload.file_url:
        try:
            minio_service.delete_file(existing_upload.file_url)
        except Exception as e:
            print(f"[MinIO] Warning: Failed to delete previous PDF: {e}")

    timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
    raw_name = os.path.splitext(file.filename or "newsletter")[0]
    clean_name = sanitize_header_filename(raw_name) + ".pdf"
    object_name = f"published_pdfs/{start_date}_{end_date}_{timestamp}_{clean_name}"

    uploaded = minio_service.upload_file_bytes(object_name, file_bytes, "application/pdf")
    if not uploaded:
        raise HTTPException(
            status_code=500,
            detail="Failed to upload PDF to MinIO storage. Please check MinIO service status."
        )

    file_url = minio_service.get_minio_url(object_name)
    pub_title = title.strip() if title and title.strip() else f"CMTI Newsletter ({start_date} to {end_date})"

    if existing_upload:
        existing_upload.title = pub_title
        existing_upload.file_url = file_url
        existing_upload.file_name = file.filename or clean_name
        existing_upload.uploaded_by = uploaded_by
        existing_upload.uploaded_at = datetime.now(timezone.utc)
        upload_record = existing_upload
    else:
        upload_record = models.NewsletterUpload(
            title=pub_title,
            start_date=start_date,
            end_date=end_date,
            file_url=file_url,
            file_name=file.filename or clean_name,
            uploaded_by=uploaded_by,
            uploaded_at=datetime.now(timezone.utc),
        )
        db.add(upload_record)

    db.commit()
    db.refresh(upload_record)
    return upload_record


@router.get("/by-date", response_model=schemas.NewsletterUploadRead)
def get_published_pdf_by_date(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
):
    """
    Returns the published PDF newsletter metadata matching a specific start_date and end_date.
    """
    upload = (
        db.query(models.NewsletterUpload)
        .filter(
            models.NewsletterUpload.start_date == start_date,
            models.NewsletterUpload.end_date == end_date,
        )
        .first()
    )
    if not upload:
        raise HTTPException(status_code=404, detail="No published PDF found for this date range.")
    return upload


@router.get("/{id}", response_model=schemas.NewsletterUploadRead)
def get_published_pdf_by_id(
    id: int,
    db: Session = Depends(get_db),
):
    """
    Returns the published PDF newsletter metadata by its unique ID.
    """
    upload = db.query(models.NewsletterUpload).filter(models.NewsletterUpload.id == id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Published newsletter not found.")
    return upload


@router.delete("/{id}")
def delete_published_pdf(
    id: int,
    user_id: int,
    db: Session = Depends(get_db),
):
    """
    Allows an Editor or Admin to delete a published PDF newsletter by ID.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_role = (user.role or "").strip().lower()
    if user_role not in ("edit", "editor", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Permission denied. Only an Editor can delete the published newsletter PDF."
        )

    upload = db.query(models.NewsletterUpload).filter(models.NewsletterUpload.id == id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Published newsletter not found.")

    if upload.file_url:
        try:
            minio_service.delete_file(upload.file_url)
        except Exception as e:
            print(f"[MinIO] Warning: Failed to delete PDF from storage: {e}")

    db.delete(upload)
    db.commit()
    return {"detail": "Published PDF deleted successfully", "id": id}


@router.get("/", response_model=List[schemas.NewsletterUploadRead])
def list_all_published_newsletters(
    db: Session = Depends(get_db),
):
    """
    Lists all published newsletter PDFs across all publication cycles ordered chronologically.
    """
    return db.query(models.NewsletterUpload).order_by(models.NewsletterUpload.start_date.desc()).all()
