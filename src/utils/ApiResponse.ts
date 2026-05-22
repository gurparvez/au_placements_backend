import { Response } from 'express';

export class ApiResponse {
  static success(res: Response, data: any = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({ success: true, message, data });
  }

  static created(res: Response, data: any = null, message = 'Created successfully') {
    return res.status(201).json({ success: true, message, data });
  }

  static error(res: Response, message = 'Internal Server Error', statusCode = 500, errors: any = null) {
    return res.status(statusCode).json({ success: false, message, ...(errors && { errors }) });
  }

  static notFound(res: Response, message = 'Resource not found') {
    return res.status(404).json({ success: false, message });
  }

  static unauthorized(res: Response, message = 'Unauthorized') {
    return res.status(401).json({ success: false, message });
  }
}
