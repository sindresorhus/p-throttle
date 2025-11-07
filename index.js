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

export default function pThrottle({limit, interval, strict, signal, onDelay, weight}) {
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

	if (weight !== undefined && typeof weight !== 'function') {
		throw new TypeError('Expected `weight` to be a function');
	}

	if (weight && interval === 0) {
		throw new TypeError('The `weight` option cannot be used with `interval` of 0');
	}

	const state = {
		queue: new Map(),
		strictTicks: [],
		// Track windowed algorithm state so it can be reset on abort
		currentTick: 0,
		activeWeight: 0,
	};
	const strictCapacity = Math.max(limit, 1);

	// Helper: insert tick maintaining sorted order by time (for weighted strict mode)
	const insertTickSorted = tickRecord => {
		// Optimization: append if it belongs at the end (common case - O(1))
		if (state.strictTicks.length === 0 || tickRecord.time >= state.strictTicks.at(-1).time) {
			state.strictTicks.push(tickRecord);
		} else {
			// Insert at correct position (rare case - O(n))
			const insertIndex = state.strictTicks.findIndex(tick => tick.time > tickRecord.time);
			state.strictTicks.splice(insertIndex, 0, tickRecord);
		}
	};

	function windowedDelay(requestWeight) {
		const now = Date.now();

		if ((now - state.currentTick) > interval) {
			state.activeWeight = requestWeight;
			state.currentTick = now;
			return 0;
		}

		if (state.activeWeight + requestWeight <= limit) {
			state.activeWeight += requestWeight;
		} else {
			state.currentTick += interval;
			state.activeWeight = requestWeight;
		}

		return state.currentTick - now;
	}

	function strictDelay(requestWeight) {
		const now = Date.now();

		// Clear the queue if there's a significant delay since the last execution
		if (state.strictTicks.length > 0 && now - state.strictTicks.at(-1).time > interval) {
			state.strictTicks.length = 0;
		}

		// For weighted throttling, use time-based sliding window
		if (weight) {
			// Remove ticks outside the current interval window
			while (state.strictTicks.length > 0 && now - state.strictTicks[0].time >= interval) {
				state.strictTicks.shift();
			}

			const weightInWindowAt = time => {
				let total = 0;
				for (const tick of state.strictTicks) {
					if (tick.time <= time && time - tick.time < interval) {
						total += tick.weight;
					}
				}

				return total;
			};

			// Execute immediately if capacity available
			if (weightInWindowAt(now) + requestWeight <= limit) {
				const tickRecord = {time: now, weight: requestWeight};
				insertTickSorted(tickRecord);
				return {delay: 0};
			}

			// Find earliest time when window will have room
			let nextExecutionTime = now;
			while (weightInWindowAt(nextExecutionTime) + requestWeight > limit) {
				const firstInWindow = state.strictTicks.find(tick =>
					tick.time <= nextExecutionTime && nextExecutionTime - tick.time < interval,
				);

				if (!firstInWindow) {
					break;
				}

				nextExecutionTime = firstInWindow.time + interval;
			}

			const tickRecord = {time: nextExecutionTime, weight: requestWeight};
			insertTickSorted(tickRecord);
			return {delay: Math.max(0, nextExecutionTime - now), tickRecord};
		}

		// For non-weighted throttling, use count-based queue (original algorithm)
		// If the queue is not full (treat limit 0 as capacity 1 for seeding), add the current time and execute immediately
		if (state.strictTicks.length < strictCapacity) {
			state.strictTicks.push({time: now, weight: requestWeight});
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
		const tickRecord = {time: nextExecutionTime, weight: requestWeight};
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
				// Calculate weight for this call
				let requestWeight = 1;
				if (weight) {
					try {
						requestWeight = weight(...arguments_);
					} catch (error) {
						reject(error);
						return;
					}

					// Validate weight
					if (!Number.isFinite(requestWeight) || requestWeight < 0) {
						reject(new TypeError('Expected `weight` to be a finite non-negative number'));
						return;
					}

					if (requestWeight > limit) {
						reject(new TypeError(`Expected \`weight\` (${requestWeight}) to be <= \`limit\` (${limit})`));
						return;
					}
				}

				const delayResult = getDelay(requestWeight);
				const delay = strict ? delayResult.delay : delayResult;
				const tickRecord = strict ? delayResult.tickRecord : undefined;

				const execute = () => {
					// Update strictTicks with actual execution time to account for setTimeout drift
					if (tickRecord) {
						const actualTime = Date.now();

						// For weighted throttling with drift, maintain sorted order
						if (weight && tickRecord.time !== actualTime) {
							tickRecord.time = actualTime;
							const index = state.strictTicks.indexOf(tickRecord);
							state.strictTicks.splice(index, 1);
							insertTickSorted(tickRecord);
						} else {
							tickRecord.time = actualTime;
						}
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
						functionState.activeWeight = 0;
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
