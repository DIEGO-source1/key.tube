export class UnlockError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = 'UnlockError';
  }
}

export function findUnlockError(error: unknown): UnlockError | undefined {
  const seen = new Set<unknown>();
  while (error && typeof error === 'object' && !seen.has(error)) {
    if (error instanceof UnlockError) return error;
    seen.add(error);
    error = (error as { cause?: unknown }).cause;
  }
}
