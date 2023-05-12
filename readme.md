# p-throttle

> [Throttle](https://css-tricks.com/debouncing-throttling-explained-examples/) promise-returning & async functions

It also works with normal functions.

Useful for rate limiting calls to an external API, for example.

## Install

```sh
npm install p-throttle
```

## Usage

Here, the throttled function is only called twice a second:

```js
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

## API

### pThrottle(options)

Returns a throttle function.

#### options

Type: `object`

Both the `limit` and `interval` options must be specified.

##### limit

Type: `number`

The maximum number of calls within an `interval`.

##### interval

Type: `number`

The timespan for `limit` in milliseconds.

#### strict

Type: `boolean`\
Default: `false`

Use a strict, more resource intensive, throttling algorithm. The default algorithm uses a windowed approach that will work correctly in most cases, limiting the total number of calls at the specified limit per interval window. The strict algorithm throttles each call individually, ensuring the limit is not exceeded for any interval.

### throttle(function_)

Returns a throttled version of `function_`.

#### function_

Type: `Function`

A promise-returning/async function or a normal function.

### throttledFn.abort()

Abort pending executions. All unresolved promises are rejected with a `pThrottle.AbortError` error.

### throttledFn.isEnabled

Type: `boolean`\
Default: `true`

Whether future function calls should be throttled and count towards throttling thresholds.

### throttledFn.queueSize

Type: `number`

The number of queued items waiting to be executed.

## Related

- [p-debounce](https://github.com/sindresorhus/p-debounce) - Debounce promise-returning & async functions
- [p-limit](https://github.com/sindresorhus/p-limit) - Run multiple promise-returning & async functions with limited concurrency
- [p-memoize](https://github.com/sindresorhus/p-memoize) - Memoize promise-returning & async functions
- [More…](https://github.com/sindresorhus/promise-fun)
