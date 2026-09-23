import json
import os
import io
import mimetypes
from typing import Optional, BinaryIO
from minio import Minio
from minio.error import S3Error

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "172.18.7.91:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "newsletter")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"
MINIO_REGION = os.getenv("MINIO_REGION")
MINIO_PUBLIC_URL = os.getenv("MINIO_PUBLIC_URL")

_client: Optional[Minio] = None


def ensure_bucket_policy(client: Minio):
    """
    Ensures the MinIO bucket has a public read policy so browser <img> tags can fetch images directly.
    """
    try:
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetBucketLocation", "s3:ListBucket"],
                    "Resource": [f"arn:aws:s3:::{MINIO_BUCKET}"],
                },
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{MINIO_BUCKET}/*"],
                },
            ],
        }
        client.set_bucket_policy(MINIO_BUCKET, json.dumps(policy))
        print(f"[MinIO] Public read policy configured for bucket '{MINIO_BUCKET}'")
    except Exception as e:
        print(f"[MinIO] Warning: Failed to set bucket policy: {e}")


def get_minio_client() -> Optional[Minio]:
    """
    Returns an initialized Minio client or None if connection fails.
    """
    global _client
    if _client is not None:
        return _client

    try:
        client = Minio(
            endpoint=MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE,
            region=MINIO_REGION,
        )
        # Ensure bucket exists
        if not client.bucket_exists(MINIO_BUCKET):
            client.make_bucket(MINIO_BUCKET)
            print(f"[MinIO] Created bucket '{MINIO_BUCKET}'")
        else:
            print(f"[MinIO] Connected to bucket '{MINIO_BUCKET}' at {MINIO_ENDPOINT}")
        
        # Set public read bucket policy
        ensure_bucket_policy(client)

        _client = client
        return _client
    except Exception as e:
        print(f"[MinIO] Warning: Failed to initialize MinIO client ({MINIO_ENDPOINT}): {e}")
        return None


def upload_file_bytes(
    object_name: str,
    data: bytes,
    content_type: Optional[str] = None,
) -> bool:
    """
    Uploads raw bytes to MinIO.
    """
    client = get_minio_client()
    if not client:
        return False

    if not content_type:
        content_type, _ = mimetypes.guess_type(object_name)
        content_type = content_type or "application/octet-stream"

    try:
        data_stream = io.BytesIO(data)
        client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name,
            data=data_stream,
            length=len(data),
            content_type=content_type,
        )
        return True
    except Exception as e:
        print(f"[MinIO] Failed to upload {object_name}: {e}")
        return False


def upload_file_stream(
    object_name: str,
    stream: BinaryIO,
    length: int,
    content_type: Optional[str] = None,
) -> bool:
    """
    Uploads from a binary stream/file-like object to MinIO.
    """
    client = get_minio_client()
    if not client:
        return False

    if not content_type:
        content_type, _ = mimetypes.guess_type(object_name)
        content_type = content_type or "application/octet-stream"

    try:
        client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name,
            data=stream,
            length=length,
            content_type=content_type,
        )
        return True
    except Exception as e:
        print(f"[MinIO] Failed to upload stream {object_name}: {e}")
        return False


def get_minio_url(object_name: str) -> str:
    """
    Constructs and returns the full accessible URL to the object in MinIO.
    e.g. http://172.18.7.91:9000/newsletter/photos/135_...jpg
    """
    proto = "https" if MINIO_SECURE else "http"
    base = MINIO_PUBLIC_URL or f"{proto}://{MINIO_ENDPOINT}"
    if not base.startswith("http://") and not base.startswith("https://"):
        base = f"{proto}://{base}"

    clean_obj = object_name.lstrip("/").replace("\\", "/")
    if not clean_obj.startswith("photos/"):
        clean_obj = f"photos/{clean_obj}"

    return f"{base.rstrip('/')}/{MINIO_BUCKET}/{clean_obj}"


def extract_object_candidates(object_name: str):
    """
    Normalizes object_name or full URL into candidate MinIO object keys.
    """
    name = object_name.replace("\\", "/")
    # If full URL like http://172.18.7.91:9000/newsletter/photos/xyz.jpg
    if "/" in name:
        if f"/{MINIO_BUCKET}/" in name:
            name = name.split(f"/{MINIO_BUCKET}/")[-1]
        name = name.lstrip("/")

    filename_only = os.path.basename(name)
    return [
        name,
        name.replace("uploads/", ""),
        f"photos/{filename_only}",
        filename_only,
    ]


def get_file_bytes(object_name: str) -> Optional[bytes]:
    """
    Downloads file from MinIO and returns raw bytes, or None if not found/error.
    """
    client = get_minio_client()
    if not client:
        return None

    candidates = extract_object_candidates(object_name)

    for cand in candidates:
        try:
            response = client.get_object(MINIO_BUCKET, cand)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error:
            continue
        except Exception as e:
            print(f"[MinIO] Error reading {cand}: {e}")
            continue

    return None


def get_object_stream(object_name: str):
    """
    Returns (response_stream, content_type) from MinIO for streaming responses.
    """
    client = get_minio_client()
    if not client:
        return None, None

    candidates = extract_object_candidates(object_name)

    for cand in candidates:
        try:
            response = client.get_object(MINIO_BUCKET, cand)
            content_type = response.headers.get("Content-Type") or mimetypes.guess_type(cand)[0] or "application/octet-stream"
            return response, content_type
        except Exception:
            continue

    return None, None


def delete_file(object_name: str) -> bool:
    """
    Deletes an object from MinIO.
    """
    client = get_minio_client()
    if not client:
        return False

    candidates = extract_object_candidates(object_name)

    success = False
    for cand in candidates:
        try:
            client.remove_object(MINIO_BUCKET, cand)
            success = True
        except Exception:
            pass

    return success
