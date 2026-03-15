import express from 'express';
import multer from 'multer';
import path from 'path';
import { ingestController } from '../controller/ingest.js';

// Store uploads in ./uploads/ with the original file extension preserved.
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, 'uploads/'),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
        const allowed = ['.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type "${ext}". Allowed: ${allowed.join(', ')}`));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

export const ingestRouter = express.Router();

ingestRouter.post('/', upload.single('file'), ingestController);
