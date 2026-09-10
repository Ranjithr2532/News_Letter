from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=List[schemas.CategoryRead])
def list_categories(period_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.CategoryStage).filter(models.CategoryStage.is_active == True)
    if period_id is not None:
        query = query.filter(
            (models.CategoryStage.period_id == None) | (models.CategoryStage.period_id == period_id)
        )
    else:
        query = query.filter(models.CategoryStage.period_id == None)

    return query.order_by(models.CategoryStage.stage_number.asc(), models.CategoryStage.id.asc()).all()


@router.post("/", response_model=schemas.CategoryRead)
def create_category(payload: schemas.CategoryCreate, db: Session = Depends(get_db)):
    if payload.period_id:
        period = db.query(models.NewsletterPeriod).filter(models.NewsletterPeriod.id == payload.period_id).first()
        if period and period.edit is False:
            raise HTTPException(status_code=400, detail="This newsletter period has been finalized and is read-only.")

    category = models.CategoryStage(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/{category_id}", response_model=schemas.CategoryRead)
def update_category(category_id: int, payload: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    category = db.query(models.CategoryStage).filter(models.CategoryStage.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(models.CategoryStage).filter(models.CategoryStage.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
    return {"detail": "Category deleted"}