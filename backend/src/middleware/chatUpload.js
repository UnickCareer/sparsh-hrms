import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.resolve("uploads/chat");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {
        recursive: true,
    });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const baseName = path
            .basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .slice(0, 80);

        const uniqueName =
            `${Date.now()}-${Math.round(Math.random() * 1e9)}-${baseName}${ext}`;

        cb(null, uniqueName);
    },
});

const allowedMimeTypes = new Set([
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",

    // Videos
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",

    // Documents / files
    "application/pdf",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed",

    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    "text/csv",
]);

const fileFilter = (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
        return cb(
            new Error(
                `Unsupported file type: ${file.mimetype}`
            )
        );
    }

    cb(null, true);
};

export const chatUpload = multer({
    storage,
    fileFilter,

    limits: {
        fileSize: 100 * 1024 * 1024,
        files: 10,
    },
});