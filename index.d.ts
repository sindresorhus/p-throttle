export class AbortError extends Error {
	readonly name: 'AbortError';

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
export default function<TArguments extends any[], TReturn>(
	input: (...arguments: TArguments) => PromiseLike<TReturn> | TReturn,
	limit: number,
	interval: number
): ThrottledFunction<TArguments, TReturn>;

export type ThrottledFunction<TArguments extends any[], TReturn> = ((
	...args: TArguments
) => Promise<TReturn>) & {
	abort(): void;
};
