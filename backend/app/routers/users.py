from typing import List, Optional
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

    data = payload.model_dump(exclude_unset=True)
    # Handle group_name alias if provided
    if "group_name" in data:
        if "group" not in data or not data["group"]:
            data["group"] = data.pop("group_name")
        else:
            data.pop("group_name")

    user = models.User(**data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=List[schemas.UserRead])
def list_users(
    group: Optional[str] = None,
    group_name: Optional[str] = None,
    role: Optional[str] = None,
    center: Optional[str] = None,
    type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.User)
    target_group = group or group_name
    if target_group is not None:
        query = query.filter(models.User.group == target_group)
    if role is not None:
        query = query.filter(models.User.role == role)
    if center is not None:
        query = query.filter(models.User.center == center)
    if type is not None:
        query = query.filter(models.User.type == type)

    return query.order_by(models.User.id.asc()).all()


@router.get("/{user_id}", response_model=schemas.UserRead)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=schemas.UserRead)
def update_user(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"] != user.email:
        conflict = db.query(models.User).filter(models.User.email == update_data["email"]).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Email already in use by another account")

    # Handle group_name alias if provided
    if "group_name" in update_data:
        if "group" not in update_data or not update_data["group"]:
            update_data["group"] = update_data.pop("group_name")
        else:
            update_data.pop("group_name")

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"detail": "User deleted successfully"}