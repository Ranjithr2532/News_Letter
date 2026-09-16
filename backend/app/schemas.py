from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import date, datetime
from typing import Optional, List


# ---------- User ----------
class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    designation: Optional[str] = None
    role: Optional[str] = None
    center: Optional[str] = None
    group: Optional[str] = None
    type: Optional[str] = None


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    designation: Optional[str] = None
    role: Optional[str] = None
    center: Optional[str] = None
    group: Optional[str] = None
    password: str
    type: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    designation: Optional[str] = None
    role: Optional[str] = None
    center: Optional[str] = None
    group: Optional[str] = None
    password: Optional[str] = None
    type: Optional[str] = None


# ---------- Category ----------
class CategoryCreate(BaseModel):
    name: str
    stage_number: int = 0
    period_id: Optional[int] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    stage_number: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    stage_number: int
    is_active: bool
    period_id: Optional[int] = None


# ---------- Newsletter Period ----------
class PeriodCreate(BaseModel):
    title: str
    start_date: date
    end_date: date
    created_by: Optional[int] = None
    group_name: str
    edit: Optional[bool] = True


class PeriodUpdate(BaseModel):
    title: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    edit: Optional[bool] = None


class PeriodRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_name: str
    title: str
    start_date: date
    end_date: date
    created_by: int
    created_at: datetime
    edit: Optional[bool] = True
    creator_name: Optional[str] = None
    center: Optional[str] = None


# ---------- Entry Photo ----------
class PhotoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entry_id: int
    file_path: str
    original_filename: Optional[str] = None
    uploaded_by: int
    display_order: int
    uploaded_at: datetime


# ---------- Newsletter Entry ----------
class EntryCreate(BaseModel):
    period_id: int
    group_name: Optional[str] = None
    category_id: int
    title: str
    description: Optional[str] = None
    display_order: int = 0
    created_by: int


class EntryUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    updated_by: int


class EntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period_id: int
    group_name: str
    category_id: int
    title: str
    description: Optional[str] = None
    display_order: int
    created_by: int
    created_by_name: Optional[str] = None
    updated_by: int
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    photos: List[PhotoRead] = []


# ---------- Entry Edit History ----------
class HistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entry_id: int
    edited_by: int
    old_title: Optional[str] = None
    old_description: Optional[str] = None
    edited_at: datetime


# ---------- Notification ----------
class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    period_id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime


class NotificationUpdate(BaseModel):
    is_read: bool