export class AbortError extends Error {
	/**
	 * Abort pending execution. All unresolved promised are rejected with a `AbortError` error.
	 */
	constructor();
}

/**
 * Returns a throttled version of `fn`.
 *
 * @param input - Promise-returning/async function or a normal function.
 * @param limit - Maximum number of calls within an `interval`.
 * @param interval - Timespan for `limit` in milliseconds.
 * @returns A throttled version of `fn`.
 *
 * @example
 *
 * import pThrottle from 'p-throttle';
 *
 * const throttled = pThrottle(async index => {
 * 	return index * 2;
 * }, 2, 1000);
 *
 * for (let i = 1; i <= 6; i++) {
 * 	throttled(i).then(console.log);
 * }
 */
export default function <T extends Function>(input: T, limit: number, interval: number): T;
