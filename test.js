import {setMaxListeners} from 'node:events';
import test from 'ava';
import inRange from 'in-range';
import timeSpan from 'time-span';
import delay from 'delay';
import pThrottle from './index.js';

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

test('guarantees last call execution with correct context and arguments', async t => {
	const throttled = pThrottle({limit: 2, interval: 100})(function (value) {
		return {context: this, value};
	});

	const context = {id: 'test-context'};
	const lastArgument = 'last-call';

	// Fire multiple calls
	const results = [
		throttled.call(context, 'first'),
		throttled.call(context, 'second'),
		throttled.call(context, 'third'),
		throttled.call(context, lastArgument), // Last call
	];

	const resolvedResults = await Promise.all(results);

	// Verify all calls executed
	t.is(resolvedResults.length, 4);

	// Verify last call executed with correct context and argument
	const lastResult = resolvedResults[3];
	t.is(lastResult.context, context);
	t.is(lastResult.value, lastArgument);

	// Verify all calls preserved their arguments
	t.is(resolvedResults[0].value, 'first');
	t.is(resolvedResults[1].value, 'second');
	t.is(resolvedResults[2].value, 'third');
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

test('throw if aborted', t => {
	const error = t.throws(() => {
		const controller = new AbortController();
		controller.abort(new Error('aborted'));
		pThrottle({limit: 1, interval: 100, signal: controller.signal})(async x => x);
	});

	t.is(error.message, 'aborted');
});

test('can be aborted', async t => {
	const limit = 1;
	const interval = 10_000; // 10 seconds
	const end = timeSpan();
	const controller = new AbortController();
	const throttled = pThrottle({limit, interval, signal: controller.signal})(async () => {});

	await throttled();
	const promise = throttled();
	controller.abort(new Error('aborted'));

	const error = await t.throwsAsync(promise);
	t.is(error.message, 'aborted');
	t.true(end() < 100);
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

test('isEnabled=false does not cancel already queued items', async t => {
	const interval = 100;
	const throttled = pThrottle({limit: 1, interval})(() => Date.now());
	const first = await throttled();
	const queued = throttled(); // Will be queued
	throttled.isEnabled = false; // Disable after queueing
	const resolved = await queued; // Should still resolve
	const delta = resolved - first;
	t.true(inRange(delta, {start: interval - 10, end: interval + 50}));
});

test('double abort is safe', async t => {
	const controller = new AbortController();
	const throttled = pThrottle({limit: 1, interval: 100, signal: controller.signal})(() => Date.now());
	await throttled();
	const p1 = throttled();
	const p2 = throttled();
	controller.abort('R');
	controller.abort('R'); // Second abort should be a no-op
	const [r1, r2] = await Promise.allSettled([p1, p2]);
	if (r1.status === 'rejected') {
		t.is(r1.reason, 'R');
	}

	if (r2.status === 'rejected') {
		t.is(r2.reason, 'R');
	}

	t.is(throttled.queueSize, 0);
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

test('handles zero interval in strict mode with no delays and no onDelay', async t => {
	const seen = [];
	const throttled = pThrottle({
		limit: 3,
		interval: 0,
		strict: true,
		onDelay: (...arguments_) => seen.push(arguments_),
	})(() => Date.now());
	const start = Date.now();
	const results = await Promise.all([throttled(), throttled(), throttled(), throttled(), throttled()]);
	const end = Date.now();
	for (const time of results) {
		t.true(time - start < 50);
	}

	t.true(end - start < 50);
	t.deepEqual(seen, []);
});

test('invalid options throw', t => {
	t.throws(() => {
		pThrottle({limit: -1, interval: 100})(() => {});
	}, {message: 'Expected `limit` to be >= 0'});

	t.throws(() => {
		pThrottle({limit: 1, interval: -1})(() => {});
	}, {message: 'Expected `interval` to be >= 0'});
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
	const limit = 1;
	const interval = 100;
	const controller = new AbortController();
	const throttled = pThrottle({limit, interval, signal: controller.signal})(() => Date.now());

	await throttled(); // Immediate
	const queued = throttled(); // Queued due to limit

	controller.abort('aborted');

	const [result] = await Promise.allSettled([queued]);
	t.is(result.status, 'rejected');
	t.is(result.reason, 'aborted');
	t.is(throttled.queueSize, 0);
});

test('abort resets windowed counters so next call is not delayed', async t => {
	const limit = 1;
	const interval = 100;
	const controller = new AbortController();
	setMaxListeners(0, controller.signal);
	const throttled = pThrottle({limit, interval, signal: controller.signal})(() => Date.now());

	await throttled(); // Uses capacity, sets window
	const queued = throttled(); // Queued into next window

	controller.abort('stop');
	const [r] = await Promise.allSettled([queued]);
	t.is(r.status, 'rejected');
	t.is(r.reason, 'stop');

	const start = Date.now();
	const time = await throttled();
	t.true(time - start < 50);
});

test('abort resets strict counters so next call is not delayed', async t => {
	const limit = 1;
	const interval = 100;
	const controller = new AbortController();
	const throttled = pThrottle({
		limit,
		interval,
		strict: true,
		signal: controller.signal,
	})(() => Date.now());

	await throttled(); // Uses capacity
	const queued = throttled(); // Queued by strict algorithm

	controller.abort('stop');
	const [r] = await Promise.allSettled([queued]);
	t.is(r.status, 'rejected');
	t.is(r.reason, 'stop');

	const start = Date.now();
	const time = await throttled();
	t.true(time - start < 50);
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

	// Use the actual timestamps of the first window as the anchor
	const firstBatchPromise = Promise.all([throttled(), throttled()]);
	await delay(50); // Schedule next calls within the same window
	const secondBatchPromise = Promise.all([throttled(), throttled()]);

	const [firstBatch, secondBatch] = await Promise.all([firstBatchPromise, secondBatchPromise]);

	const anchor = Math.min(...firstBatch);
	const epsilon = 5; // Allow tiny jitter from timers/clock rounding

	// Second batch should run in the next window relative to the first
	for (const time of secondBatch) {
		t.true(time - anchor >= (interval - epsilon));
	}
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

test('windowed with interval 0 executes all immediately without onDelay', async t => {
	const seen = [];
	const throttled = pThrottle({
		limit: 2,
		interval: 0,
		onDelay: (...arguments_) => seen.push(arguments_),
	})(() => Date.now());

	const start = Date.now();
	const results = await Promise.all([throttled(), throttled(), throttled(), throttled(), throttled()]);
	for (const time of results) {
		t.true(time - start < 50);
	}

	t.deepEqual(seen, []);
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
	const delayedIndices = [];
	const limit = 10;
	const interval = 100;
	const delayedExecutions = 20;
	const onDelay = (keyPrefix, index) => {
		delayedIndices.push(keyPrefix + index);
	};

	const throttled = pThrottle({limit, interval, onDelay})((_keyPrefix, _index) => Date.now());
	const promises = [];

	for (let index = 0; index < limit; index++) {
		promises.push(throttled('a', index));
	}

	t.deepEqual(delayedIndices, []);

	for (let index = 0; index < delayedExecutions; index++) {
		promises.push(throttled('b', index));
	}

	t.like(delayedIndices, {
		0: 'b0',
		1: 'b1',
		19: 'b19',
		20: undefined,
	});

	await Promise.all(promises);
});

test('onDelay receives arguments for blocked calls (limit 0)', async t => {
	const seen = [];
	const controller = new AbortController();
	const throttled = pThrottle({
		limit: 0,
		interval: 100,
		signal: controller.signal,
		onDelay: (a, b) => seen.push([a, b]),
	})((a, b) => [a, b]);

	const p1 = throttled('x', 1);
	const p2 = throttled('y', 2);

	// Still pending before abort. onDelay must have been called at least once with the latest args
	await delay(20);
	// At least one onDelay should have fired with the latest arguments
	t.deepEqual(seen[0], ['y', 2]);

	controller.abort('Z');
	const [r1, r2] = await Promise.allSettled([p1, p2]);
	if (r1.status === 'rejected') {
		t.is(r1.reason, 'Z');
	}

	if (r2.status === 'rejected') {
		t.is(r2.reason, 'Z');
	}
});

test('onDelay exceptions do not affect execution', async t => {
	const limit = 1;
	const interval = 50;
	const seen = [];
	const onDelay = value => {
		seen.push(value);
		throw new Error('listener failed');
	};

	const throttled = pThrottle({limit, interval, onDelay})(x => x);

	const a = await throttled('a');
	const bPromise = throttled('b'); // Will be delayed, onDelay throws

	t.is(a, 'a');
	const b = await bPromise;
	t.is(b, 'b');
	t.deepEqual(seen, ['b']);
});

test('onDelay fires for delayed calls even if later aborted', async t => {
	const limit = 1;
	const interval = 100;
	const controller = new AbortController();
	setMaxListeners(0, controller.signal);

	const seen = [];
	const onDelay = value => {
		seen.push(value);
	};

	const throttled = pThrottle({
		limit,
		interval,
		signal: controller.signal,
		onDelay,
	})(value => value);

	const first = throttled('a');
	const second = throttled('b'); // This will be delayed -> onDelay('b')

	controller.abort('stop');

	const [r1, r2] = await Promise.allSettled([first, second]);

	// Ensure onDelay captured the delayed value 'b'
	t.deepEqual(seen, ['b']);

	// Second should be rejected due to abort
	if (r2.status === 'rejected') {
		t.is(r2.reason, 'stop');
	} else {
		t.fail('Expected second call to be rejected');
	}

	// First may resolve or be rejected depending on timing; both acceptable
	if (r1.status === 'fulfilled') {
		t.is(r1.value, 'a');
	}

	// Queue must be empty
	t.is(throttled.queueSize, 0);
});

test('very short intervals preserve order and resolve (windowed and strict)', async t => {
	for (const strict of [false, true]) {
		const limit = 1;
		const interval = 1; // Very short
		const throttle = pThrottle({limit, interval, strict});
		const throttled = throttle(async x => x);
		const count = 25;
		const promises = [];
		for (let i = 0; i < count; i++) {
			promises.push(throttled(i));
		}

		// eslint-disable-next-line no-await-in-loop
		const results = await Promise.all(promises);
		// Order preserved
		t.deepEqual(results, Array.from({length: count}, (_, i) => i));
	}
});

test('supports errors in the throttled function', async t => {
	const limit = 1;
	const interval = 100;
	const pause = 1;
	const throttle = pThrottle({limit, interval});

	const syncFunction = () => {
		throw new Error('test error');
	};

	const throttledSync = throttle(syncFunction);

	const asyncFunction = async () => {
		await delay(pause);
		throw new Error('test error');
	};

	const throttledAsync = throttle(asyncFunction);

	await throttle(() => {})(); // Create a delay

	await t.throwsAsync(throttledSync, {message: 'test error'}); // Has delay

	await t.throwsAsync(throttledAsync, {message: 'test error'}); // Has delay
});

test('shared signal abort clears queues (windowed and strict)', async t => {
	for (const strict of [false, true]) {
		const controller = new AbortController();
		setMaxListeners(0, controller.signal);
		const limit = strict ? 2 : 1;
		const interval = 100;
		const instances = 24;
		const throttledFunctions = [];
		const promises = [];

		for (let i = 0; i < instances; i++) {
			const throttled = pThrottle({
				limit,
				interval,
				strict,
				signal: controller.signal,
			})(() => Date.now());
			throttledFunctions.push(throttled);
			promises.push(throttled(), throttled());
			if (strict) {
				promises.push(throttled());
			}
		}

		controller.abort('boom');

		// eslint-disable-next-line no-await-in-loop
		const results = await Promise.allSettled(promises);
		for (const result of results) {
			if (result.status === 'rejected') {
				t.is(result.reason, 'boom');
			}
		}

		for (const throttled of throttledFunctions) {
			t.is(throttled.queueSize, 0);
		}
	}
});

test('abort affects only instances using that signal', async t => {
	const controller = new AbortController();
	setMaxListeners(0, controller.signal);
	const withSignal = pThrottle({
		limit: 1,
		interval: 1000,
		signal: controller.signal,
	})(async () => 'with-signal');
	const withoutSignal = pThrottle({
		limit: 1,
		interval: 1000,
	})(async () => 'no-signal');

	const p1 = withSignal();
	const p2 = withSignal(); // Will be queued then aborted

	controller.abort('x');

	const [r1, r2] = await Promise.allSettled([p1, p2]);
	if (r1.status === 'rejected') {
		// First may race into queue and get aborted; tolerate either
		t.pass();
	} else {
		t.is(r1.value, 'with-signal');
	}

	if (r2.status === 'rejected') {
		t.is(r2.reason, 'x');
	} else {
		// Very unlikely, but allow if both resolved before abort
		t.is(r2.value, 'with-signal');
	}

	// Ensure the instance without a signal is unaffected
	const value = await withoutSignal();
	t.is(value, 'no-signal');
});

test('signal registration shared across multiple throttled functions', async t => {
	const controller = new AbortController();
	const {signal} = controller;

	const throttle = pThrottle({limit: 1, interval: 100, signal});
	const function1 = throttle(() => 'result1');
	const function2 = throttle(() => 'result2');

	await function1(); // Execute immediately
	const promise1 = function1(); // Queued
	const promise2 = function2(); // Queued

	controller.abort('shared-registration');

	const [result1, result2] = await Promise.allSettled([promise1, promise2]);
	t.is(result1.status, 'rejected');
	t.is(result1.reason, 'shared-registration');
	t.is(result2.status, 'rejected');
	t.is(result2.reason, 'shared-registration');
});

test('signal registration cleanup after abort', async t => {
	const controller = new AbortController();
	const throttle = pThrottle({limit: 1, interval: 100, signal: controller.signal});
	const function_ = throttle(() => 'result');

	function_(); // Execute immediately
	const promise = function_(); // Queue

	controller.abort('cleanup-test');

	const result = await Promise.allSettled([promise]);
	t.is(result[0].status, 'rejected');
	t.is(result[0].reason, 'cleanup-test');
	t.is(function_.queueSize, 0);
});

test('signal registration isolation between different signals', async t => {
	const controller1 = new AbortController();
	const controller2 = new AbortController();

	const throttle1 = pThrottle({limit: 1, interval: 200, signal: controller1.signal});
	const throttle2 = pThrottle({limit: 1, interval: 200, signal: controller2.signal});

	const function1 = throttle1(() => 'result1');
	const function2 = throttle2(() => 'result2');

	await function1(); // Execute immediately
	await function2(); // Execute immediately
	const promise1 = function1(); // Queued
	const promise2 = function2(); // Queued

	controller1.abort('signal1-abort');

	const result1 = await Promise.allSettled([promise1]);
	t.is(result1[0].status, 'rejected');
	t.is(result1[0].reason, 'signal1-abort');
	t.is(await promise2, 'result2');
});

test('shared signal abort rejects both blocked and windowed throttles', async t => {
	const controller = new AbortController();

	const blocked = pThrottle({
		limit: 0,
		interval: 100,
		signal: controller.signal,
	})(() => 'blocked');

	const windowed = pThrottle({
		limit: 1,
		interval: 100,
		signal: controller.signal,
	})(() => 'windowed');

	const p1 = blocked();
	const p2 = windowed();
	const p3 = windowed(); // Queued

	controller.abort('S');
	const [r1, r2, r3] = await Promise.allSettled([p1, p2, p3]);
	if (r1.status === 'rejected') {
		t.is(r1.reason, 'S');
	}

	if (r2.status === 'rejected') {
		t.is(r2.reason, 'S');
	}

	if (r3.status === 'rejected') {
		t.is(r3.reason, 'S');
	}
});

test('signal registration with complex abort reasons', async t => {
	const controller = new AbortController();
	const throttle = pThrottle({limit: 1, interval: 100, signal: controller.signal});
	const function_ = throttle(() => 'result');

	function_(); // Execute immediately
	const promise = function_(); // Queue

	const complexReason = {
		code: 'CUSTOM_ABORT',
		message: 'Complex abort reason',
		timestamp: Date.now(),
		nested: {data: [1, 2, 3]},
	};

	controller.abort(complexReason);

	const result = await Promise.allSettled([promise]);
	t.is(result[0].status, 'rejected');
	t.deepEqual(result[0].reason, complexReason);
});

test('bypassed calls while disabled do not affect future throttling state', async t => {
	const limit = 2;
	const interval = 200;
	const throttled = pThrottle({limit, interval})(() => Date.now());

	// Bypass throttling and make many calls quickly
	throttled.isEnabled = false;
	await Promise.all(Array.from({length: 20}, () => throttled()));
	throttled.isEnabled = true;

	// First calls after re-enable should behave as fresh
	const start = Date.now();
	const [a, b, c] = await Promise.all([throttled(), throttled(), throttled()]);

	// First two should be within the interval window; third should be after >= interval
	t.true(a - start < 50);
	t.true(b - start < 50);
	t.true(c - start >= interval - 10);
});

test('FinalizationRegistry WeakRef behavior with signal registration', async t => {
	const controller = new AbortController();
	const throttle = pThrottle({limit: 1, interval: 100, signal: controller.signal});

	const function1 = throttle(() => 'result1');
	const function2 = throttle(() => 'result2');

	await function1(); // Execute immediately
	await function2(); // Execute immediately

	const promise1 = function1(); // Queue
	const promise2 = function2(); // Queue

	controller.abort('weakref-test');

	const [result1, result2] = await Promise.allSettled([promise1, promise2]);
	t.is(result1.status, 'rejected');
	t.is(result1.reason, 'weakref-test');
	t.is(result2.status, 'rejected');
	t.is(result2.reason, 'weakref-test');
});
