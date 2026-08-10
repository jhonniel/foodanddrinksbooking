/**
 * Client-side image compression via canvas.
 * Shrinks dimensions and re-encodes as JPEG to cut S3 / disk usage.
 */
export async function compressImageFile(
  file: File,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    /** Output mime type — JPEG is smaller for photos. */
    mimeType?: "image/jpeg" | "image/webp";
  }
): Promise<File> {
  const maxWidth = options?.maxWidth ?? 512;
  const maxHeight = options?.maxHeight ?? 512;
  const quality = options?.quality ?? 0.72;
  const mimeType = options?.mimeType ?? "image/jpeg";

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be compressed.");
  }

  // Skip tiny files already under ~150KB unless they're huge dimensions
  if (file.size < 150_000 && file.type === mimeType) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      maxWidth / bitmap.width,
      maxHeight / bitmap.height
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not compress image.");
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) reject(new Error("Could not compress image."));
          else resolve(result);
        },
        mimeType,
        quality
      );
    });

    // Keep original if compression somehow grew the file
    if (blob.size >= file.size && file.size <= 5 * 1024 * 1024) {
      return file;
    }

    const base = file.name.replace(/\.[^.]+$/, "") || "avatar";
    const ext = mimeType === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${base}.${ext}`, {
      type: mimeType,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
