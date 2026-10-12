from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=List[schemas.CategoryRead])
def list_categories(
    period_id: Optional[str] = None,
    group_name: Optional[str] = None,
    center: Optional[str] = None,
    year: Optional[int] = None,
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    month: Optional[int] = None,
    has_entries: Optional[bool] = False,
    include_custom: Optional[bool] = False,
    db: Session = Depends(get_db),
):
    # 1. If explicit period_id list is provided (e.g. from Categories.jsx)
    if period_id is not None:
        p_ids = [int(p.strip()) for p in str(period_id).split(",") if p.strip().isdigit()]
        if p_ids:
            query = db.query(models.CategoryStage).filter(
                models.CategoryStage.is_active == True,
                (models.CategoryStage.period_id == None) | (models.CategoryStage.period_id.in_(p_ids)),
            )
        else:
            query = db.query(models.CategoryStage).filter(
                models.CategoryStage.is_active == True,
                models.CategoryStage.period_id == None,
            )
        return query.order_by(models.CategoryStage.stage_number.asc(), models.CategoryStage.id.asc()).all()

    # 2. Scoped by Department, Center, or All Custom (e.g. from Periods.jsx filter toolbar)
    clean_group = group_name.strip() if group_name and group_name.strip().lower() not in ("all", "undefined", "null", "") else None
    clean_center = center.strip() if center and center.strip().lower() not in ("all", "undefined", "null", "") else None

    if clean_group or clean_center or include_custom or year or from_year:
        standard_cats = (
            db.query(models.CategoryStage)
            .filter(models.CategoryStage.is_active == True, models.CategoryStage.period_id == None)
            .order_by(models.CategoryStage.stage_number.asc(), models.CategoryStage.id.asc())
            .all()
        )

        custom_query = (
            db.query(models.CategoryStage)
            .join(models.NewsletterPeriod, models.CategoryStage.period_id == models.NewsletterPeriod.id)
            .join(models.User, models.NewsletterPeriod.created_by == models.User.id)
            .filter(models.CategoryStage.is_active == True, models.CategoryStage.period_id != None)
        )
        if clean_group:
            custom_query = custom_query.filter(models.NewsletterPeriod.group_name == clean_group)
        if clean_center:
            custom_query = custom_query.filter(models.User.center == clean_center)

        if has_entries:
            entry_subquery = (
                db.query(models.NewsletterEntry.category_id)
                .join(models.NewsletterPeriod, models.NewsletterEntry.period_id == models.NewsletterPeriod.id)
                .join(models.User, models.NewsletterPeriod.created_by == models.User.id)
            )
            if clean_group:
                entry_subquery = entry_subquery.filter(models.NewsletterPeriod.group_name == clean_group)
            if clean_center:
                entry_subquery = entry_subquery.filter(models.User.center == clean_center)
            if from_year is not None and to_year is not None:
                min_y = min(from_year, to_year)
                max_y = max(from_year, to_year)
                entry_subquery = entry_subquery.filter(
                    extract('year', models.NewsletterPeriod.start_date) >= min_y,
                    extract('year', models.NewsletterPeriod.start_date) <= max_y,
                )
            elif year:
                entry_subquery = entry_subquery.filter(extract('year', models.NewsletterPeriod.start_date) == year)
            if month:
                entry_subquery = entry_subquery.filter(extract('month', models.NewsletterPeriod.start_date) == month)

            active_cat_ids = {row[0] for row in entry_subquery.distinct().all()}
            custom_query = custom_query.filter(models.CategoryStage.id.in_(active_cat_ids))

        custom_cats_raw = custom_query.order_by(models.CategoryStage.name.asc(), models.CategoryStage.id.asc()).all()

        seen = set()
        deduped_custom = []
        std_names = {s.name.strip().lower() for s in standard_cats}
        for c in custom_cats_raw:
            key = c.name.strip().lower()
            if key and key not in std_names and key not in seen:
                seen.add(key)
                deduped_custom.append(c)

        return standard_cats + deduped_custom

    # 3. Default fallback: only global standard categories
    return (
        db.query(models.CategoryStage)
        .filter(models.CategoryStage.is_active == True, models.CategoryStage.period_id == None)
        .order_by(models.CategoryStage.stage_number.asc(), models.CategoryStage.id.asc())
        .all()
    )


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