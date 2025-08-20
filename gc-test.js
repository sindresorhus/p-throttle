import process from 'node:process';
import pThrottle from './index.js';

const mb = bytes => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const heap = () => process.memoryUsage().heapUsed;

const delay = ms => new Promise(resolve => {
	setTimeout(resolve, ms);
});

async function runGcTest() {
	console.log(`Start: ${mb(heap())}`);

	const controller = new AbortController();
	const batches = 100; // Total throttled created = batches * perBatch
	const perBatch = 1000;
	const callsPerThrottled = 2; // Keep small to avoid large queues
	const limit = 50;
	const interval = 10;

	for (let batch = 0; batch < batches; batch++) {
		const throttle = pThrottle({
			limit, interval, strict: false, signal: controller.signal,
		});
		const throttledFns = Array.from({length: perBatch}, () => throttle(() => {}));

		const promises = [];
		for (const function_ of throttledFns) {
			for (let k = 0; k < callsPerThrottled; k++) {
				promises.push(function_());
			}
		}

		// eslint-disable-next-line no-await-in-loop
		await Promise.all(promises);

		if ((batch + 1) % 10 === 0) {
			if (global.gc) {
				global.gc();
			}

			console.log(`After batch ${batch + 1}: ${mb(heap())}`);
			// Let the event loop breathe a bit between batches
			// eslint-disable-next-line no-await-in-loop
			await delay(1);
		}
	}

	if (global.gc) {
		console.log(`Before GC: ${mb(heap())}`);
		global.gc();
		console.log(`After GC: ${mb(heap())}`);
	} else {
		console.log('GC not exposed. Run with: node --expose-gc x.js');
	}
}

try {
	await runGcTest();
} catch (error) {
	console.error(error);
	throw error;
}
