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

	await Promise.all(new Array(totalRuns).fill(0).map(x => throttled(x)));

	const totalTime = (totalRuns * interval) / limit;
	t.true(inRange(end(), {
		start: totalTime - 200,
		end: totalTime + 200
	}));
});

test('strict mode', async t => {
	const totalRuns = 100;
	const limit = 5;
	const interval = 100;
	const strict = true;
	const end = timeSpan();
	const throttled = pThrottle({limit, interval, strict})(async () => {});

	await Promise.all(new Array(totalRuns).fill(0).map(x => throttled(x)));

	const totalTime = (totalRuns * interval) / limit;
	t.true(inRange(end(), {
		start: totalTime - 200,
		end: totalTime + 200
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

	for (let i = 0; i < limit + 1; i++) {
		promises.push(throttled());
	}

	const results = await Promise.all(promises);

	for (const [index, executed] of results.entries()) {
		const elapsed = executed - start;
		if (index < limit - 1) {
			t.true(inRange(elapsed, {start: pause, end: pause + 10}), 'Executed immediately after the pause');
		} else if (index === limit - 1) {
			t.true(inRange(elapsed, {start: interval, end: interval + 10}), 'Executed after the interval');
		} else {
			const difference = executed - results[index - limit];
			t.true(inRange(difference, {start: interval - 10, end: interval + 10}), 'Waited the interval');
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

	for (let i = 0; i < limit + 1; i++) {
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
	const interval = 10000; // 10 seconds
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

	t.true(error instanceof pThrottle.AbortError);
	t.true(end() < 100);
});
