import type { IApiResponse } from '../interfaces/api.interfaces.js';

export class ApiResponse<T> implements IApiResponse<T> {
  constructor(
    public success: boolean,
    public message: string,
    public data: T,
  ) {}

  static success<T>(message: string, data: T): ApiResponse<T> {
    return new ApiResponse(true, message, data);
  }

  static error<T>(message: string, data: T): ApiResponse<T> {
    return new ApiResponse(false, message, data);
  }
}
