import {expectType} from 'tsd-check';
import pThrottle, {AbortError, ThrottledFunction} from '.';

const throttledUnicorn = pThrottle(
	(index: string) => '🦄',
	1,
	1000
);

const throttledLazyUnicorn = pThrottle(
	async (index: string) => '🦄',
	1,
	1000
);

expectType<Error>(new AbortError());

expectType<ThrottledFunction<[string], string>>(throttledUnicorn);
expectType<ThrottledFunction<[string], string>>(throttledLazyUnicorn);

throttledUnicorn.abort();
throttledLazyUnicorn.abort();
