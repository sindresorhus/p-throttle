declare class AbortErrorClass extends Error {
	readonly name: 'AbortError';

	/**
	Abort pending execution. All unresolved promised are rejected with a `AbortError` error.
	*/
	constructor();
}

declare namespace pThrottle {
	type ThrottledFunction<Arguments extends unknown[], Return> = ((
		...arguments: Arguments
	) => Promise<Return>) & {
		/**
		Abort pending executions. All unresolved promises are rejected with a `pThrottle.AbortError` error.
		*/
		abort(): void;
	};

	type AbortError = AbortErrorClass;
}

declare const pThrottle: {
	/**
	[Throttle](https://css-tricks.com/debouncing-throttling-explained-examples/) promise-returning/async/normal functions.

	@param fn - Promise-returning/async function or a normal function.
	@param limit - Maximum number of calls within an `interval`.
	@param interval - Timespan for `limit` in milliseconds.
	@returns A throttled version of `fn`.

	@example
	```
	import pThrottle from 'p-throttle';

	const throttled = pThrottle(async index => {
		return index * 2;
	}, 2, 1000);

	for (let i = 1; i <= 6; i++) {
		throttled(i).then(console.log);
	}
	```
	*/
	<Arguments extends unknown[], Return>(
		fn: (...arguments: Arguments) => PromiseLike<Return> | Return,
		limit: number,
		interval: number
	): pThrottle.ThrottledFunction<Arguments, Return>;

	AbortError: typeof AbortErrorClass;

	// TODO: Remove this for the next major release
	default: typeof pThrottle;
};

export = pThrottle;
