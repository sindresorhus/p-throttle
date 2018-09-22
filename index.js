'use strict';

class AbortError extends Error {
	constructor() {
		super('Throttled function aborted');
		this.name = 'AbortError';
	}
}

const pThrottle = (fn, limit, interval, opts) => {
	if (!Number.isFinite(limit)) {
		throw new TypeError('Expected `limit` to be a finite number');
	}

	if (!Number.isFinite(interval)) {
		throw new TypeError('Expected `interval` to be a finite number');
	}

	const queue = [];
	const timeouts = new Set();
	let activeCount = 0;
	let totalCount = opts &&
   Number.isFinite(opts.numberOfInvocations) ? opts.numberOfInvocations : -1;

	const next = () => {
		activeCount++;

		if (totalCount < 0 || totalCount > limit) {
			// Prevent waiting another 'interval' at the end
			const id = setTimeout(() => {
				activeCount--;

				if (queue.length > 0) {
					next();
				}

				timeouts.delete(id);
			}, interval);

			timeouts.add(id);
		}

		totalCount--;
		const x = queue.shift();
		x.resolve(fn.apply(x.self, x.args));
	};

	const throttled = function (...args) {
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
			x.reject(new AbortError());
		}
		queue.length = 0;
	};

	return throttled;
};

module.exports = pThrottle;
module.exports.default = pThrottle;
module.exports.AbortError = AbortError;
