import multer from "multer";
import { SALARY_SLIP_MAX_BYTES, SALARY_SLIP_MIME_TYPES } from "../config/constants";
import { AppError } from "../utils/AppError";

export const uploadSalarySlip = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SALARY_SLIP_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (SALARY_SLIP_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(AppError.badRequest("Salary slip must be a PDF, JPG or PNG"));
  },
}).single("salarySlip");
