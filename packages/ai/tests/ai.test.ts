import { describe, expect, it } from 'vitest';
import {
  DECK_COST_CAP,
  FORMATION_SLOTS,
  createMatch,
  createPieceInstance,
  createRectBoard,
  deckCost,
  getFormationSlot,
  getPieceDefinition,
  resetPieceIdCounter,
  withTileOverrides,
} from '@chessforge/engine';
import { buildAiDeck, chooseCommand, evaluate } from '../src/index.js';

function blank(
  pieces: ReturnType<typeof createPieceInstance>[],
  overrides: { pos: { x: number; y: number }; tileId: string }[] = [],
  activePlayer: 'white' | 'black' = 'white',
) {
  resetPieceIdCounter(1);
  const board = withTileOverrides(createRectBoard(8, 8, 'plain'), overrides);
  return createMatch({ board, pieces, activePlayer });
}

describe('evaluate', () => {
  it('prefers side with extra rook', () => {
    const richer = blank([
      createPieceInstance('king', 'white', { x: 4, y: 0 }, 'kw'),
      createPieceInstance('rook', 'white', { x: 0, y: 0 }, 'rw'),
      createPieceInstance('king', 'black', { x: 4, y: 7 }, 'kb'),
    ]);
    const poorer = blank([
      createPieceInstance('king', 'white', { x: 4, y: 0 }, 'kw'),
      createPieceInstance('king', 'black', { x: 4, y: 7 }, 'kb'),
    ]);
    expect(evaluate(richer, 'white')).toBeGreaterThan(evaluate(poorer, 'white'));
  });

  it('likes enemy on spikes with grace nearly spent', () => {
    const safe = blank([
      createPieceInstance('king', 'white', { x: 4, y: 0 }, 'kw'),
      createPieceInstance('rook', 'black', { x: 0, y: 3 }, 'rb'),
      createPieceInstance('king', 'black', { x: 4, y: 7 }, 'kb'),
    ]);
    const spiked = blank(
      [
        createPieceInstance('king', 'white', { x: 4, y: 0 }, 'kw'),
        createPieceInstance('rook', 'black', { x: 0, y: 3 }, 'rb'),
        createPieceInstance('king', 'black', { x: 4, y: 7 }, 'kb'),
      ],
      [{ pos: { x: 0, y: 3 }, tileId: 'spikes' }],
    );
    const enemy = spiked.pieces.find((p) => p.id === 'rb')!;
    enemy.spikeArmed = true;
    enemy.spikeTicks = 1;
    expect(evaluate(spiked, 'white')).toBeGreaterThan(evaluate(safe, 'white'));
  });
});

describe('chooseCommand', () => {
  it('captures hanging queen', () => {
    const state = blank([
      createPieceInstance('rook', 'white', { x: 0, y: 0 }, 'rw'),
      createPieceInstance('queen', 'black', { x: 0, y: 4 }, 'qb'),
      createPieceInstance('king', 'white', { x: 4, y: 0 }, 'kw'),
      createPieceInstance('king', 'black', { x: 4, y: 7 }, 'kb'),
    ]);
    const cmd = chooseCommand(state, { depth: 2 });
    expect(cmd.type).toBe('move');
    if (cmd.type !== 'move') return;
    expect(cmd.to).toEqual({ x: 0, y: 4 });
  });
});

describe('buildAiDeck', () => {
  it('fills all slots within cost cap with valid roles', () => {
    const deck = buildAiDeck(42);
    expect(deck).toHaveLength(FORMATION_SLOTS.length);
    expect(deckCost(deck)).toBeLessThanOrEqual(DECK_COST_CAP);
    for (const p of deck) {
      const slot = getFormationSlot(p.slotId);
      const def = getPieceDefinition(p.defId);
      expect(def.baseRole).toBe(slot.role);
    }
  });

  it('varies composition across seeds', () => {
    const a = buildAiDeck(1)
      .map((p) => p.defId)
      .join(',');
    const b = buildAiDeck(99)
      .map((p) => p.defId)
      .join(',');
    const c = buildAiDeck(12345)
      .map((p) => p.defId)
      .join(',');
    const unique = new Set([a, b, c]);
    expect(unique.size).toBeGreaterThan(1);
  });
});
