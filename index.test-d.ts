import {expectType} from 'tsd-check';
import pThrottle, {AbortError} from '.';

const throttledUnicorn = pThrottle((i: string) => {
	return '🦄';
}, 1, 1000);

const throttledLazyUnicorn = pThrottle((i: string) => {
	return Promise.resolve('🦄');
}, 1, 1000);

expectType<Error>(new AbortError('error'));
expectType<Error>(AbortError('error'));

expectType<string>(throttledUnicorn('foo'));
expectType<Promise<string>>(throttledLazyUnicorn('foo'));
