export type ApiIssue = { field: string; message: string };

/** An error answer from the API (problem details), or a network failure (status 0). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly issues: ApiIssue[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the request never got an answer (offline, DNS, timeout). */
  get offline(): boolean {
    return this.status === 0;
  }

  /** The message, followed by any field problems — ready to show under a form. */
  get summary(): string {
    return this.issues.length
      ? `${this.message} ${this.issues.map((issue) => issue.message).join(' ')}`
      : this.message;
  }

  /** The first problem reported for one form field, if any. */
  field(name: string): string | undefined {
    return this.issues.find((issue) => issue.field === name)?.message;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.offline
      ? 'You appear to be offline. Check your connection and try again.'
      : error.summary;
  }
  return 'Something went wrong. Try again.';
}
