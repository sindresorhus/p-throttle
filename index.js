export class AbortError extends Error {
	constructor() {
		super('Throttled function aborted');
		this.name = 'AbortError';
	}
}

export default function pThrottle({limit, interval, strict}) {
	if (!Number.isFinite(limit)) {
		throw new TypeError('Expected `limit` to be a finite number');
	}

	if (!Number.isFinite(interval)) {
		throw new TypeError('Expected `interval` to be a finite number');
	}

	const queue = new Map();

	let currentTick = 0;
	let activeCount = 0;

	function windowedDelay() {
		const now = Date.now();

		if ((now - currentTick) > interval) {
			activeCount = 1;
			currentTick = now;
			return 0;
		}

		if (activeCount < limit) {
			activeCount++;
		} else {
			currentTick += interval;
			activeCount = 1;
		}

		return currentTick - now;
	}

	const strictTicks = [];

	function strictDelay() {
		const now = Date.now();

		if (strictTicks.length < limit) {
			strictTicks.push(now);
			return 0;
		}

		const earliestTime = strictTicks.shift() + interval;

		if (now >= earliestTime) {
			strictTicks.push(now);
			return 0;
		}

		strictTicks.push(earliestTime);
		return earliestTime - now;
	}

	const getDelay = strict ? strictDelay : windowedDelay;

	return function_ => {
		const throttled = function (...args) {
			if (!throttled.isEnabled) {
				return (async () => function_.apply(this, args))();
			}

			let timeout;
			return new Promise((resolve, reject) => {
				const execute = () => {
					resolve(function_.apply(this, args));
					queue.delete(timeout);
				};

				timeout = setTimeout(execute, getDelay());

				queue.set(timeout, reject);
			});
		};

		throttled.abort = () => {
			for (const timeout of queue.keys()) {
				clearTimeout(timeout);
				queue.get(timeout)(new AbortError());
			}

			queue.clear();
			strictTicks.splice(0, strictTicks.length);
		};

		throttled.isEnabled = true;

		Object.defineProperty(throttled, 'queueSize', {
			get() {
				return queue.size;
			},
		});

		return throttled;
	};
}
