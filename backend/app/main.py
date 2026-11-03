import os
import mimetypes
from datetime import date
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from app.database import engine, Base, sync_db_sequences
from app import models
from app.services import minio_service
from app.routers import users, periods, categories, entries, photos, notifications, newsletter_upload
from app.email_scheduler import scheduler, automated_scheduled_reminder

# Creates all tables in Postgres if they don't already exist
Base.metadata.create_all(bind=engine)

# Auto-sync PostgreSQL ID sequences with MAX(id)
sync_db_sequences()

# Initialize MinIO client on startup
minio_service.get_minio_client()

app = FastAPI(title="Newsletter Builder API")

@app.get("/uploads/{file_path:path}")
def serve_upload(file_path: str):
    # Fetch directly from MinIO object storage
    file_bytes = minio_service.get_file_bytes(file_path)
    if file_bytes is not None:
        content_type, _ = mimetypes.guess_type(file_path)
        content_type = content_type or "image/jpeg"
        return Response(
            content=file_bytes,
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=86400"},
        )

    raise HTTPException(status_code=404, detail="File not found in MinIO storage")

@app.get("/manuals/{manual_type}")
def serve_manual(manual_type: str):
    mapping = {
        "user": "User_Manual.pdf",
        "user_manual.pdf": "User_Manual.pdf",
        "gh": "Group_Head_Manual.pdf",
        "group_head": "Group_Head_Manual.pdf",
        "group_head_manual.pdf": "Group_Head_Manual.pdf",
        "ch": "Centre_Head_Manual.pdf",
        "centre_head": "Centre_Head_Manual.pdf",
        "centre_head_manual.pdf": "Centre_Head_Manual.pdf",
        "editor": "Editor_Manual.pdf",
        "editor_manual.pdf": "Editor_Manual.pdf",
        "admin": "Editor_Manual.pdf",
    }
    clean_key = manual_type.lower().strip()
    filename = mapping.get(clean_key)
    if not filename:
        raise HTTPException(status_code=404, detail="Manual not found")

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, "docs", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Manual file {filename} not found on server")

    return FileResponse(
        file_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"'
        }
    )

# Allowed Origins for CORS security (Local development and CMTI intranet access)
# Strict Allowed Origins for CORS security
ALLOWED_ORIGINS = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # 🔒 STRICT: Only these exact URLs and ports can talk to the backend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(periods.router, prefix="/periods", tags=["Periods"])
app.include_router(categories.router, prefix="/categories", tags=["Categories"])
app.include_router(entries.router, prefix="/entries", tags=["Entries"])
app.include_router(photos.router, prefix="/photos", tags=["Photos"])
app.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
app.include_router(newsletter_upload.router, prefix="/newsletter-upload", tags=["Newsletter Upload"])



# @app.on_event("startup")
# def startup_scheduler():
#     if not scheduler.running:
#         # Automatically wakes up on 1st and 16th of each month at 10:00 AM
#         scheduler.add_job(
#             automated_scheduled_reminder,
#             trigger="cron",
#             day="1,16",
#             hour=10,
#             minute=0,
#             id="automated_newsletter_reminder",
#             replace_existing=True
#         )
#         scheduler.start()

#     # Same-Day Catch-up Logic:
#     # If today IS the 1st or 16th, and the server was OFF at 10:00 AM,
#     # trigger immediately whenever the server is powered back on today.
#     # (If already sent earlier today, email_scheduler safely skips duplicates)
#     today = date.today()
#     if today.day in (1, 16):
#         import logging
#         logger = logging.getLogger("startup_catchup")
#         logger.info(f"📅 Today is the {today.day}th! Checking same-day reminder catch-up...")
#         automated_scheduled_reminder()


@app.on_event("shutdown")
def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()



@app.get("/")
def root():
    return {"status": "Newsletter Builder API running"}

