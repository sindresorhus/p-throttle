'use strict';

const pThrottle = (fn, limit, interval) => {
	if (!Number.isFinite(limit)) {
		throw new TypeError('Expected `limit` to be a finite number');
	}

	if (!Number.isFinite(interval)) {
		throw new TypeError('Expected `interval` to be a finite number');
	}

	const queue = [];
	const timeouts = new Set();
	let activeCount = 0;

	const next = () => {
		activeCount++;

		const id = setTimeout(() => {
			activeCount--;

			if (queue.length > 0) {
				next();
			}

			timeouts.delete(id);
		}, interval);

		timeouts.add(id);

		const x = queue.shift();
		x.resolve(fn.apply(x.self, x.args));
	};

	const throttled = function () {
		const args = arguments;

		return new Promise((resolve, reject) => {
			queue.push({
				resolve,
				reject,
				args,
				self: this
			});

			if (activeCount < limit) {
				next();
			}
		});
	};

	throttled.abort = () => {
		for (const id of timeouts) {
			clearTimeout(id);
		}
		timeouts.clear();

		for (const x of queue) {
			x.reject(new pThrottle.AbortError());
		}
		queue.length = 0;
	};

	return throttled;
};

pThrottle.AbortError = class AbortError extends Error {
	constructor() {
		super('Throttled function aborted');
		this.name = 'AbortError';
	}
};

module.exports = pThrottle;
