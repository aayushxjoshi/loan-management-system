import { SalarySlipFile } from "../models/SalarySlipFile";
import { AppError } from "../utils/AppError";

export interface UploadedSlip {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export class SalarySlipService {
  constructor(private readonly fileModel: typeof SalarySlipFile) {}

  save(borrowerId: string, file: UploadedSlip) {
    return this.fileModel.create({
      borrower: borrowerId,
      data: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      size: file.size,
    });
  }

  // Removes every stored slip of the borrower except the one to keep.
  async deleteOthers(borrowerId: string, keepId: string) {
    await this.fileModel.deleteMany({ borrower: borrowerId, _id: { $ne: keepId } });
  }

  async get(fileId: string) {
    const file = await this.fileModel.findById(fileId);
    if (!file) throw AppError.notFound("Salary slip not found");
    return file;
  }
}
