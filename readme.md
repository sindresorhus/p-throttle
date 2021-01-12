# p-throttle

> [Throttle](https://css-tricks.com/debouncing-throttling-explained-examples/) promise-returning & async functions

It also works with normal functions.

Useful for rate limiting calls to an external API, for example.

## Install

```
$ npm install p-throttle
```

## Usage

Here, the throttled function is only called twice a second:

```js
const pThrottle = require('p-throttle');

const now = Date.now();

const throttle = pThrottle({
	limit: 2,
	interval: 1000
});

const throttled = throttle(index => {
	const secDiff = ((Date.now() - now) / 1000).toFixed();
	return Promise.resolve(`${index}: ${secDiff}s`);
});

for (let i = 1; i <= 6; i++) {
	throttled(i).then(console.log);
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

Returns a `throttle` function.

Returns a throttled version of `fn`.

#### options

Type: `object`

##### limit

Type: `number`

Maximum number of calls within an `interval`.

##### interval

Type: `number`

Timespan for `limit` in milliseconds.

### throttle(function_)

#### function_

Type: `Function`

Promise-returning/async function or a normal function.

### throttledFn.abort()

Abort pending executions. All unresolved promises are rejected with a `pThrottle.AbortError` error.

## Related

- [p-debounce](https://github.com/sindresorhus/p-debounce) - Debounce promise-returning & async functions
- [p-limit](https://github.com/sindresorhus/p-limit) - Run multiple promise-returning & async functions with limited concurrency
- [p-memoize](https://github.com/sindresorhus/p-memoize) - Memoize promise-returning & async functions
- [More…](https://github.com/sindresorhus/promise-fun)
