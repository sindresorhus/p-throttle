interface AbortError extends Error {}

interface AbortErrorConstructor {
	/**
	 * Abort pending execution. All unresolved promised are rejected with a `AbortError` error.
	 *
	 * @param message - A human-readable description of the error.
	 */
    new(message?: string): AbortError;
	/**
	 * Abort pending execution. All unresolved promised are rejected with a `AbortError` error.
	 *
	 * @param message - A human-readable description of the error.
	 */
	(message?: string): AbortError;
    readonly prototype: AbortError;
}

export const AbortError: AbortErrorConstructor;

/**
 * Returns a throttled version of `fn`.
 *
 * @param fn - Promise-returning/async function or a normal function.
 * @param limit - Maximum number of calls within an `interval`.
 * @param interval - Timespan for `limit` in milliseconds.
 * @returns A throttled version of `fn`.
 *
 * @example
 *
 * import pThrottle from 'p-throttle';
 *
 * const throttled = pThrottle(i => {
 * 	return Promise.resolve(i * 2);
 * }, 2, 1000);
 *
 * for (let i = 1; i <= 6; i++) {
 * 	throttled(i).then(console.log);
 * }
 */
export default function <T extends Function>(fn: T, limit: number, interval: number): T;
