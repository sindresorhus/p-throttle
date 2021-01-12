import {expectType} from 'tsd';
import pThrottle = require('.');
import {AbortError, ThrottledFunction} from '.';

const throttledUnicorn = pThrottle({
	limit: 1,
	interval: 1000
})((index: string) => '🦄');

const throttledLazyUnicorn = pThrottle({
	limit: 1,
	interval: 1000
})(async (index: string) => '🦄');

expectType<AbortError>(new AbortError());

expectType<ThrottledFunction<(index: string) => string>>(throttledUnicorn);
expectType<ThrottledFunction<(index: string) => string>>(throttledLazyUnicorn);

throttledUnicorn.abort();
throttledLazyUnicorn.abort();
