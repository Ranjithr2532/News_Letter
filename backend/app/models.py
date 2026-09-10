from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    designation = Column(String, nullable=True)
    role = Column(String, nullable=True)
    center = Column(String, nullable=True)
    group = Column(String, nullable=True)
    password = Column(String, nullable=False)
    type = Column(String, nullable=True)


class CategoryStage(Base):
    __tablename__ = "category_stage"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    stage_number = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, default=True)
    period_id = Column(Integer, ForeignKey("newsletter_periods.id", ondelete="CASCADE"), nullable=True)

    entries = relationship("NewsletterEntry", back_populates="category")
    period = relationship("NewsletterPeriod", backref="custom_categories")


class NewsletterPeriod(Base):
    __tablename__ = "newsletter_periods"

    id = Column(Integer, primary_key=True, index=True)
    group_name = Column(String(100), nullable=False, index=True)
    title = Column(Text, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    entries = relationship("NewsletterEntry", back_populates="period", cascade="all, delete-orphan")


class NewsletterEntry(Base):
    __tablename__ = "newsletter_entries"

    id = Column(Integer, primary_key=True, index=True)
    period_id = Column(Integer, ForeignKey("newsletter_periods.id"), nullable=False)
    group_name = Column(String(100), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("category_stage.id"), nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text)
    display_order = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    period = relationship("NewsletterPeriod", back_populates="entries")
    category = relationship("CategoryStage", back_populates="entries")
    photos = relationship("EntryPhoto", back_populates="entry", cascade="all, delete-orphan")
    history = relationship("EntryEditHistory", back_populates="entry", cascade="all, delete-orphan")
    updater = relationship("User", foreign_keys=[updated_by])

    @property
    def updated_by_name(self) -> str:
        return self.updater.name if self.updater else f"User #{self.updated_by}"


class EntryPhoto(Base):
    __tablename__ = "entry_photos"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("newsletter_entries.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255))
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    display_order = Column(Integer, default=0)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    entry = relationship("NewsletterEntry", back_populates="photos")


class EntryEditHistory(Base):
    __tablename__ = "entry_edit_history"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("newsletter_entries.id", ondelete="CASCADE"), nullable=False)
    edited_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    old_title = Column(Text)
    old_description = Column(Text)
    edited_at = Column(DateTime(timezone=True), server_default=func.now())

    entry = relationship("NewsletterEntry", back_populates="history")