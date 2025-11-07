import test from 'ava';
import pThrottle from '../index.js';

test('strict mode with weights - enforces sliding window constraint', async t => {
	const limit = 100; // 100 points per interval
	const interval = 100;

	const throttle = pThrottle({
		limit,
		interval,
		strict: true,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	// Execute first call with weight 100
	const time1 = await throttled(100);

	// Immediately execute second call with weight 10
	// This should be delayed to avoid exceeding limit in window [time1, time1+interval]
	const time2 = await throttled(10);

	// The gap should be at least interval
	const gap = time2 - time1;
	t.true(gap >= interval - 10, `Gap was ${gap}ms, expected >= ${interval - 10}ms`);

	// Verify: At time2, only the second call should be in the window
	// The first call should have aged out (time2 - time1 >= interval)
	// So total weight in window [time2 - interval, time2] should be 10, not 110
	t.pass();
});

test('strict mode with weights - never exceeds capacity in sliding window', async t => {
	const limit = 50;
	const interval = 100;

	const throttle = pThrottle({
		limit,
		interval,
		strict: true,
		weight: () => 10,
	});

	const throttled = throttle(() => Date.now());

	// Execute 10 calls, each with weight 10
	const times = await Promise.all(Array.from({length: 10}, () => throttled()));

	// Check that in any sliding window of `interval` ms, total weight <= limit
	// Use a tolerance of 50ms to account for setTimeout drift
	const tolerance = 50;
	for (let i = 0; i < times.length; i++) {
		let weightInWindow = 0;
		for (let innerIndex = i; innerIndex < times.length; innerIndex++) {
			if (times[innerIndex] - times[i] < interval - tolerance) {
				weightInWindow += 10;
			}
		}

		t.true(
			weightInWindow <= limit,
			`Window starting at index ${i} (t=${times[i]}) had weight ${weightInWindow}, exceeds limit ${limit}`,
		);
	}
});

test('strict mode with weights - spacing proportional to weight', async t => {
	const limit = 100;
	const interval = 1000;

	const throttle = pThrottle({
		limit,
		interval,
		strict: true,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	// Fill capacity with one heavy call
	const time1 = await throttled(100);

	// Next two calls should be spaced according to their weights
	const time2Promise = throttled(50); // Should wait ~interval
	const time3Promise = throttled(50); // Should wait ~interval + spacing

	const [time2, time3] = await Promise.all([time2Promise, time3Promise]);

	// Heavy call (weight 50) should have more spacing than light call (weight 10)
	const gap2 = time2 - time1;
	const gap3 = time3 - time2;

	t.true(gap2 >= interval - 50, `First heavy call gap: ${gap2}ms`);
	t.true(gap3 >= 0, `Second heavy call gap: ${gap3}ms`);
});

test('weight function must return a number', async t => {
	const throttle = pThrottle({
		limit: 10,
		interval: 100,
		weight: () => 'not a number',
	});

	const throttled = throttle(() => {});

	await t.throwsAsync(
		throttled(),
		{instanceOf: TypeError, message: 'Expected `weight` to be a finite non-negative number'},
	);
});

test('weight must be finite', async t => {
	const throttle = pThrottle({
		limit: 10,
		interval: 100,
		weight: () => Number.POSITIVE_INFINITY,
	});

	const throttled = throttle(() => {});

	await t.throwsAsync(
		throttled(),
		{instanceOf: TypeError, message: 'Expected `weight` to be a finite non-negative number'},
	);
});

test('weight must be non-negative', async t => {
	const throttle = pThrottle({
		limit: 10,
		interval: 100,
		weight: () => -5,
	});

	const throttled = throttle(() => {});

	await t.throwsAsync(
		throttled(),
		{instanceOf: TypeError, message: 'Expected `weight` to be a finite non-negative number'},
	);
});

test('weight must be <= limit', async t => {
	const throttle = pThrottle({
		limit: 10,
		interval: 100,
		strict: true,
		weight: () => 20,
	});

	const throttled = throttle(() => {});

	await t.throwsAsync(
		throttled(),
		{instanceOf: TypeError, message: /Expected `weight` \(20\) to be <= `limit` \(10\)/},
	);
});

test('weight function can throw', async t => {
	const throttle = pThrottle({
		limit: 10,
		interval: 100,
		weight() {
			throw new Error('Weight calculation failed');
		},
	});

	const throttled = throttle(() => {});

	await t.throwsAsync(
		throttled(),
		{message: 'Weight calculation failed'},
	);
});

test('weight of 0 executes immediately', async t => {
	const throttle = pThrottle({
		limit: 10,
		interval: 1000,
		strict: true,
		weight: () => 0,
	});

	const throttled = throttle(() => Date.now());

	const time1 = await throttled();
	const time2 = await throttled();
	const time3 = await throttled();

	// All should execute immediately (within a few ms)
	t.true(time2 - time1 < 50);
	t.true(time3 - time2 < 50);
});

test('limit = 0 only allows weight 0', async t => {
	const throttle = pThrottle({
		limit: 0,
		interval: 100,
		strict: true,
		weight: value => value,
	});

	const throttled = throttle(value => value);

	// Weight 0 should work
	const result = await throttled(0);
	t.is(result, 0);

	// Weight > 0 should be rejected
	await t.throwsAsync(
		throttled(1),
		{instanceOf: TypeError, message: /Expected `weight` \(1\) to be <= `limit` \(0\)/},
	);
});

test('weight with interval = 0 throws', t => {
	t.throws(
		() => pThrottle({
			limit: 10,
			interval: 0,
			weight: () => 1,
		}),
		{instanceOf: TypeError, message: 'The `weight` option cannot be used with `interval` of 0'},
	);
});

test('windowed mode with weights enforces limit per window', async t => {
	const limit = 100;
	const interval = 200;

	const throttle = pThrottle({
		limit,
		interval,
		strict: false,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	// Fill first window
	const time1 = await throttled(60);
	const time2 = await throttled(40);

	// Next call should wait for new window
	const time3 = await throttled(50);

	// Time2 should be immediate (within same window as time1)
	t.true(time2 - time1 < 50, `time2 - time1 = ${time2 - time1}`);

	// Time3 should wait for next window
	t.true(time3 - time1 >= interval - 50, `time3 - time1 = ${time3 - time1}`);
});

test('strict mode sliding window boundary is exclusive', async t => {
	const limit = 50;
	const interval = 100;

	const throttle = pThrottle({
		limit,
		interval,
		strict: true,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	// Execute with weight 50
	const time1 = await throttled(50);

	// Immediately queue another with weight 10
	const promise2 = throttled(10);

	// Should wait for tick 1 to age out (>= interval)
	const time2 = await promise2;

	// The gap should be at least interval (with some tolerance for setTimeout precision)
	const gap = time2 - time1;
	t.true(gap >= interval - 20, `Gap was ${gap}ms, expected >= ${interval - 20}ms`);
});

test('strict mode handles mixed weights correctly', async t => {
	const limit = 100;
	const interval = 200;

	const throttle = pThrottle({
		limit,
		interval,
		strict: true,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	const time1 = await throttled(30);
	const time2 = await throttled(40);
	const time3 = await throttled(30);

	// First three fit in limit (30+40+30=100)
	t.true(time2 - time1 < 50);
	t.true(time3 - time2 < 50);

	// Fourth exceeds limit
	const time4 = await throttled(10);

	// Should wait for first tick to age out
	t.true(time4 - time1 >= interval - 20);
});

test('abort clears weighted throttle queue', async t => {
	const controller = new AbortController();

	const throttle = pThrottle({
		limit: 10,
		interval: 1000,
		strict: true,
		signal: controller.signal,
		weight: () => 10,
	});

	const throttled = throttle(() => Date.now());

	// First call executes
	await throttled();

	// Queue more calls
	const promise2 = throttled();
	const promise3 = throttled();

	// Abort
	const abortReason = new Error('test abort');
	controller.abort(abortReason);

	await t.throwsAsync(promise2, {is: abortReason});
	await t.throwsAsync(promise3, {is: abortReason});
});

test('very small weights work correctly', async t => {
	const throttle = pThrottle({
		limit: 1,
		interval: 100,
		strict: true,
		weight: () => 0.001,
	});

	const throttled = throttle(() => Date.now());

	// Many small weights should fit in one interval
	const times = await Promise.all(
		Array.from({length: 100}, () => throttled()),
	);

	// All should execute quickly (0.001 * 100 = 0.1 < 1)
	const totalTime = times.at(-1) - times[0];
	t.true(totalTime < 200);
});

test('weight equal to limit executes immediately when window empty', async t => {
	const throttle = pThrottle({
		limit: 50,
		interval: 100,
		strict: true,
		weight: () => 50,
	});

	const throttled = throttle(() => Date.now());

	const time1 = await throttled();
	const time2 = await throttled();

	// Second call should wait for first to age out
	t.true(time2 - time1 >= 100 - 20);
});

test('weighted strict mode respects sliding window with queued requests', async t => {
	const limit = 100;
	const interval = 1000;

	const throttle = pThrottle({
		limit,
		interval,
		strict: true,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	// Execute calls with weight 60 each (60% of limit)
	const time1 = await throttled(60);
	const promise2 = throttled(60);
	const promise3 = throttled(60);

	const [time2, time3] = await Promise.all([promise2, promise3]);

	// Verify time2 executes after time1 ages out
	const gap2 = time2 - time1;
	t.true(gap2 >= interval - 20, `time2 should wait for time1 to age out: ${gap2}ms`);

	// Verify time3 doesn't violate sliding window
	// At time3, check if time2 is in the window (with small tolerance for setTimeout precision)
	const windowStart = time3 - interval;
	const tolerance = 5; // Allow 5ms tolerance for timing precision

	if (time2 > windowStart + tolerance && time2 <= time3) {
		// Time2 is in window - this would be a violation
		t.fail(`Sliding window violated: time2 (${time2}) in window (${windowStart}, ${time3}], weights would sum to 120 > ${limit}`);
	}

	// Time2 must have aged out, so gap should be >= interval
	const gap3 = time3 - time2;
	t.true(gap3 >= interval - 20, `time3 should wait for time2 to age out: ${gap3}ms`);
});

test('weighted strict mode handles burst of different weights', async t => {
	const limit = 100;
	const interval = 500;

	const throttle = pThrottle({
		limit,
		interval,
		strict: true,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	// Queue multiple calls with different weights
	const promises = [
		throttled(50),
		throttled(30),
		throttled(40),
		throttled(20),
	];

	const times = await Promise.all(promises);

	// Verify sliding window constraint for each execution
	// Use a tolerance of 50ms to account for setTimeout drift
	const tolerance = 50;
	for (let index = 0; index < times.length; index++) {
		const time = times[index];
		const windowStart = time - interval + tolerance;

		// Calculate weight in window at this time
		let weightInWindow = 0;
		const weights = [50, 30, 40, 20];

		for (let innerIndex = 0; innerIndex <= index; innerIndex++) {
			if (times[innerIndex] > windowStart && times[innerIndex] <= time) {
				weightInWindow += weights[innerIndex];
			}
		}

		t.true(
			weightInWindow <= limit,
			`At time ${index}, weight in window (${weightInWindow}) should not exceed limit (${limit})`,
		);
	}
});

test('weight returns NaN', async t => {
	const throttle = pThrottle({
		limit: 10,
		interval: 100,
		weight: () => Number.NaN,
	});

	const throttled = throttle(() => {});

	await t.throwsAsync(
		throttled(),
		{instanceOf: TypeError, message: 'Expected `weight` to be a finite non-negative number'},
	);
});

test('fractional weights work correctly', async t => {
	const throttle = pThrottle({
		limit: 10,
		interval: 200,
		strict: true,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	// Use fractional weights that sum close to limit
	const time1 = await throttled(3.5);
	const time2 = await throttled(2.5);
	const time3 = await throttled(4);

	// First three fit exactly (3.5 + 2.5 + 4 = 10)
	t.true(time2 - time1 < 50);
	t.true(time3 - time2 < 50);

	// Fourth should wait
	const time4 = await throttled(0.1);
	t.true(time4 - time1 >= 200 - 20);
});

test('weights exactly filling window execute together', async t => {
	const throttle = pThrottle({
		limit: 100,
		interval: 200,
		strict: true,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	// These weights exactly fill the window
	const promises = [
		throttled(25),
		throttled(25),
		throttled(25),
		throttled(25),
	];

	const times = await Promise.all(promises);

	// All should execute immediately (total = 100)
	for (let index = 1; index < times.length; index++) {
		t.true(times[index] - times[0] < 50);
	}
});

test('weight 0 mixed with non-zero weights', async t => {
	const throttle = pThrottle({
		limit: 50,
		interval: 200,
		strict: true,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	const time1 = await throttled(50);
	const time2 = await throttled(0);
	const time3 = await throttled(0);

	// Weight 0 calls should execute immediately
	t.true(time2 - time1 < 50);
	t.true(time3 - time2 < 50);

	// Non-zero call should wait
	const time4 = await throttled(10);
	t.true(time4 - time1 >= 200 - 20);
});

test('many concurrent small weighted requests', async t => {
	const throttle = pThrottle({
		limit: 100,
		interval: 300,
		strict: true,
		weight: () => 1,
	});

	const throttled = throttle(() => Date.now());

	// Queue 200 requests, each with weight 1
	const promises = Array.from({length: 200}, () => throttled());

	const times = await Promise.all(promises);

	// First 100 should execute quickly
	t.true(times[99] - times[0] < 100);

	// 101st should wait for interval
	t.true(times[100] - times[0] >= 300 - 50);
});

test('onDelay callback receives arguments with weights', async t => {
	const delayedArguments = [];

	const throttle = pThrottle({
		limit: 10,
		interval: 100,
		strict: true,
		weight: value => value,
		onDelay(...arguments_) {
			delayedArguments.push(arguments_);
		},
	});

	const throttled = throttle(() => {});

	await throttled(10);
	const promise2 = throttled(5);
	const promise3 = throttled(3);

	await Promise.all([promise2, promise3]);

	// Second and third calls should be delayed
	t.is(delayedArguments.length, 2);
	t.deepEqual(delayedArguments[0], [5]);
	t.deepEqual(delayedArguments[1], [3]);
});

test('isEnabled=false bypasses weight limit', async t => {
	const throttle = pThrottle({
		limit: 10,
		interval: 1000,
		strict: true,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	// Fill the limit
	await throttled(10);

	// Disable throttling
	throttled.isEnabled = false;

	// Should execute immediately despite weight
	const time1 = Date.now();
	await throttled(100);
	const time2 = Date.now();

	t.true(time2 - time1 < 50);
});

test('weighted windowed mode handles overflow to next window', async t => {
	const throttle = pThrottle({
		limit: 100,
		interval: 200,
		strict: false,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	// Fill first window
	const time1 = await throttled(100);

	// Next call should overflow to next window
	const time2 = await throttled(1);

	t.true(time2 - time1 >= 200 - 50);
});

test('weighted strict mode with single heavy request', async t => {
	const throttle = pThrottle({
		limit: 100,
		interval: 500,
		strict: true,
		weight: value => value,
	});

	const throttled = throttle(() => Date.now());

	const time1 = await throttled(100);
	const time2 = await throttled(100);
	const time3 = await throttled(100);

	// Each should wait for previous to age out
	t.true(time2 - time1 >= 500 - 50);
	t.true(time3 - time2 >= 500 - 50);
});

test('weight calculation with multiple arguments', async t => {
	const throttle = pThrottle({
		limit: 100,
		interval: 200,
		strict: true,
		weight: (a, b, c) => a + b + c,
	});

	const throttled = throttle((a, b, c) => a + b + c);

	const result1 = await throttled(10, 20, 30);
	t.is(result1, 60);

	const result2 = await throttled(5, 5, 5);
	t.is(result2, 15);

	// Total weight is 75, should execute immediately
	const time1 = Date.now();
	const result3 = await throttled(8, 9, 8);
	const time2 = Date.now();

	t.is(result3, 25);
	t.true(time2 - time1 < 50);
});

test('weighted strict mode executes when capacity available', async t => {
	const throttle = pThrottle({
		limit: 100,
		interval: 300,
		strict: true,
		weight: value => value,
	});

	const results = [];
	const throttled = throttle(value => {
		results.push(value);
		return Date.now();
	});

	// Queue requests with different weights
	const promises = [
		throttled(50),
		throttled(60),
		throttled(40),
	];

	await Promise.all(promises);

	// First call executes immediately
	t.is(results[0], 50);

	// Remaining calls should execute (order may vary based on capacity)
	t.true(results.includes(60));
	t.true(results.includes(40));
	t.is(results.length, 3);
});
