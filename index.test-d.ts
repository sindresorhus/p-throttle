import {expectType} from 'tsd-check';
import pThrottle, {AbortError} from '.';

const throttledUnicorn = pThrottle((index: string) => {
	return '🦄';
}, 1, 1000);

const throttledLazyUnicorn = pThrottle(async (index: string) => {
	return '🦄';
}, 1, 1000);

expectType<Error>(new AbortError());

expectType<string>(throttledUnicorn('foo'));
expectType<Promise<string>>(throttledLazyUnicorn('foo'));
