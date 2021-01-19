declare class AbortErrorClass extends Error {
	readonly name: 'AbortError';

	/**
	Abort pending execution. All unresolved promised are rejected with a `AbortError` error.
	*/
	constructor();
}

type PromiseResolve<ValueType> = ValueType extends PromiseLike<infer ValueType> ? Promise<ValueType> : Promise<ValueType>;

declare namespace pThrottle {
	type ThrottledFunction<Argument, ReturnValue> = ((
		...arguments: Argument[]
	) => PromiseResolve<ReturnValue>) & {
		/**
		Abort pending executions. All unresolved promises are rejected with a `pThrottle.AbortError` error.
		*/
		abort(): void;
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
	): <Argument, ReturnValue>(function_: (...arguments: Argument[]) => ReturnValue) => pThrottle.ThrottledFunction<Argument, ReturnValue>;
};

export = pThrottle;
