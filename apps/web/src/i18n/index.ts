import { it, type MessageKey } from './it';

// L'interfaccia è in italiano; per un'altra lingua basta un dizionario con le stesse chiavi.
const messages: Record<MessageKey, string> = it;

export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  return messages[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars[name] ?? `{${name}}`),
  );
}

export type { MessageKey };
