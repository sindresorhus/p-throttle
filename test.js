import test from 'ava';
import inRange from 'in-range';
import timeSpan from 'time-span';
import delay from 'delay';
import pThrottle, {AbortError} from './index.js';

const fixture = Symbol('fixture');

test('main', async t => {
	const totalRuns = 100;
	const limit = 5;
	const interval = 100;
	const end = timeSpan();
	const throttled = pThrottle({limit, interval})(async () => {});

	await Promise.all(Array.from({length: totalRuns}).fill(0).map(x => throttled(x)));

	const totalTime = (totalRuns * interval) / limit;
	t.true(inRange(end(), {
		start: totalTime - 200,
		end: totalTime + 200,
	}));
});

test('queue size', async t => {
	const limit = 10;
	const interval = 100;
	const delayedExecutions = 20;
	const throttled = pThrottle({limit, interval})(() => Date.now());
	const promises = [];

	t.is(throttled.queueSize, 0);

	for (let index = 0; index < limit; index++) {
		promises.push(throttled());
	}

	t.is(throttled.queueSize, 0);

	for (let index = 0; index < delayedExecutions; index++) {
		promises.push(throttled());
	}

	t.is(throttled.queueSize, delayedExecutions);

	await Promise.all(promises);

	t.is(throttled.queueSize, 0);
});

test('strict mode', async t => {
	const totalRuns = 100;
	const limit = 5;
	const interval = 100;
	const strict = true;
	const end = timeSpan();
	const throttled = pThrottle({limit, interval, strict})(async () => {});

	await Promise.all(Array.from({length: totalRuns}).fill(0).map(x => throttled(x)));

	const totalTime = (totalRuns * interval) / limit;
	t.true(inRange(end(), {
		start: totalTime - 200,
		end: totalTime + 200,
	}));
});

test('limits after pause in strict mode', async t => {
	const limit = 10;
	const interval = 100;
	const strict = true;
	const throttled = pThrottle({limit, interval, strict})(() => Date.now());
	const pause = 40;
	const promises = [];
	const start = Date.now();

	await throttled();

	await delay(pause);

	for (let index = 0; index < limit + 1; index++) {
		promises.push(throttled());
	}

	const results = await Promise.all(promises);

	for (const [index, executed] of results.entries()) {
		const elapsed = executed - start;
		if (index < limit - 1) {
			t.true(inRange(elapsed, {start: pause, end: pause + 50}), 'Executed immediately after the pause');
		} else if (index === limit - 1) {
			t.true(inRange(elapsed, {start: interval, end: interval + 50}), 'Executed after the interval');
		} else {
			const difference = executed - results[index - limit];
			t.true(inRange(difference, {start: interval - 10, end: interval + 50}), 'Waited the interval');
		}
	}
});

test('limits after pause in windowed mode', async t => {
	const limit = 10;
	const interval = 100;
	const strict = false;
	const throttled = pThrottle({limit, interval, strict})(() => Date.now());
	const pause = 40;
	const promises = [];
	const start = Date.now();

	await throttled();

	await delay(pause);

	for (let index = 0; index < limit + 1; index++) {
		promises.push(throttled());
	}

	const results = await Promise.all(promises);

	for (const [index, executed] of results.entries()) {
		const elapsed = executed - start;
		if (index < limit - 1) {
			t.true(inRange(elapsed, {start: pause, end: pause + 10}), 'Executed immediately after the pause');
		} else {
			t.true(inRange(elapsed, {start: interval - 10, end: interval + 10}), 'Executed immediately after the interval');
		}
	}
});

test('passes arguments through', async t => {
	const throttled = pThrottle({limit: 1, interval: 100})(async x => x);
	t.is(await throttled(fixture), fixture);
});

test('can be aborted', async t => {
	const limit = 1;
	const interval = 10_000; // 10 seconds
	const end = timeSpan();
	const throttled = pThrottle({limit, interval})(async () => {});

	await throttled();
	const promise = throttled();
	throttled.abort();
	let error;
	try {
		await promise;
	} catch (error_) {
		error = error_;
	}

	t.true(error instanceof AbortError);
	t.true(end() < 100);
});

