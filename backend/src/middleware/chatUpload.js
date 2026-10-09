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

// Some browsers report code/text files with odd or empty MIME types
// (e.g. a .js file), so documents are also accepted by extension.
const allowedExtensions = new Set([
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".csv", ".zip", ".rtf", ".odt", ".ods",
    ".js", ".json", ".md",
]);

const blockedExtensions = new Set([
    ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".sh", ".ps1", ".vbs", ".jar", ".apk",
]);

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();

    if (blockedExtensions.has(ext)) {
        return cb(new Error(`Unsupported file type: ${ext}`));
    }

    if (allowedMimeTypes.has(file.mimetype) || allowedExtensions.has(ext)) {
        return cb(null, true);
    }

    return cb(new Error(`Unsupported file type: ${file.mimetype}`));
};

export const chatUpload = multer({
    storage,
    fileFilter,

    limits: {
        fileSize: 100 * 1024 * 1024,
        files: 10,
    },
});