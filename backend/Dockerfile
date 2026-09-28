# ==========================================
# Newsletter Builder Backend Dockerfile
# Python FastAPI Application
# ==========================================

FROM python:3.11-slim

# Set environment variables for Python performance & logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set working directory in container
WORKDIR /app

# Install system dependencies needed for compiling packages (psycopg2, lxml, pillow, etc.) & healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency definition and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application source code
COPY . .

# Expose FastAPI backend port
EXPOSE 8005

# Run FastAPI app with Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8005"]
