'use strict';

class AbortError extends Error {
	constructor() {
		super('Throttled function aborted');
		this.name = 'AbortError';
	}
}

const pThrottle = ({limit, interval}) => {
	if (!Number.isFinite(limit)) {
		throw new TypeError('Expected `limit` to be a finite number');
	}

	if (!Number.isFinite(interval)) {
		throw new TypeError('Expected `interval` to be a finite number');
	}

	const queue = new Map();

	let currentTick = 0;
	let activeCount = 0;

	return function_ => {
		const throttled = function (...args) {
			if (throttled.isEnabled) {
				let timeout;
				return new Promise((resolve, reject) => {
					const execute = () => {
						resolve(function_.apply(this, args));
						queue.delete(timeout);
					};

					const now = Date.now();

					if ((now - currentTick) > interval) {
						activeCount = 1;
						currentTick = now;
					} else if (activeCount < limit) {
						activeCount++;
					} else {
						currentTick += interval;
						activeCount = 1;
					}

					timeout = setTimeout(execute, currentTick - now);

					queue.set(timeout, reject);
				});
			}

			return Promise.resolve(function_.apply(this, args));
		};

		throttled.abort = () => {
			for (const timeout of queue.keys()) {
				clearTimeout(timeout);
				queue.get(timeout)(new AbortError());
			}

			queue.clear();
		};

		throttled.isEnabled = true;

		return throttled;
	};
};

module.exports = pThrottle;
module.exports.AbortError = AbortError;
