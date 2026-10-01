import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the home with the app title', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'BurraCount' })).toBeInTheDocument();
    // Aspetto la lettura delle partite da IndexedDB: se finisse dopo il test,
    // aggiornerebbe React con l'ambiente jsdom già smontato.
    expect(await screen.findByText('Nessuna partita ancora. Iniziane una!')).toBeInTheDocument();
  });
});
