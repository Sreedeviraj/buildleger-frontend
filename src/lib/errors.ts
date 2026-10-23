export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/** Thrown when an entry looks like one already saved. The user can confirm and save anyway. */
export class DuplicateError extends Error {
  readonly code = 'DUPLICATE';
}

export const isDuplicateError = (error: unknown): error is DuplicateError =>
  error instanceof Error && (error as DuplicateError).code === 'DUPLICATE';

/** Thrown for records that do not exist (or belong to another company). */
export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
}

export const isNotFoundError = (error: unknown): boolean =>
  error instanceof Error && (error as NotFoundError).code === 'NOT_FOUND';
