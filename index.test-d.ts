import {expectType, expectAssignable} from 'tsd';
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

expectAssignable<ThrottledFunction<(index: string) => string>>(throttledUnicorn);
expectAssignable<ThrottledFunction<(index: string) => string>>(throttledLazyUnicorn);

throttledUnicorn.abort();
throttledLazyUnicorn.abort();

expectType<boolean>(throttledUnicorn.isEnabled);
