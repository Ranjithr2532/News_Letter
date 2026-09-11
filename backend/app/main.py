import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base
from app import models
from app.routers import users, periods, categories, entries, photos, notifications

# Creates all tables in Postgres if they don't already exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Newsletter Builder API")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Primary shared folder on D: drive for cross-system photo access, fallback to local uploads directory
D_DRIVE_DIR = r"D:\Newsletter_Uploads"
if os.path.exists(D_DRIVE_DIR):
    UPLOAD_DIR = D_DRIVE_DIR
else:
    UPLOAD_DIR = os.path.join(os.path.dirname(BASE_DIR), "uploads")

os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows local host and LAN IP access
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