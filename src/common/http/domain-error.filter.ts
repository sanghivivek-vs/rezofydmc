/**
 * Maps thrown errors to the consistent API error envelope (Build guide §9).
 *
 * - DomainError subclasses map to documented codes + HTTP statuses.
 * - Nest HttpExceptions pass through with their status.
 * - Anything else becomes a 500 with a generic message (details are logged,
 *   never leaked to the client).
 */

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DomainError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  BusinessRuleError,
  type ErrorEnvelope,
} from '@common/errors/errors';

const STATUS_BY_ERROR = new Map<string, number>([
  [ValidationError.name, HttpStatus.BAD_REQUEST],
  [NotFoundError.name, HttpStatus.NOT_FOUND],
  [ForbiddenError.name, HttpStatus.FORBIDDEN],
  [BusinessRuleError.name, HttpStatus.CONFLICT],
]);

@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof DomainError) {
      const status = STATUS_BY_ERROR.get(exception.constructor.name) ?? HttpStatus.BAD_REQUEST;
      const envelope: ErrorEnvelope = {
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.details ? { details: exception.details } : {}),
        },
      };
      res.status(status).json(envelope);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : (((response as Record<string, unknown>).message as string) ?? exception.message);
      const envelope: ErrorEnvelope = {
        error: { code: httpCode(status), message: String(message) },
      };
      res.status(status).json(envelope);
      return;
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : exception,
    );
    const envelope: ErrorEnvelope = {
      error: { code: 'INTERNAL', message: 'Internal server error' },
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(envelope);
  }
}

function httpCode(status: number): string {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    default:
      return 'ERROR';
  }
}
