import type { StatusCodes } from 'http-status-codes';

export interface IApiResponse<T> {
  status?: StatusCodes;
  success: boolean;
  message: string;
  data: T;
}
