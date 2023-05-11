export class AbortError extends Error {
	readonly name: 'AbortError';

	private constructor();
}

// TODO: Use the `Awaited` utility instead when targeting TS 4.5.
type PromiseResolve<ValueType> = ValueType extends PromiseLike<infer ValueType> ? Promise<ValueType> : Promise<ValueType>;

export type ThrottledFunction<Argument extends readonly unknown[], ReturnValue> = ((...arguments: Argument) => PromiseResolve<ReturnValue>)
& {
	/**
	Whether future function calls should be throttled or count towards throttling thresholds.

	@default true
	*/
	isEnabled: boolean;

	/**
	The number of queued items waiting to be executed.
	*/
	readonly queueSize: number;

	/**
	Abort pending executions. All unresolved promises are rejected with a `pThrottle.AbortError` error.
	*/
	abort(): void;
};

export interface Options {
	/**
	The maximum number of calls within an `interval`.
	*/
	readonly limit: number;

	/**
	The timespan for `limit` in milliseconds.
	*/
	readonly interval: number;

	/**
	Use a strict, more resource intensive, throttling algorithm. The default algorithm uses a windowed approach that will work correctly in most cases, limiting the total number of calls at the specified limit per interval window. The strict algorithm throttles each call individually, ensuring the limit is not exceeded for any interval.

	@default false
	*/
	readonly strict?: boolean;
}

/**
[Throttle](https://css-tricks.com/debouncing-throttling-explained-examples/) promise-returning/async/normal functions.

@returns A throttle function.

Both the `limit` and `interval` options must be specified.

@example
```
import pThrottle from 'p-throttle';

const now = Date.now();

const throttle = pThrottle({
	limit: 2,
	interval: 1000
});

const throttled = throttle(async index => {
	const secDiff = ((Date.now() - now) / 1000).toFixed();
	return `${index}: ${secDiff}s`;
});

for (let index = 1; index <= 6; index++) {
	(async () => {
		console.log(await throttled(index));
	})();
}
//=> 1: 0s
//=> 2: 0s
//=> 3: 1s
//=> 4: 1s
//=> 5: 2s
//=> 6: 2s
```
*/
export default function pThrottle(options: Options): <Argument extends readonly unknown[], ReturnValue>(function_: (...arguments: Argument) => ReturnValue) => ThrottledFunction<Argument, ReturnValue>;
