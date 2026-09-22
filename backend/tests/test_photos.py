import io
from datetime import date
import pytest
from app import models
from PIL import Image


def _create_sample_image_bytes(color="blue", size=(200, 200), fmt="PNG") -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_upload_single_photo(client, db_session, test_user):
    period = models.NewsletterPeriod(
        title="Q1 2026",
        group_name="SMC",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        created_by=test_user.id
    )
    db_session.add(period)
    db_session.commit()

    cat = models.CategoryStage(name="Tech Updates", stage_number=1)
    db_session.add(cat)
    db_session.commit()

    entry = models.NewsletterEntry(
        period_id=period.id,
        category_id=cat.id,
        group_name="SMC",
        title="Feature Launch",
        created_by=test_user.id,
        updated_by=test_user.id
    )
    db_session.add(entry)
    db_session.commit()

    img_bytes = _create_sample_image_bytes("green")

    response = client.post(
        "/photos/",
        data={"entry_id": entry.id, "uploaded_by": test_user.id, "display_order": 0},
        files={"file": ("launch_event.png", io.BytesIO(img_bytes), "image/png")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["entry_id"] == entry.id
    assert "launch_event.png" in data["original_filename"]


def test_upload_batch_photos(client, db_session, test_user):
    period = models.NewsletterPeriod(
        title="Q1 2026",
        group_name="SMC",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        created_by=test_user.id
    )
    db_session.add(period)
    db_session.commit()

    cat = models.CategoryStage(name="Events", stage_number=1)
    db_session.add(cat)
    db_session.commit()

    entry = models.NewsletterEntry(
        period_id=period.id,
        category_id=cat.id,
        group_name="SMC",
        title="Annual Meet",
        created_by=test_user.id,
        updated_by=test_user.id
    )
    db_session.add(entry)
    db_session.commit()

    img1 = _create_sample_image_bytes("red")
    img2 = _create_sample_image_bytes("blue")

    response = client.post(
        "/photos/batch",
        data={"entry_id": entry.id, "uploaded_by": test_user.id},
        files=[
            ("files", ("photo1.png", io.BytesIO(img1), "image/png")),
            ("files", ("photo2.jpg", io.BytesIO(img2), "image/jpeg")),
        ]
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert "photo1.png" in data[0]["original_filename"]
    assert "photo2.jpg" in data[1]["original_filename"]


def test_reject_pdf_upload(client, db_session, test_user):
    period = models.NewsletterPeriod(
        title="Q1 2026",
        group_name="SMC",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        created_by=test_user.id
    )
    db_session.add(period)
    db_session.commit()

    cat = models.CategoryStage(name="Reports", stage_number=1)
    db_session.add(cat)
    db_session.commit()

    entry = models.NewsletterEntry(
        period_id=period.id,
        category_id=cat.id,
        group_name="SMC",
        title="Quarterly PDF",
        created_by=test_user.id,
        updated_by=test_user.id
    )
    db_session.add(entry)
    db_session.commit()

    pdf_bytes = b"%PDF-1.4 dummy pdf content"

    response = client.post(
        "/photos/batch",
        data={"entry_id": entry.id, "uploaded_by": test_user.id},
        files=[("files", ("report.pdf", io.BytesIO(pdf_bytes), "application/pdf"))]
    )
    assert response.status_code == 400
    assert "PDF upload is not supported" in response.json()["detail"]


def test_upload_file_exceeds_15mb(client, db_session, test_user):
    period = models.NewsletterPeriod(
        title="Q1 2026",
        group_name="SMC",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        created_by=test_user.id
    )
    db_session.add(period)
    db_session.commit()

    cat = models.CategoryStage(name="Tech", stage_number=1)
    db_session.add(cat)
    db_session.commit()

    entry = models.NewsletterEntry(
        period_id=period.id,
        category_id=cat.id,
        group_name="SMC",
        title="Large File",
        created_by=test_user.id,
        updated_by=test_user.id
    )
    db_session.add(entry)
    db_session.commit()

    # 15.5 MB payload
    large_bytes = b"0" * (int(15.5 * 1024 * 1024))
    response = client.post(
        "/photos/batch",
        data={"entry_id": entry.id, "uploaded_by": test_user.id},
        files=[("files", ("too_large.png", io.BytesIO(large_bytes), "image/png"))]
    )
    assert response.status_code == 400
    assert "Maximum allowed image size is 15 MB" in response.json()["detail"]


def test_delete_photo(client, db_session, test_user):
    period = models.NewsletterPeriod(
        title="Q1 2026",
        group_name="SMC",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        created_by=test_user.id
    )
    db_session.add(period)
    db_session.commit()

    cat = models.CategoryStage(name="Gallery", stage_number=1)
    db_session.add(cat)
    db_session.commit()

    entry = models.NewsletterEntry(
        period_id=period.id,
        category_id=cat.id,
        group_name="SMC",
        title="Photo Entry",
        created_by=test_user.id,
        updated_by=test_user.id
    )
    db_session.add(entry)
    db_session.commit()

    photo = models.EntryPhoto(
        entry_id=entry.id,
        file_path="uploads/test_sample_photo.png",
        original_filename="sample.png",
        uploaded_by=test_user.id,
        display_order=0
    )
    db_session.add(photo)
    db_session.commit()
    db_session.refresh(photo)

    del_res = client.delete(f"/photos/{photo.id}?user_id={test_user.id}")
    assert del_res.status_code == 200
    assert del_res.json()["detail"] == "Photo deleted"
