# p-throttle

> Throttle promise-returning & async functions

It also works with normal functions.

It limits function calls without discarding them, making it ideal for external API interactions where avoiding call loss is crucial.

## Install

```sh
npm install p-throttle
```

## Usage

Here, the throttled function is only called twice a second:

```js
import {pThrottleRate} from 'p-throttle';

const now = Date.now();

const throttle = pThrottleRate({
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

Here, the throttled functions are called one at a time:

```js
import {pThrottleConcurrency} from 'p-throttle';
import ky from 'ky';
import {promises as fs} from 'node:fs';

const throttle = pThrottleConcurrency({
	concurrency: 1
});

const update = throttle(async () => {
	const data = await ky('https://raw.githubusercontent.com/sindresorhus/superb/main/words.json').json();

	await writeFile('words.txt', JSON.stringify(data));
});

const read = throttle(async () => {
	return JSON.parse(await readFile('words.txt', {encoding: 'utf8'}));
})

// update() and read() don't encounter a race condition!
void update();
const words = await read();

console.log(words);
//=> ['ace', 'amazing', 'astonishing', ...]
```

## API

### pThrottleRate(options)

Limit the rate of calls within an interval. Useful for following API rate limits.

Returns a [throttle function](#throttlefunction_).

#### options

Type: `object`

Both the `limit` and `interval` options must be specified.

##### limit

Type: `number`

The maximum number of calls within an `interval`.

##### interval

Type: `number`

The timespan for `limit` in milliseconds.

##### strict

Type: `boolean`\
Default: `false`

Use a strict, more resource intensive, throttling algorithm. The default algorithm uses a windowed approach that will work correctly in most cases, limiting the total number of calls at the specified limit per interval window. The strict algorithm throttles each call individually, ensuring the limit is not exceeded for any interval.

### pThrottleConcurrency(options)

Limit the concurrency of function executions. Useful for avoiding race conditions, or for computationally expensive operations.

Returns a [throttle function](#throttlefunction_).

#### options

##### concurrency

Type: `number`

The maximum amount of times it can be running at once.

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
