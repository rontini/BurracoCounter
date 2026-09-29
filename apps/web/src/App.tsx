import { UpdatePrompt } from './components/UpdatePrompt';
import { useRoute } from './lib/router';
import { HandEntry } from './screens/HandEntry';
import { Home } from './screens/Home';
import { MatchView } from './screens/MatchView';
import { NewMatch } from './screens/NewMatch';
import { Settings } from './screens/Settings';

export function App() {
  const route = useRoute();
  return (
    <main className="app">
      {route.name === 'home' && <Home />}
      {route.name === 'new' && <NewMatch />}
      {route.name === 'settings' && <Settings />}
      {route.name === 'match' && <MatchView id={route.id} />}
      {route.name === 'hand' && <HandEntry id={route.id} handId={route.handId} />}
      <UpdatePrompt />
    </main>
  );
}
