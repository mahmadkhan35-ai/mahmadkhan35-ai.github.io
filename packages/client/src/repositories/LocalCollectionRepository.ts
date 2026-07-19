import type { CollectionRepository, Deck, OwnedCard } from './types.js';
import { STARTER_COLLECTION, STARTER_DECK } from './starter.js';

const STORAGE_KEY = 'chessforge.collection.v4';
const LEGACY_KEYS = [
  'chessforge.collection.v3',
  'chessforge.collection.v2',
  'chessforge.collection.v1',
] as const;

type StoredPayload = {
  version: 4;
  cards: OwnedCard[];
  decks: Deck[];
};

/** In-memory fallback when localStorage is blocked (private mode / SSR). */
let memoryStore: string | null = null;

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return key === STORAGE_KEY ? memoryStore : null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    if (key === STORAGE_KEY) memoryStore = value;
  }
}

function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    if (key === STORAGE_KEY) memoryStore = null;
  }
}

function mergeCards(stored: OwnedCard[]): OwnedCard[] {
  const map = new Map(stored.map((c) => [c.defId, c.count]));
  for (const c of STARTER_COLLECTION) {
    if (!map.has(c.defId)) map.set(c.defId, c.count);
  }
  return [...map.entries()].map(([defId, count]) => ({ defId, count }));
}

function initialPayload(): StoredPayload {
  return {
    version: 4,
    cards: [...STARTER_COLLECTION],
    decks: [{ ...STARTER_DECK, placements: [...STARTER_DECK.placements] }],
  };
}

function migrate(raw: unknown): StoredPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { cards?: OwnedCard[]; decks?: Deck[] };
  if (!Array.isArray(obj.decks) || !Array.isArray(obj.cards)) return null;
  if (!obj.decks[0] || !Array.isArray(obj.decks[0].placements)) return null;
  return {
    version: 4,
    cards: mergeCards(obj.cards),
    decks: obj.decks,
  };
}

function write(payload: StoredPayload): void {
  storageSet(STORAGE_KEY, JSON.stringify(payload));
}

function read(): StoredPayload {
  const raw = storageGet(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = migrate(JSON.parse(raw));
      if (parsed) {
        write(parsed);
        return parsed;
      }
    } catch {
      /* fall through */
    }
  }

  for (const key of LEGACY_KEYS) {
    const legacy = storageGet(key);
    if (!legacy) continue;
    try {
      const parsed = migrate(JSON.parse(legacy));
      if (parsed) {
        write(parsed);
        for (const k of LEGACY_KEYS) storageRemove(k);
        return parsed;
      }
    } catch {
      /* try next */
    }
  }

  const initial = initialPayload();
  write(initial);
  return initial;
}

export class LocalCollectionRepository implements CollectionRepository {
  listCards(): OwnedCard[] {
    return read().cards;
  }

  listDecks(): Deck[] {
    return read().decks;
  }

  getDeck(id: string): Deck | null {
    return read().decks.find((d) => d.id === id) ?? null;
  }

  saveDeck(deck: Deck): void {
    const data = read();
    const idx = data.decks.findIndex((d) => d.id === deck.id);
    if (idx >= 0) {
      data.decks[idx] = deck;
    } else {
      data.decks.push(deck);
    }
    write(data);
  }

  deleteDeck(id: string): void {
    if (id === 'starter') return;
    const data = read();
    data.decks = data.decks.filter((d) => d.id !== id);
    if (data.decks.length === 0) data.decks = [STARTER_DECK];
    write(data);
  }

  resetToStarter(): void {
    write(initialPayload());
  }
}
