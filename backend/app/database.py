from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def sync_db_sequences():
    """
    Synchronizes PostgreSQL auto-incrementing primary key sequences with the current MAX(id).
    Prevents 'Key (id)=(X) already exists' UniqueViolation errors after seeding or data import.
    Safely ignores non-Postgres databases (like SQLite in tests).
    """
    if "postgres" not in str(engine.url):
        return

    tables = [
        "users",
        "category_stage",
        "newsletter_periods",
        "newsletter_entries",
        "entry_photos",
        "entry_edit_history",
        "notifications",
        "otps",
    ]

    try:
        with engine.connect() as conn:
            for t in tables:
                try:
                    seq_name = conn.execute(text(f"SELECT pg_get_serial_sequence('{t}', 'id')")).scalar()
                    if seq_name:
                        max_id = conn.execute(text(f"SELECT MAX(id) FROM {t}")).scalar()
                        if max_id is not None and max_id > 0:
                            conn.execute(text(f"SELECT setval('{seq_name}', {max_id}, true)"))
                        else:
                            conn.execute(text(f"SELECT setval('{seq_name}', 1, false)"))
                        conn.commit()
                except Exception:
                    pass
    except Exception as e:
        print(f"Warning: Could not sync PostgreSQL sequences on startup: {e}")