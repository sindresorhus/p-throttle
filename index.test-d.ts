import {expectType} from 'tsd';
import pThrottle, {ThrottledFunction} from './index.js';

const throttledUnicorn = pThrottle({
	limit: 1,
	interval: 1000,
})((_index: string) => '🦄');

const throttledLazyUnicorn = pThrottle({
	limit: 1,
	interval: 1000,
})(async (_index: string) => '🦄');

const strictThrottledUnicorn = pThrottle({
	limit: 1,
	interval: 1000,
	strict: true,
})((_index: string) => '🦄');

const strictThrottledLazyUnicorn = pThrottle({
	limit: 1,
	interval: 1000,
	strict: true,
})(async (_index: string) => '🦄');

const throttledTaggedUnicorn = pThrottle({
	limit: 1,
	interval: 1000,
})((_index: number, tag: string) => `${tag}: 🦄`);

expectType<ThrottledFunction<[string], string>>(throttledUnicorn);
expectType<ThrottledFunction<[string], Promise<string>>>(throttledLazyUnicorn);
expectType<ThrottledFunction<[string], string>>(strictThrottledUnicorn);
expectType<ThrottledFunction<[string], Promise<string>>>(strictThrottledLazyUnicorn);
expectType<ThrottledFunction<[number, string], Promise<string>>>(throttledTaggedUnicorn);

throttledUnicorn.abort();
throttledLazyUnicorn.abort();
strictThrottledUnicorn.abort();
strictThrottledLazyUnicorn.abort();
throttledTaggedUnicorn.abort();

expectType<boolean>(throttledUnicorn.isEnabled);
