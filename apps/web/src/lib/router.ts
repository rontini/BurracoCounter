import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'match'; id: string }
  | { name: 'hand'; id: string; handId: string | null };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'nuova') return { name: 'new' };
  if (parts[0] === 'partita' && parts[1]) {
    if (parts[2] === 'smazzata') return { name: 'hand', id: parts[1], handId: parts[3] ?? null };
    return { name: 'match', id: parts[1] };
  }
  return { name: 'home' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'new':
      return '#/nuova';
    case 'match':
      return `#/partita/${route.id}`;
    case 'hand':
      return `#/partita/${route.id}/smazzata${route.handId ? `/${route.handId}` : ''}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