test('can listen to AbortSignal to abort execution', async t => {
	const limit = 1;
	const interval = 10_000; // 10 seconds
	const end = timeSpan();
	const abortController = new AbortController();
	const throttled = pThrottle({limit, interval, signal: abortController.signal})(async x => x);

	const one = await throttled(1);
	const promise = throttled(2);
	abortController.abort();
	let error;
	let endValue;
	try {
		endValue = await promise;
	} catch (error_) {
		error = error_;
	}

	t.true(error instanceof AbortError);
	t.true(end() < 100);
	t.true(one === 1);
	t.true(endValue === undefined);
});

test('can be disabled', async t => {
	let counter = 0;

	const throttled = pThrottle({
		limit: 1,
		interval: 10_000,
	})(async () => ++counter);

	t.is(await throttled(), 1);

	const end = timeSpan();

	throttled.isEnabled = false;
	t.is(await throttled(), 2);

	t.true(end() < 200);
});

test('promise rejections are thrown', async t => {
	const throttled = pThrottle({
		limit: 1,
		interval: 10_000,
	})(() => Promise.reject(new Error('Catch me if you can!')));

	await t.throwsAsync(throttled, {
		instanceOf: Error,
		message: 'Catch me if you can!',
	});
});

test('`this` is preserved in throttled function', async t => {
	class FixtureClass {
		constructor() {
			this._foo = fixture;
		}

		foo() {
			// If `this` is not preserved by `pThrottle()`
			// then `this` will be undefined and accesing `this._foo` will throw.
			return this._foo;
		}

		getThis() {
			// If `this` is not preserved by `pThrottle()`
			// then `this` will be undefined.
			return this;
		}
	}
	FixtureClass.prototype.foo = pThrottle({limit: 1, interval: 100})(FixtureClass.prototype.foo);
	FixtureClass.prototype.getThis = pThrottle({limit: 1, interval: 100})(FixtureClass.prototype.getThis);

	const thisFixture = new FixtureClass();

	t.is(await thisFixture.getThis(), thisFixture);
	await t.notThrowsAsync(thisFixture.foo());
	t.is(await thisFixture.foo(), fixture);
});

for (const limit of [1, 5, 10]) {
	test(`respects limit of ${limit} calls`, async t => {
		const interval = 100;
		const throttled = pThrottle({limit, interval})(() => Date.now());
		const promises = [];
		const start = Date.now();

		for (let i = 0; i < limit; i++) {
			promises.push(throttled());
		}

		const results = await Promise.all(promises);
		for (const time of results) {
			t.true(inRange(time - start, {start: 0, end: interval}));
		}
	});
}

test('handles multiple instances independently', async t => {
	const throttledOne = pThrottle({limit: 1, interval: 100})(() => 'one');
	const throttledTwo = pThrottle({limit: 1, interval: 200})(() => 'two');

	const resultOne = await throttledOne();
	const resultTwo = await throttledTwo();

	t.is(resultOne, 'one');
	t.is(resultTwo, 'two');
});

test('disable and re-enable functionality', async t => {
	const throttled = pThrottle({limit: 1, interval: 1000})(() => Date.now());
	const start = Date.now();

	await throttled(); // First call, should pass immediately.
	throttled.isEnabled = false;
	const timeDisabled = await throttled(); // Should pass immediately.
	throttled.isEnabled = true;
	const timeReEnabled = await throttled(); // Should be throttled.

	t.true(timeDisabled - start < 100);
	t.true(timeReEnabled - start >= 1000);
});

test('stability under high load', async t => {
	const limit = 5;
	const interval = 100;
	const throttled = pThrottle({limit, interval})(() => Date.now());
	const promises = [];

	for (let i = 0; i < 100; i++) {
		promises.push(throttled());
	}

	const results = await Promise.all(promises);
	t.is(results.length, 100);
});

test('handles zero interval', async t => {
	const throttled = pThrottle({limit: 1, interval: 0})(() => Date.now());
	const start = Date.now();
	await throttled();
	const end = Date.now();
	t.true(end - start < 50); // Small buffer to account for execution time
});

