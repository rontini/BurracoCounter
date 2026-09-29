import { useRoute } from './lib/router';
import { HandEntry } from './screens/HandEntry';
import { Home } from './screens/Home';
import { MatchView } from './screens/MatchView';
import { NewMatch } from './screens/NewMatch';

export function App() {
  const route = useRoute();
  return (
    <main className="app">
      {route.name === 'home' && <Home />}
      {route.name === 'new' && <NewMatch />}
      {route.name === 'match' && <MatchView id={route.id} />}
      {route.name === 'hand' && <HandEntry id={route.id} handId={route.handId} />}
    </main>
  );
}
