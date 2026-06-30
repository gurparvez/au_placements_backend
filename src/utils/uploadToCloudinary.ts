import { cloudinary } from '../config/cloudinary';
import { CONFIG } from '../config/environment';
import { Readable } from 'stream';

export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  folder: string
): Promise<any | null> => {
  // Skip gracefully when Cloudinary isn't configured (dev/local) so profile
  // create/update still works — the file simply isn't stored.
  const { cloudName, apiKey, apiSecret } = CONFIG.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('[cloudinary] Not configured — skipping file upload.');
    return null;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });

    const stream = Readable.from(fileBuffer);
    stream.pipe(uploadStream);
  });
};
