import { describe, expect, it } from 'vitest';
import { href, parseRoute, type Route } from './router';

describe('router', () => {
  it('round-trips every route', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'new' },
      { name: 'match', id: 'abc' },
      { name: 'hand', id: 'abc', handId: null },
      { name: 'hand', id: 'abc', handId: 'h1' },
    ];
    for (const r of routes) expect(parseRoute(href(r))).toEqual(r);
  });

  it('falls back to home', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/boh')).toEqual({ name: 'home' });
  });
});
