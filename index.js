'use strict';
module.exports = (fn, limit, interval) => {
	if (!Number.isFinite(limit)) {
		throw new TypeError('Expected `limit` to be a finite number');
	}

	if (!Number.isFinite(interval)) {
		throw new TypeError('Expected `interval` to be a finite number');
	}

	const queue = [];
	const timeouts = [];
	let activeCount = 0;

	const next = () => {
		activeCount++;

		const id = setTimeout(() => {
			activeCount--;

			if (queue.length > 0) {
				next();
			}

			const i = timeouts.indexOf(id);
			if (i !== -1) {
				timeouts.splice(i, 1);
			}
		}, interval);

		timeouts.push(id);

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
		for (const x of queue) {
			x.reject(new Error('Throttled function aborted'));
		}
		queue.length = 0;
	};

	return throttled;
};
