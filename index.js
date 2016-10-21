'use strict';
module.exports = (fn, limit, interval) => {
	if (!Number.isFinite(limit)) {
		throw new TypeError('Expected `limit` to be a finite number');
	}

	if (!Number.isFinite(interval)) {
		throw new TypeError('Expected `interval` to be a finite number');
	}

	const queue = [];
	let activeCount = 0;

	const next = () => {
		activeCount++;

		setTimeout(() => {
			activeCount--;

			if (queue.length > 0) {
				next();
			}
		}, interval);

		const x = queue.shift();
		x.resolve(fn.apply(x.self, x.args));
	};

	return function () {
		const args = arguments;

		return new Promise(resolve => {
			queue.push({
				resolve,
				args,
				self: this
			});

			if (activeCount < limit) {
				next();
			}
		});
	};
};
