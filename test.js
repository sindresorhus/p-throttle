/* eslint-disable node/no-deprecated-api */
import test from 'ava';
import inRange from 'in-range';
import timeSpan from 'time-span';
import delay from 'delay';
import pThrottle from '.';

const {Timer} = process.binding('timer_wrap');
const fixture = Symbol('fixture');

test('main', async t => {
	const totalRuns = 100;
	const limit = 5;
	const interval = 100;
	const end = timeSpan();
	const throttled = pThrottle(async () => {}, limit, interval);

	await Promise.all(new Array(totalRuns).fill(0).map(throttled));

	const totalTime = (totalRuns * interval) / limit;
	t.true(inRange(end(), totalTime - 100, totalTime + 100));
});

test('passes arguments through', async t => {
	const throttled = pThrottle(async x => x, 1, 100);
	t.is(await throttled(fixture), fixture);
});

test('can be aborted', async t => {
	const limit = 1;
	const interval = 10000; // 10 seconds
	const end = timeSpan();
	const throttled = pThrottle(async () => {}, limit, interval);

	await throttled();
	const promise = throttled();
	throttled.abort();
	let error;
	try {
		await promise;
	} catch (error2) {
		error = error2;
	}

	t.true(error instanceof pThrottle.AbortError);
	t.true(end() < 100);
});

test('exits immediately', async t => {
	const limit = 2;
	const interval = 1000;
	const throttled = pThrottle(() => Promise.resolve(), limit, interval);

	for (let i = 1; i <= 3; i++) {
		throttled();
	}

	await throttled();

	// New tick, because the promise may be finished while the timer *is* pending
	await delay(1);
	const timers = process._getActiveHandles().filter(handle => {
		// Check if the handle is a `Timer` that matches the interval
		return handle instanceof Timer && handle._list.msecs === interval;
	});
	t.is(timers.length, 0);
});
