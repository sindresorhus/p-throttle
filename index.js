'use strict';

class AbortError extends Error {
	constructor() {
		super('Throttled function aborted');
		this.name = 'AbortError';
	}
}

const pThrottle = (fn, limit, interval) => {
	if (!Number.isFinite(limit)) {
		throw new TypeError('Expected `limit` to be a finite number');
	}

	if (!Number.isFinite(interval)) {
		throw new TypeError('Expected `interval` to be a finite number');
	}

	const queue = [];
	const timeouts = new Set();

	let intervalEnd = Date.now() + interval;
	let activeCount = 0;
	let scheduleTimeoutId = null;

	const schedule = delay => {
		// There is a schedule pending, don't duplicate
		if (!scheduleTimeoutId) {
			const id = setTimeout(() => {
				// It's very important to delete the timeout *before* calling `tryToAdd()`,
				// because otherwise it wouldn't be able to schedule again
				// in case the limit was reached.
				timeouts.delete(id);
				scheduleTimeoutId = null;

				tryToAdd();
			}, delay);

			timeouts.add(id);
			scheduleTimeoutId = id;
		}
	};

	const next = () => {
		activeCount++;

		const x = queue.shift();
		x.resolve(fn.apply(x.self, x.args));
	};

	const tryToAdd = () => {
		// Check if a new interval has begun
		const now = Date.now();
		if (now > intervalEnd) {
			activeCount = 0;
			intervalEnd = now + interval;
		}

		// For all items in the queue
		while (queue.length) {
			if (activeCount < limit) {
				// Execute them if the active count is less than the limit
				next();
			} else {
				// Try to make a new schedule
				schedule(intervalEnd - now);
				break;
			}
		}
	};

	const throttled = function (...args) {
		return new Promise((resolve, reject) => {
			queue.push({
				resolve,
				reject,
				args,
				self: this
			});

			tryToAdd();
		});
	};

	throttled.abort = () => {
		for (const id of timeouts) {
			clearTimeout(id);
		}
		timeouts.clear();

		for (const x of queue) {
			x.reject(new AbortError());
		}
		queue.length = 0;
	};

	return throttled;
};

module.exports = pThrottle;
module.exports.default = pThrottle;
module.exports.AbortError = AbortError;
