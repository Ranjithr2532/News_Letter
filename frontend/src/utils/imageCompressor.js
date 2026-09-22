/**
 * Client-side browser image compressor & file validator
 * 
 * Rules:
 * 1. Only Image files (JPG, PNG, WebP, BMP, TIFF) are accepted. PDFs are not supported.
 * 2. Max File Size: 15 MB per image.
 * 3. If an image is already <= 500 KB (desktop screenshots / photos): Kept 100% original & untouched (no compression).
 * 4. If an image is > 500 KB up to 15 MB: Smoothly compressed in browser canvas to ~350KB-600KB before uploading to ensure quick upload and crisp quality.
 */

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const SKIP_COMPRESSION_THRESHOLD = 500 * 1024; // 500 KB

export const compressImage = async (file, maxWidth = 1920, maxHeight = 1440, quality = 0.85) => {
  if (!file) return file;

  // 1. Reject PDFs or non-image files
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    throw new Error(`PDF upload is not supported. Please upload an image file (JPG, PNG, WebP).`);
  }

  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|bmp|tiff?)$/i.test(file.name)) {
    throw new Error(`"${file.name}" is not a supported image file. Please upload JPG, PNG, or WebP.`);
  }

  // 2. Check max size limit (15 MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`"${file.name}" is ${sizeMb} MB. Maximum allowed image size is 15 MB.`);
  }

  // 3. Smart Quality Check: If image is ALREADY under 500 KB, keep 100% original untouched
  if (file.size <= SKIP_COMPRESSION_THRESHOLD) {
    return file;
  }

  // 4. Heavy image (> 500 KB up to 15 MB): Compress in browser canvas
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio preserving resize
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Create compressed file with clean filename
            const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], newFileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => resolve(file);
    };

    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
  });
};

/**
 * Validates and compresses an array or FileList of files in parallel.
 * Rejects with a descriptive error message if any file exceeds 15 MB or is not an image.
 */
export const validateAndCompressFiles = async (files) => {
  if (!files || files.length === 0) return [];
  const fileArray = Array.from(files);
  const compressed = await Promise.all(fileArray.map((f) => compressImage(f)));
  return compressed;
};