test('handles simultaneous calls', async t => {
	const limit = 5;
	const interval = 100;
	const throttled = pThrottle({limit, interval})(() => Date.now());
	const times = await Promise.all(Array.from({length: limit}).map(() => throttled()));

	// Ensure all calls are within the same interval
	for (let i = 1; i < times.length; i++) {
		t.true(times[i] - times[0] < interval);
	}
});

test('clears queue after abort', async t => {
	const limit = 2;
	const interval = 100;
	const throttled = pThrottle({limit, interval})(() => Date.now());

	try {
		await throttled();
		await throttled();
	} catch {}

	throttled.abort();

	t.is(throttled.queueSize, 0);
});

test('allows immediate execution with high limit', async t => {
	const limit = 10;
	const interval = 100;
	const throttled = pThrottle({limit, interval})(() => Date.now());
	const start = Date.now();
	const promises = Array.from({length: 5}, () => throttled());
	const results = await Promise.all(promises);
	const end = Date.now();

	for (const time of results) {
		t.true(time - start < 50);
	}

	t.true(end - start < 100);
});

test('queues calls beyond limit', async t => {
	const limit = 2;
	const interval = 100;
	const throttled = pThrottle({limit, interval})(() => Date.now());
	const start = Date.now();

	const firstBatch = Promise.all([throttled(), throttled()]);
	await delay(50); // Ensure the first batch is within the limit
	const secondBatch = Promise.all([throttled(), throttled()]);

	const results = await Promise.all([firstBatch, secondBatch]);
	const end = Date.now();

	// Check that the second batch was executed after the interval
	for (const time of results[1]) {
		t.true(time - start >= interval);
	}

	t.true(end - start >= interval);
});

test('resets interval after inactivity', async t => {
	const limit = 1;
	const interval = 100;
	const throttled = pThrottle({limit, interval})(() => Date.now());

	const firstCall = await throttled();
	await delay(interval + 50); // Inactivity longer than the interval
	const secondCall = await throttled();

	t.true(secondCall - firstCall >= interval + 50);
});

test('maintains function execution order', async t => {
	const limit = 2;
	const interval = 100;
	const throttled = pThrottle({limit, interval})(async value => value);
	const results = await Promise.all([throttled(1), throttled(2), throttled(3)]);

	t.deepEqual(results, [1, 2, 3]);
});

test('handles extremely short intervals', async t => {
	const limit = 1;
	const interval = 1; // Very short interval
	const throttled = pThrottle({limit, interval})(() => {});
	await throttled();
	await delay(5); // Slight delay
	await throttled();
	t.pass(); // If it gets here without error, the test passes
});

test('executes immediately for limit greater than calls', async t => {
	const limit = 10;
	const interval = 100;
	const throttled = pThrottle({limit, interval})(() => Date.now());
	const start = Date.now();
	const results = await Promise.all([throttled(), throttled()]);
	const end = Date.now();

	for (const time of results) {
		t.true(time - start < 50);
	}

	t.true(end - start < 100);
});

test('manages rapid successive calls', async t => {
	const limit = 3;
	const interval = 50;
	const throttled = pThrottle({limit, interval})(() => Date.now());
	const results = [];

	for (let i = 0; i < 10; i++) {
		results.push(throttled());

		// eslint-disable-next-line no-await-in-loop
		await delay(10); // Small delay between calls
	}

	await Promise.all(results);
	t.pass(); // Test passes if all promises resolve without error
});

test('onDelay', async t => {
	let delayedCounter = 0;
	const limit = 10;
	const interval = 100;
	const delayedExecutions = 20;
	const onDelay = () => delayedCounter++;
	const throttled = pThrottle({limit, interval, onDelay})(() => Date.now());
	const promises = [];

	for (let index = 0; index < limit; index++) {
		promises.push(throttled());
	}

	t.is(delayedCounter, 0);

	for (let index = 0; index < delayedExecutions; index++) {
		promises.push(throttled());
	}

	t.is(delayedCounter, delayedExecutions);

	await Promise.all(promises);
});
