import { cloudinary } from '../config/cloudinary';
import { Readable } from 'stream';

export const uploadToCloudinary = async (fileBuffer: Buffer, folder: string) => {
  return new Promise((resolve, reject) => {
    // Create a stream to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folder },
      (error, result) => {
        if (error) {
          console.log('Cloudinary Stream Upload Error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );

    // Convert the buffer to a readable stream and pipe it to Cloudinary
    const stream = Readable.from(fileBuffer);
    stream.pipe(uploadStream);
  });
};