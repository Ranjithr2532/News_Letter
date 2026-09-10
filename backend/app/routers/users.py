from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.post("/login", response_model=schemas.UserRead)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or user.password != payload.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return user


@router.post("/", response_model=schemas.UserRead)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    data = payload.model_dump()
    group_val = data.get("group") or data.get("group_name")
    data["group"] = group_val
    if "group_name" in data:
        del data["group_name"]

    user = models.User(**data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user