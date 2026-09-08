import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


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
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/{photo_id}")
def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(models.EntryPhoto).filter(models.EntryPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if os.path.exists(photo.file_path):
        os.remove(photo.file_path)

    db.delete(photo)
    db.commit()
    return {"detail": "Photo deleted"}