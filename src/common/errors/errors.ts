/**
 * Domain error hierarchy. API controllers map these to a consistent error
 * envelope (Build guide §9 "consistent error envelopes"); business logic throws
 * these from the service layer.
 */

export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

/** Input failed validation (bad RFQ payload, missing field, etc.). */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
}

/** A referenced entity does not exist (within the tenant). */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}

/** The caller's role is not permitted to perform the action. */
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}

/** A business rule was violated (e.g. no rate valid for the travel date). */
export class BusinessRuleError extends DomainError {
  readonly code = 'BUSINESS_RULE';
}

/** Wire shape for API error responses. */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function toEnvelope(err: DomainError): ErrorEnvelope {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  };
}
