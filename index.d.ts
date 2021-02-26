declare class AbortErrorClass extends Error {
	readonly name: 'AbortError';

	/**
	Abort pending execution. All unresolved promised are rejected with a `AbortError` error.
	*/
	constructor();
}

type PromiseResolve<ValueType> = ValueType extends PromiseLike<infer ValueType> ? Promise<ValueType> : Promise<ValueType>;

declare namespace pThrottle {
	type ThrottledFunction<Argument extends readonly unknown[], ReturnValue> = ((
		...arguments: Argument
	) => PromiseResolve<ReturnValue>) & {
		/**
		Whether future function calls should be throttled or count towards throttling thresholds.

		@default true
		*/
		isEnabled: boolean;

		/**
		Abort pending executions. All unresolved promises are rejected with a `pThrottle.AbortError` error.
		*/
		abort(): void;
	};

	interface Options {
		/**
		Maximum number of calls within an `interval`.
		*/
		readonly limit: number;

		/**
		Timespan for `limit` in milliseconds.
		*/
		readonly interval: number;

		/**
		Use a strict, more resource intensive, throttling algorithm. The default algorithm uses a windowed approach that will work correctly in most cases, limiting the total number of calls at the specified limit per interval window. The strict algorithm throttles each call individually, ensuring the limit is not exceeded for any interval.

		@default false
		*/
		readonly strict?: boolean;
	}

	type AbortError = AbortErrorClass;
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
	(
		options: pThrottle.Options
	): <Argument extends readonly unknown[], ReturnValue>(function_: (...arguments: Argument) => ReturnValue) => pThrottle.ThrottledFunction<Argument, ReturnValue>;
};

export = pThrottle;
