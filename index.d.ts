declare class AbortErrorClass extends Error {
	readonly name: 'AbortError';

	/**
	Abort pending execution. All unresolved promised are rejected with a `AbortError` error.
	*/
	constructor();
}

declare namespace pThrottle {
	type ThrottledFunction<FunctionType extends (...args: any) => any> = ((
		...arguments: Parameters<FunctionType>
	) => ReturnType<FunctionType>) & {
		/**
		Abort pending executions. All unresolved promises are rejected with a `pThrottle.AbortError` error.
		*/
		abort(): void;

		/**
		Whether future function calls should be throttled or count towards throttling thresholds.

		@default true
		*/
		isEnabled: boolean;
	};

	interface Options {
		/**
		Maximum number of calls within an `interval`.
		*/
		limit: number;

		/**
		Timespan for `limit` in milliseconds.
		*/
		interval: number;
	}

	type AbortError = AbortErrorClass;

	/**
	@param fn - Promise-returning/async function or a normal function.
	*/
	type Throttle<FunctionType extends (...args: any) => any> = (fn: (...arguments: Parameters<FunctionType>) => ReturnType<FunctionType>) => ThrottledFunction<FunctionType>;
}

declare const pThrottle: {
	AbortError: typeof AbortErrorClass;

	/**
	[Throttle](https://css-tricks.com/debouncing-throttling-explained-examples/) promise-returning/async/normal functions.

	@returns A throttled version of `fn`.

	Both the `limit` and `interval` options must be specified.

	@example
	```
	import pThrottle from 'p-throttle';

	const throttle = pThrottle({
		limit: 2,
		interval: 1000
	});

	const throttled = throttle(async index => {
		return index * 2;
	});

	for (let i = 1; i <= 6; i++) {
		throttled(i).then(console.log);
	}
	```
	*/
	<FunctionType extends (...args: any) => any>(
		options: pThrottle.Options
	): pThrottle.Throttle<FunctionType>;
};

export = pThrottle;
