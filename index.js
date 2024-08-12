export class AbortError extends Error {
	constructor() {
		super('Throttled function aborted');
		this.name = 'AbortError';
	}
}

export default function pThrottle({limit, interval, strict, onDelay}) {
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

		// Clear the queue if there's a significant delay since the last execution
		if (strictTicks.length > 0 && now - strictTicks.at(-1) > interval) {
			strictTicks.length = 0;
		}

		// If the queue is not full, add the current time and execute immediately
		if (strictTicks.length < limit) {
			strictTicks.push(now);
			return 0;
		}

		// Calculate the next execution time based on the first item in the queue
		const nextExecutionTime = strictTicks[0] + interval;

		// Shift the queue and add the new execution time
		strictTicks.shift();
		strictTicks.push(nextExecutionTime);

		// Calculate the delay for the current execution
		return Math.max(0, nextExecutionTime - now);
	}

	const getDelay = strict ? strictDelay : windowedDelay;

	return function_ => {
		const throttled = function (...arguments_) {
			if (!throttled.isEnabled) {
				return (async () => function_.apply(this, arguments_))();
			}

			let timeoutId;
			return new Promise((resolve, reject) => {
				const execute = () => {
					resolve(function_.apply(this, arguments_));
					queue.delete(timeoutId);
				};

				const delay = getDelay();
				if (delay > 0) {
					timeoutId = setTimeout(execute, delay);
					queue.set(timeoutId, reject);
					onDelay?.(...arguments_);
				} else {
					execute();
				}
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
