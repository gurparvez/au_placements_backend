import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { CONFIG } from '../config/environment';

const MIME_EXTENSIONS: Record<string, string> = {
  'application/msword': '.doc',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function sanitizePathSegment(segment: string) {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
}

function extensionFor(mimeType: string, originalName?: string) {
  if (MIME_EXTENSIONS[mimeType]) return MIME_EXTENSIONS[mimeType];
  const parsed = originalName ? path.extname(originalName) : '';
  return parsed || '.bin';
}

export async function saveMediaFile(
  fileBuffer: Buffer,
  folder: string,
  mimeType: string,
  originalName?: string
) {
  const safeFolder = folder
    .split(/[\\/]/)
    .filter(Boolean)
    .map(sanitizePathSegment)
    .join(path.sep);

  const targetDir = path.join(CONFIG.media.root, safeFolder);
  await fs.mkdir(targetDir, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}${extensionFor(mimeType, originalName)}`;
  const absolutePath = path.join(targetDir, filename);

  await fs.writeFile(absolutePath, fileBuffer);

  const relativeUrl = `${CONFIG.media.urlPath}/${safeFolder.split(path.sep).join('/')}/${filename}`;

  return {
    absolutePath,
    relativeUrl,
    publicUrl: `${CONFIG.publicBaseUrl}${relativeUrl}`,
  };
}
