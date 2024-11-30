type AnyFunction = (...arguments_: readonly any[]) => unknown;

export type ThrottledFunction<F extends AnyFunction> = F & {
	/**
	Whether future function calls should be throttled or count towards throttling thresholds.

	@default true
	*/
	isEnabled: boolean;

	/**
	The number of queued items waiting to be executed.
	*/
	readonly queueSize: number;
};

export type Options = {
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

	/**
	Abort pending executions. When aborted, all unresolved promises are rejected with `signal.reason`.

	@example
	```
	import pThrottle from 'p-throttle';

	const controller = new AbortController();

	const throttle = pThrottle({
		limit: 2,
		interval: 1000,
		signal: controller.signal
	});

	const throttled = throttle(() => {
		console.log('Executing...');
	});

	await throttled();
	await throttled();
	controller.abort('aborted')
	await throttled();
	//=> Executing...
	//=> Executing...
	//=> Promise rejected with reason `aborted`
	```
	*/
	signal?: AbortSignal;

	/**
	Get notified when function calls are delayed due to exceeding the `limit` of allowed calls within the given `interval`.

 	Can be useful for monitoring the throttling efficiency.

	@example
	```
	import pThrottle from 'p-throttle';

	const throttle = pThrottle({
		limit: 2,
		interval: 1000,
		onDelay: (a, b) => {
			console.log(`Reached interval limit, call is delayed for ${a} ${b}`);
		},
	});

	const throttled = throttle(() => {
		console.log('Executing...');
	});

	await throttled(1, 2);
	await throttled(3, 4);
	await throttled(5, 6);
	//=> Executing with 1 2...
	//=> Executing with 3 4...
	//=> Reached interval limit, call is delayed for 5 6
	//=> Executing with 5 6...
	```
	*/
	readonly onDelay?: (...arguments_: readonly any[]) => void;
};

/**
Throttle promise-returning/async/normal functions.

It rate-limits function calls without discarding them, making it ideal for external API interactions where avoiding call loss is crucial.

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
export default function pThrottle(options: Options): <F extends AnyFunction>(function_: F) => ThrottledFunction<F>;
