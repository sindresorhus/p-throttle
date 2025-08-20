const states = new WeakMap();
const signalThrottleds = new WeakMap(); // AbortSignal -> {throttleds: Set<WeakRef>, listener: Function}

const finalizationRegistry = new FinalizationRegistry(({signalWeakRef, weakReference}) => {
	const signal = signalWeakRef.deref();
	if (!signal) {
		return; // Signal already GC'd
	}

	const registration = signalThrottleds.get(signal);
	if (registration) {
		registration.throttleds.delete(weakReference);
		if (registration.throttleds.size === 0) {
			// Remove the abort listener when no throttleds remain
			signal.removeEventListener('abort', registration.listener);
			signalThrottleds.delete(signal);
		}
	}
});

export default function pThrottle({limit, interval, strict, signal, onDelay}) {
	if (!Number.isFinite(limit)) {
		throw new TypeError('Expected `limit` to be a finite number');
	}

	if (!Number.isFinite(interval)) {
		throw new TypeError('Expected `interval` to be a finite number');
	}

	if (limit < 0) {
		throw new TypeError('Expected `limit` to be >= 0');
	}

	if (interval < 0) {
		throw new TypeError('Expected `interval` to be >= 0');
	}

	const state = {
		queue: new Map(),
		strictTicks: [],
		// Track windowed algorithm state so it can be reset on abort
		currentTick: 0,
		activeCount: 0,
	};

	function windowedDelay() {
		const now = Date.now();

		if ((now - state.currentTick) > interval) {
			state.activeCount = 1;
			state.currentTick = now;
			return 0;
		}

		if (state.activeCount < limit) {
			state.activeCount++;
		} else {
			state.currentTick += interval;
			state.activeCount = 1;
		}

		return state.currentTick - now;
	}

	function strictDelay() {
		const now = Date.now();

		// Clear the queue if there's a significant delay since the last execution
		if (state.strictTicks.length > 0 && now - state.strictTicks.at(-1) > interval) {
			state.strictTicks.length = 0;
		}

		// If the queue is not full, add the current time and execute immediately
		if (state.strictTicks.length < limit) {
			state.strictTicks.push(now);
			return 0;
		}

		// Calculate the next execution time based on the first item in the queue
		const nextExecutionTime = state.strictTicks[0] + interval;

		// Shift the queue and add the new execution time
		state.strictTicks.shift();
		state.strictTicks.push(nextExecutionTime);

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
					try {
						resolve(function_.apply(this, arguments_));
					} catch (error) {
						reject(error);
					}

					state.queue.delete(timeoutId);
				};

				const delay = getDelay();
				if (delay > 0) {
					timeoutId = setTimeout(execute, delay);
					state.queue.set(timeoutId, reject);
					try {
						onDelay?.(...arguments_);
					} catch {}
				} else {
					execute();
				}
			});
		};

		signal?.throwIfAborted();

		if (signal) {
			let registration = signalThrottleds.get(signal);
			if (!registration) {
				registration = {
					throttleds: new Set(),
					listener: null,
				};

				registration.listener = () => {
					for (const weakReference of registration.throttleds) {
						const function_ = weakReference.deref();
						if (!function_) {
							continue;
						}

						const functionState = states.get(function_);
						if (!functionState) {
							continue;
						}

						for (const timeout of functionState.queue.keys()) {
							clearTimeout(timeout);
							functionState.queue.get(timeout)(signal.reason);
						}

						functionState.queue.clear();
						functionState.strictTicks.length = 0;
						// Reset windowed state so subsequent calls are not artificially delayed
						functionState.currentTick = 0;
						functionState.activeCount = 0;
					}

					signalThrottleds.delete(signal);
				};

				signalThrottleds.set(signal, registration);
				signal.addEventListener('abort', registration.listener, {once: true});
			}

			const weakReference = new WeakRef(throttled);
			registration.throttleds.add(weakReference);
			finalizationRegistry.register(throttled, {
				signalWeakRef: new WeakRef(signal),
				weakReference,
			});
		}

		throttled.isEnabled = true;

		Object.defineProperty(throttled, 'queueSize', {
			get() {
				return state.queue.size;
			},
		});

		states.set(throttled, state);

		return throttled;
	};
}
