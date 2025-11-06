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
	const strictCapacity = Math.max(limit, 1);

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
		if (state.strictTicks.length > 0 && now - state.strictTicks.at(-1).time > interval) {
			state.strictTicks.length = 0;
		}

		// If the queue is not full (treat limit 0 as capacity 1 for seeding), add the current time and execute immediately
		if (state.strictTicks.length < strictCapacity) {
			state.strictTicks.push({time: now});
			return {delay: 0};
		}

		// Calculate next execution time: must be after oldest + interval,
		// AND must be after the most recent to prevent multiple calls bunching up
		const oldestTime = state.strictTicks[0].time;
		const mostRecentTime = state.strictTicks.at(-1).time;
		const baseTime = oldestTime + interval;
		// Add minimum spacing to prevent bunching (except for interval=0)
		const minSpacing = interval > 0 ? Math.ceil(interval / strictCapacity) : 0;
		const nextExecutionTime = baseTime <= mostRecentTime ? mostRecentTime + minSpacing : baseTime;

		// Shift the queue and add a record for the new execution
		state.strictTicks.shift();
		const tickRecord = {time: nextExecutionTime};
		state.strictTicks.push(tickRecord);

		// Calculate the delay for the current execution
		return {delay: Math.max(0, nextExecutionTime - now), tickRecord};
	}

	const getDelay = strict ? strictDelay : windowedDelay;

	return function_ => {
		const throttled = function (...arguments_) {
			if (!throttled.isEnabled) {
				return (async () => function_.apply(this, arguments_))();
			}

			let timeoutId;
			return new Promise((resolve, reject) => {
				const delayResult = getDelay();
				const delay = strict ? delayResult.delay : delayResult;
				const tickRecord = strict ? delayResult.tickRecord : undefined;

				const execute = () => {
					// Update strictTicks with actual execution time to account for setTimeout drift
					if (tickRecord) {
						tickRecord.time = Date.now();
					}

					try {
						resolve(function_.apply(this, arguments_));
					} catch (error) {
						reject(error);
					}

					state.queue.delete(timeoutId);
				};

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
