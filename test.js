import test from 'ava';
import inRange from 'in-range';
import timeSpan from 'time-span';
import pThrottle from '.';

const fixture = Symbol('fixture');

test('main', async t => {
	const totalRuns = 100;
	const limit = 5;
	const interval = 100;
	const end = timeSpan();
	const throttled = pThrottle({limit, interval})(async () => {});

	await Promise.all(new Array(totalRuns).fill(0).map(throttled));

	const totalTime = (totalRuns * interval) / limit;
	t.true(inRange(end(), totalTime - 200, totalTime + 200));
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
	} catch (error2) {
		error = error2;
	}

	t.true(error instanceof pThrottle.AbortError);
	t.true(end() < 100);
});
