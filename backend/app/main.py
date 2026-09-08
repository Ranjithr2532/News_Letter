from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app import models
from app.routers import users, periods, categories, entries, photos

from fastapi.staticfiles import StaticFiles

# Creates all tables in Postgres if they don't already exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Newsletter Builder API")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(periods.router, prefix="/periods", tags=["Periods"])
app.include_router(categories.router, prefix="/categories", tags=["Categories"])
app.include_router(entries.router, prefix="/entries", tags=["Entries"])
app.include_router(photos.router, prefix="/photos", tags=["Photos"])


@app.get("/")
def root():
    return {"status": "Newsletter Builder API running"}