export class AbortError extends Error {
	readonly name: 'AbortError';

	/**
	 * Abort pending execution. All unresolved promised are rejected with a `AbortError` error.
	 */
	constructor();
}

/**
 * [Throttle](https://css-tricks.com/debouncing-throttling-explained-examples/) promise-returning/async/normal functions.
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
 * const throttled = pThrottle(async index => {
 * 	return index * 2;
 * }, 2, 1000);
 *
 * for (let i = 1; i <= 6; i++) {
 * 	throttled(i).then(console.log);
 * }
 */
export default function<TArguments extends any[], TReturn>(
	fn: (...arguments: TArguments) => PromiseLike<TReturn> | TReturn,
	limit: number,
	interval: number
): ThrottledFunction<TArguments, TReturn>;

export type ThrottledFunction<TArguments extends any[], TReturn> = ((
	...args: TArguments
) => Promise<TReturn>) & {
	/**
	 * Abort pending executions. All unresolved promises are rejected with a `pThrottle.AbortError` error.
	 */
	abort(): void;
};
