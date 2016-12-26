import test from 'ava';
import inRange from 'in-range';
import timeSpan from 'time-span';
import m from './';

const fixture = Symbol('fixture');

test('main', async t => {
	const totalRuns = 100;
	const limit = 5;
	const interval = 100;
	const end = timeSpan();
	const throttled = m(async () => {}, limit, interval);

	await Promise.all(Array(totalRuns).fill(0).map(throttled));

	const totalTime = (totalRuns * interval) / limit;
	t.true(inRange(end(), totalTime - 100, totalTime + 100));
});

test('passes arguments through', async t => {
	const throttled = m(async x => x, 1, 100);
	t.is(await throttled(fixture), fixture);
});

test('can be aborted', async t => {
	const limit = 1;
	const interval = 10000; // 10 seconds
	const end = timeSpan();
	const throttled = m(async () => {}, limit, interval);

	await throttled();
	const p = throttled();
	throttled.abort();
	let error;
	try {
		await p;
	} catch (err) {
		error = err;
	}
	t.is(error.message, 'Throttled function aborted');
	t.true(end() < 100);
});
