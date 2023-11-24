export class AbortError extends Error {
	constructor() {
		super('Throttled function aborted');
		this.name = 'AbortError';
	}
}

export function pThrottleRate({limit, interval, strict}) {
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

				timeoutId = setTimeout(execute, getDelay());

				queue.set(timeoutId, reject);
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

export function pThrottleConcurrency({concurrency}) {
	if (!(Number.isInteger(concurrency) && concurrency > 0)) {
		throw new TypeError('Expected `concurrency` to be an integer greater than 0');
	}

	const queue = [];

	let activeCount = 0;

	async function tryNext() {
		if (activeCount >= concurrency || queue.length === 0) {
			return;
		}

		const {resolve, function_, arguments_} = queue.shift();

		activeCount++;

		const promise = function_.apply(this, arguments_);

		resolve(promise);

		try {
			await promise;
		} catch { }

		activeCount--;

		tryNext();
	}

	return function_ => {
		const throttled = function (...arguments_) {
			if (!throttled.isEnabled) {
				return (async () => function_.apply(this, arguments_))();
			}

			return new Promise(async (resolve, reject) => {
				queue.push({resolve, reject, function_, arguments_});

				tryNext();
			});
		}

		throttled.abort = () => {
			for (const {reject} of queue) {
				reject(new AbortError());
			}

			queue = [];
		};

		throttled.isEnabled = true;

		Object.defineProperty(throttled, 'queueSize', {
			get() {
				return queue.length;
			},
		});

		return throttled;
	}
}
