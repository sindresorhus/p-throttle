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

	let currentTick = Date.now();
	let activeCount = 0;

	const throttled = function (...args) {
		return new Promise((resolve, reject) => {
			const execute = () => resolve(fn.apply(this, args));

			if (activeCount < limit) {
				activeCount++;
			} else {
				currentTick += interval;
				activeCount = 1;
			}

			queue.push({
				timeout: setTimeout(execute, currentTick - Date.now()),
				reject
			});
		});
	};

	throttled.abort = () => {
		const error = new AbortError();

		for (const item of queue) {
			clearTimeout(item.timeout);
			item.reject(error);
		}
		queue.length = 0;
	};

	return throttled;
};

module.exports = pThrottle;
module.exports.default = pThrottle;
module.exports.AbortError = AbortError;
