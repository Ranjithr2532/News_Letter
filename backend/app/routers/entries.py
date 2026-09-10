from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.post("/", response_model=schemas.EntryRead)
def create_entry(payload: schemas.EntryCreate, db: Session = Depends(get_db)):
    period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == payload.period_id).first()
    if period and period.edit is False:
        raise HTTPException(status_code=400, detail="This newsletter period has been finalized and is read-only.")

    entry = models.NewsletterEntry(
        **payload.model_dump(),
        updated_by=payload.created_by,  # on creation, updated_by = same as created_by
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/", response_model=List[schemas.EntryRead])
def list_entries(
    period_id: int,
    category_id: Optional[int] = None,
    created_by: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.NewsletterEntry).filter(models.NewsletterEntry.period_id == period_id)
    if category_id is not None:
        query = query.filter(models.NewsletterEntry.category_id == category_id)
    if created_by is not None:
        query = query.filter(models.NewsletterEntry.created_by == created_by)
    return query.order_by(models.NewsletterEntry.display_order.asc(), models.NewsletterEntry.id.asc()).all()


@router.get("/{entry_id}", response_model=schemas.EntryRead)
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.NewsletterEntry).filter(models.NewsletterEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.put("/{entry_id}", response_model=schemas.EntryRead)
def update_entry(entry_id: int, payload: schemas.EntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(models.NewsletterEntry).filter(models.NewsletterEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if entry.period and entry.period.edit is False:
        raise HTTPException(status_code=400, detail="This newsletter period has been finalized and is read-only.")

    # Save the OLD values into history before overwriting
    history = models.EntryEditHistory(
        entry_id=entry.id,
        edited_by=payload.updated_by,
        old_title=entry.title,
        old_description=entry.description,
    )
    db.add(history)

    # Now update the entry in place
    update_data = payload.model_dump(exclude_unset=True, exclude={"updated_by"})
    for key, value in update_data.items():
        setattr(entry, key, value)
    entry.updated_by = payload.updated_by

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.NewsletterEntry).filter(models.NewsletterEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if entry.period and entry.period.edit is False:
        raise HTTPException(status_code=400, detail="This newsletter period has been finalized and is read-only.")

    db.delete(entry)
    db.commit()
    return {"detail": "Entry deleted"}


@router.get("/{entry_id}/history", response_model=List[schemas.HistoryRead])
def get_entry_history(entry_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.EntryEditHistory)
        .filter(models.EntryEditHistory.entry_id == entry_id)
        .order_by(models.EntryEditHistory.edited_at.desc())
        .all()
    )
