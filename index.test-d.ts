import {expectType} from 'tsd';
import pThrottle = require('./index.js');
import {AbortError, ThrottledFunction} from './index.js';

const throttledUnicorn = pThrottle({
	limit: 1,
	interval: 1000
})((index: string) => '🦄');

const throttledLazyUnicorn = pThrottle({
	limit: 1,
	interval: 1000
})(async (index: string) => '🦄');

expectType<AbortError>(new AbortError());

expectType<ThrottledFunction<string, string>(throttledUnicorn);
expectType<ThrottledFunction<string, Promise<string>>>(throttledLazyUnicorn);

throttledUnicorn.abort();
throttledLazyUnicorn.abort();
