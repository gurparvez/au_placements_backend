import multer from "multer";

// Change to memoryStorage. This keeps the file in RAM (req.file.buffer).
const storage = multer.memoryStorage();

export const upload = multer({ storage });