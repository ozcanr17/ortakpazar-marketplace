import { DomainError } from "@/lib/domain/errors";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 8 * 1024 * 1024;

function matchesMagic(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mime === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function validateImage(file: File): Promise<{ bytes: Uint8Array; extension: string }> {
  if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > maxBytes) throw new DomainError("INVALID_FILE", "Görsel JPG, PNG veya WebP ve en fazla 8 MB olmalıdır");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesMagic(bytes.slice(0, 12), file.type)) throw new DomainError("INVALID_FILE_CONTENT", "Dosya içeriği geçersiz");
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  return { bytes, extension };
}

export const createStoragePath = (ownerId: string, extension: string) => `${ownerId}/${crypto.randomUUID()}.${extension}`;
