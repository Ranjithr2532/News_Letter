from pydantic import BaseModel, EmailStr
from datetime import date, datetime
from typing import Optional, List


# ---------- User ----------
class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: int
    name: str
    email: str
    designation: Optional[str] = None
    role: Optional[str] = None
    center: Optional[str] = None
    group: Optional[str] = None
    group_name: Optional[str] = None
    type: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Category ----------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    designation: Optional[str] = None
    role: Optional[str] = None
    center: Optional[str] = None
    group: Optional[str] = None
    group_name: Optional[str] = None
    type: Optional[str] = None


class CategoryCreate(BaseModel):
    name: str
    stage_number: int = 0
    period_id: Optional[int] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    stage_number: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryRead(BaseModel):
    id: int
    name: str
    stage_number: int
    is_active: bool
    period_id: Optional[int] = None

    class Config:
        from_attributes = True


# ---------- Newsletter Period ----------
class PeriodCreate(BaseModel):
    title: str
    start_date: date
    end_date: date
    created_by: int   # user id — sent from frontend since no JWT yet
    group_name: str    # sent from frontend (from logged-in user object) since no JWT yet


class PeriodRead(BaseModel):
    id: int
    group_name: str
    title: str
    start_date: date
    end_date: date
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Entry Photo ----------
class PhotoRead(BaseModel):
    id: int
    entry_id: int
    file_path: str
    original_filename: Optional[str] = None
    uploaded_by: int
    display_order: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ---------- Newsletter Entry ----------
class EntryCreate(BaseModel):
    period_id: int
    group_name: str
    category_id: int
    title: str
    description: Optional[str] = None
    display_order: int = 0
    created_by: int


class EntryUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    updated_by: int   # required — who is making this edit


class EntryRead(BaseModel):
    id: int
    period_id: int
    group_name: str
    category_id: int
    title: str
    description: Optional[str] = None
    display_order: int
    created_by: int
    updated_by: int
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    photos: List[PhotoRead] = []

    class Config:
        from_attributes = True


# ---------- Entry Edit History ----------
class HistoryRead(BaseModel):
    id: int
    entry_id: int
    edited_by: int
    old_title: Optional[str] = None
    old_description: Optional[str] = None
    edited_at: datetime

    class Config:
        from_attributes = True