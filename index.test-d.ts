import {expectType} from 'tsd';
import {pThrottleRate, pThrottleConcurrency, type ThrottledFunction} from './index.js';

const throttledUnicorn = pThrottleRate({
	limit: 1,
	interval: 1000,
})((_index: string) => '🦄');

const throttledLazyUnicorn = pThrottleRate({
	limit: 1,
	interval: 1000,
})(async (_index: string) => '🦄');

const throttledTaggedUnicorn = pThrottleRate({
	limit: 1,
	interval: 1000,
})((_index: number, tag: string) => `${tag}: 🦄`);

expectType<string>(throttledUnicorn(''));
expectType<string>(await throttledLazyUnicorn(''));
expectType<string>(throttledTaggedUnicorn(1, 'foo'));

throttledUnicorn.abort();
throttledLazyUnicorn.abort();
throttledTaggedUnicorn.abort();

expectType<boolean>(throttledUnicorn.isEnabled);
expectType<number>(throttledUnicorn.queueSize);

/* Generic */
declare function genericFunction<T>(argument: T): Promise<T>;

const throttledGenericFunction = pThrottleRate({
	limit: 1,
	interval: 1000,
})(genericFunction);

expectType<string>(await throttledGenericFunction('test'));
expectType<number>(await throttledGenericFunction(123));
/* /Generic */

const throttledUnicornConcurrency = pThrottleConcurrency({
	concurrency: 1,
})(() => '🦄');

expectType<string>(throttledUnicornConcurrency());

throttledUnicornConcurrency.abort();

expectType<boolean>(throttledUnicornConcurrency.isEnabled);
