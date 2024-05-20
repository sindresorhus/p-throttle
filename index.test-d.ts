import {expectType} from 'tsd';
import pThrottle, {type ThrottledFunction} from './index.js';

const unicornController = new AbortController();
const throttledUnicorn = pThrottle({
	limit: 1,
	interval: 1000,
	signal: unicornController.signal,
})((_index: string) => '🦄');

const lazyUnicornController = new AbortController();
const throttledLazyUnicorn = pThrottle({
	limit: 1,
	interval: 1000,
	signal: lazyUnicornController.signal,
})(async (_index: string) => '🦄');

const taggedUnicornController = new AbortController();
const throttledTaggedUnicorn = pThrottle({
	limit: 1,
	interval: 1000,
	signal: taggedUnicornController.signal,
})((_index: number, tag: string) => `${tag}: 🦄`);

expectType<string>(throttledUnicorn(''));
expectType<string>(await throttledLazyUnicorn(''));
expectType<string>(throttledTaggedUnicorn(1, 'foo'));

unicornController.abort();
lazyUnicornController.abort();
taggedUnicornController.abort();

expectType<boolean>(throttledUnicorn.isEnabled);
expectType<number>(throttledUnicorn.queueSize);

/* Generic */
declare function genericFunction<T>(argument: T): Promise<T>;

const throttledGenericFunction = pThrottle({
	limit: 1,
	interval: 1000,
})(genericFunction);

expectType<string>(await throttledGenericFunction('test'));
expectType<number>(await throttledGenericFunction(123));
/* /Generic */
