import os
import shutil
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D_DRIVE_DIR = r"D:\Newsletter_Uploads"
if os.path.exists(D_DRIVE_DIR):
    UPLOAD_DIR = D_DRIVE_DIR
else:
    UPLOAD_DIR = os.path.join(os.path.dirname(BASE_DIR), "uploads")

os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB


def validate_image_file(file: UploadFile):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext == ".pdf":
        raise HTTPException(
            status_code=400,
            detail="PDF upload is not supported. Please upload an image file (JPG, PNG, WebP)."
        )
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats are JPG, PNG, and WebP."
        )
    if hasattr(file, "size") and file.size and file.size > MAX_FILE_SIZE:
        size_mb = round(file.size / (1024 * 1024), 1)
        raise HTTPException(
            status_code=400,
            detail=f"File '{file.filename}' is {size_mb} MB. Maximum allowed image size is 15 MB."
        )


def process_and_create_photos(
    file: UploadFile,
    entry_id: int,
    uploaded_by: int,
    timestamp_prefix: int,
    file_idx: int = 0,
    current_display_order: int = 0,
) -> List[models.EntryPhoto]:
    """
    Saves uploaded image file and returns a list containing the EntryPhoto instance.
    """
    filename_clean = (file.filename or "photo.png").replace(" ", "_")
    idx_str = f"_{file_idx}"
    unique_filename = f"{entry_id}_{timestamp_prefix}{idx_str}_{filename_clean}"
    disk_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(disk_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Check written file size against 15 MB limit
    written_size = os.path.getsize(disk_path)
    if written_size > MAX_FILE_SIZE:
        try:
            os.remove(disk_path)
        except Exception:
            pass
        size_mb = round(written_size / (1024 * 1024), 1)
        raise HTTPException(
            status_code=400,
            detail=f"File '{file.filename}' is {size_mb} MB. Maximum allowed image size is 15 MB."
        )

    web_file_path = f"uploads/{unique_filename}"
    photo = models.EntryPhoto(
        entry_id=entry_id,
        file_path=web_file_path,
        original_filename=file.filename,
        uploaded_by=uploaded_by,
        display_order=current_display_order,
    )
    return [photo]


@router.post("/", response_model=schemas.PhotoRead)
def upload_photo(
    entry_id: int = Form(...),
    uploaded_by: int = Form(...),
    display_order: int = Form(0),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    validate_image_file(file)

    entry = db.query(models.NewsletterEntry).filter(models.NewsletterEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    timestamp_prefix = int(datetime.now(timezone.utc).timestamp() * 1000)
    photos = process_and_create_photos(file, entry_id, uploaded_by, timestamp_prefix, 0, display_order)
    for p in photos:
        db.add(p)

    # Update parent entry's audit metadata
    entry.updated_by = uploaded_by
    entry.updated_at = datetime.now(timezone.utc)

    db.commit()
    for p in photos:
        db.refresh(p)

    return photos[0]


@router.post("/batch", response_model=List[schemas.PhotoRead])
def upload_photos_batch(
    entry_id: int = Form(...),
    uploaded_by: int = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    for f in files:
        validate_image_file(f)

    entry = db.query(models.NewsletterEntry).filter(models.NewsletterEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if entry.period and entry.period.edit is False:
        raise HTTPException(status_code=400, detail="This newsletter period has been finalized and is read-only.")

    existing_count = db.query(models.EntryPhoto).filter(models.EntryPhoto.entry_id == entry_id).count()

    created_photos = []
    timestamp_prefix = int(datetime.now(timezone.utc).timestamp() * 1000)

    for idx, file in enumerate(files):
        file_photos = process_and_create_photos(
            file,
            entry_id,
            uploaded_by,
            timestamp_prefix,
            idx,
            existing_count + len(created_photos),
        )
        for p in file_photos:
            db.add(p)
            created_photos.append(p)

    entry.updated_by = uploaded_by
    entry.updated_at = datetime.now(timezone.utc)

    db.commit()
    for photo in created_photos:
        db.refresh(photo)

    return created_photos


@router.delete("/{photo_id}")
def delete_photo(photo_id: int, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    photo = db.query(models.EntryPhoto).filter(models.EntryPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    entry = photo.entry
    if entry:
        if entry.period and entry.period.edit is False:
            raise HTTPException(status_code=400, detail="This newsletter period has been finalized and is read-only.")
        if user_id:
            entry.updated_by = user_id
        entry.updated_at = datetime.now(timezone.utc)

    if photo.file_path:
        norm_path = photo.file_path.replace("/", os.sep).replace("\\", os.sep)
        if os.path.exists(norm_path):
            try:
                os.remove(norm_path)
            except Exception as e:
                print(f"Failed to delete file {norm_path}: {e}")

    db.delete(photo)
    db.commit()
    return {"detail": "Photo deleted"}