import multer from "multer";

// Change to memoryStorage. This keeps the file in RAM (req.file.buffer).
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const resumeTypes = ['application/pdf'];
    const allowedTypes = [...imageTypes, ...resumeTypes];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP images and PDF files are allowed.'));
    }
  },
});