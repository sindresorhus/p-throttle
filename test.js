import test from 'ava';
import inRange from 'in-range';
import timeSpan from 'time-span';
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

test('limits after pause', async t => {
	const limit = 10;
	const interval = 1010;
	const throttled = pThrottle({limit, interval})(() => Date.now());

	const promises = [];

	await throttled(0);

	await new Promise(resolve => {
		setTimeout(resolve, interval / 2);
	});

	const start = Date.now();

	for (let i = 0; i < 11; i++) {
		promises.push(throttled(i));
	}

	const results = await Promise.all(promises);

	results.forEach((executed, index) => {
		if (index < 10) {
			const elapsed = executed - start;
			t.true(inRange(elapsed, {start: 0, end: interval}), 'Executed in first interval');
		} else {
			const difference = executed - results[index - limit];
			t.true(inRange(difference, {start: interval - 10, end: interval + 10}), 'Waited the interval');
		}
	});
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
