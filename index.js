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
	const ticks = [];

	return function_ => {
		const throttled = function (...args) {
			let timeout;
			return new Promise((resolve, reject) => {
				const execute = () => {
					ticks.pop();
					resolve(function_.apply(this, args));
					queue.delete(timeout);
				};

				const now = Date.now();
				const executeAt = ticks.length < limit ? now : ticks[limit - 1] + interval;

				ticks.unshift(executeAt);

				timeout = setTimeout(execute, executeAt - now);

				queue.set(timeout, reject);
			});
		};

		throttled.abort = () => {
			for (const timeout of queue.keys()) {
				clearTimeout(timeout);
				queue.get(timeout)(new AbortError());
			}

			queue.clear();
			ticks.splice(0, ticks.length);
		};

		return throttled;
	};
};

module.exports = pThrottle;
module.exports.AbortError = AbortError;
