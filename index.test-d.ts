import {expectType} from 'tsd';
import pThrottle = require('.');
import {AbortError, ThrottledFunction} from '.';

const throttledUnicorn = pThrottle((index: string) => '🦄', 1, 1000);

const throttledLazyUnicorn = pThrottle(async (index: string) => '🦄', 1, 1000);

expectType<AbortError>(new AbortError());

expectType<ThrottledFunction<[string], string>>(throttledUnicorn);
expectType<ThrottledFunction<[string], string>>(throttledLazyUnicorn);

throttledUnicorn.abort();
throttledLazyUnicorn.abort();
