import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { SALARY_SLIP_MAX_BYTES, SALARY_SLIP_MIME_TYPES } from "../config/constants";
import { AppError } from "../utils/AppError";

export const UPLOAD_DIR = path.resolve(__dirname, "..", "..", "uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase());
  },
});

export const uploadSalarySlip = multer({
  storage,
  limits: { fileSize: SALARY_SLIP_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (SALARY_SLIP_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(AppError.badRequest("Salary slip must be a PDF, JPG or PNG"));
  },
}).single("salarySlip");
