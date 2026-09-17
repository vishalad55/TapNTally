import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError } from '@tapntally/shared';
import { Response } from 'express';

/**
 * Domain error carrying a stable machine-readable `code`. Prefer this over
 * bare HttpException in services so the mobile app can branch on `code`
 * (e.g. NFC_DUPLICATE_BILL → "already recorded" toast, not an error).
 */
export class AppError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let body: ApiError;
    if (exception instanceof AppError) {
      body = {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      const message =
        typeof resp === 'string'
          ? resp
          : Array.isArray((resp as { message?: unknown }).message)
            ? ((resp as { message: string[] }).message).join('; ')
            : ((resp as { message?: string }).message ?? exception.message);
      body = { statusCode: status, code: httpCode(status), message };
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      body = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong on our side. Please try again.',
      };
    }

    res.status(body.statusCode).json(body);
  }
}

function httpCode(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 429: return 'RATE_LIMITED';
    default: return `HTTP_${status}`;
  }
}
