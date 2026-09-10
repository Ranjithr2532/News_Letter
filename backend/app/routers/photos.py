import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


from datetime import datetime
from typing import Optional

@router.post("/", response_model=schemas.PhotoRead)
def upload_photo(
    entry_id: int = Form(...),
    uploaded_by: int = Form(...),
    display_order: int = Form(0),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    entry = db.query(models.NewsletterEntry).filter(models.NewsletterEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    file_path = os.path.join(UPLOAD_DIR, f"{entry_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    photo = models.EntryPhoto(
        entry_id=entry_id,
        file_path=file_path,
        original_filename=file.filename,
        uploaded_by=uploaded_by,
        display_order=display_order,
    )
    db.add(photo)

    # Update parent entry's audit metadata
    entry.updated_by = uploaded_by
    entry.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(photo)
@router.post("/batch", response_model=list[schemas.PhotoRead])
def upload_photos_batch(
    entry_id: int = Form(...),
    uploaded_by: int = Form(...),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    entry = db.query(models.NewsletterEntry).filter(models.NewsletterEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    existing_count = db.query(models.EntryPhoto).filter(models.EntryPhoto.entry_id == entry_id).count()

    created_photos = []
    timestamp_prefix = int(datetime.utcnow().timestamp() * 1000)

    for idx, file in enumerate(files):
        unique_filename = f"{entry_id}_{timestamp_prefix}_{idx}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        photo = models.EntryPhoto(
            entry_id=entry_id,
            file_path=file_path,
            original_filename=file.filename,
            uploaded_by=uploaded_by,
            display_order=existing_count + idx,
        )
        db.add(photo)
        created_photos.append(photo)

    entry.updated_by = uploaded_by
    entry.updated_at = datetime.utcnow()

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
        if user_id:
            entry.updated_by = user_id
        entry.updated_at = datetime.utcnow()

    if os.path.exists(photo.file_path):
        os.remove(photo.file_path)

    db.delete(photo)
    db.commit()
    return {"detail": "Photo deleted"}