import os
import mimetypes
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from app.database import engine, Base, sync_db_sequences
from app import models
from app.services import minio_service
from app.routers import users, periods, categories, entries, photos, notifications

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

    raise HTTPException(status_code=404, detail="File not found")

# Allowed Origins for CORS security (Local development and CMTI intranet access)
# Strict Allowed Origins for CORS security
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://172.18.100.55:5173",
    "http://172.18.100.55:3000",
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


@app.get("/")
def root():
    return {"status": "Newsletter Builder API running"}
