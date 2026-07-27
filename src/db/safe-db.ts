/**
 * Safe database wrapper that handles "closed resource" errors
 * that occur during hot reloads in development.
 */
import * as SQLite from 'expo-sqlite';

function isClosedResourceError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('Access to closed resource') ||
      error.message.includes('finalizeAsync') ||
      error.message.includes('prepareAsync') ||
      error.message.includes('closed database')
    );
  }
  return false;
}

/**
 * Wraps an async SQLite operation to silently catch
 * "closed resource" errors (happens during hot reload).
 */
export async function safeDbCall<T>(
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isClosedResourceError(error)) {
      console.warn('SQLite: ignored closed resource error during reload');
      return fallback;
    }
    throw error;
  }
}

/**
 * Like Promise.all but wraps each call in safeDbCall.
 * Returns all results even if some fail with closed resource.
 */
export async function safeDbAll<T extends readonly unknown[]>(
  fns: readonly (() => Promise<unknown>)[],
  fallback: unknown,
): Promise<T> {
  const results = await Promise.all(
    fns.map((fn) => safeDbCall(fn, fallback)),
  );
  return results as unknown as T;
}
