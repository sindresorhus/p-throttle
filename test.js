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
