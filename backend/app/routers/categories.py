from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=List[schemas.CategoryRead])
def list_categories(db: Session = Depends(get_db)):
    return (
        db.query(models.CategoryStage)
        .filter(models.CategoryStage.is_active == True)
        .order_by(models.CategoryStage.stage_number.asc())
        .all()
    )


@router.post("/", response_model=schemas.CategoryRead)
def create_category(payload: schemas.CategoryCreate, db: Session = Depends(get_db)):
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