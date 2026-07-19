import type { Coord, GameEvent, MatchState } from '@chessforge/engine';
import { getPieceDefinition } from '@chessforge/engine';

export type MoveHistoryEntry = {
  ply: number;
  turn: number;
  player: 'white' | 'black';
  text: string;
};

function sq(c: Coord): string {
  return `${String.fromCharCode(97 + c.x)}${c.y + 1}`;
}

function pieceName(state: MatchState, pieceId: string): string {
  const p = state.pieces.find((x) => x.id === pieceId);
  if (!p) return 'фигура';
  try {
    return getPieceDefinition(p.defId).name;
  } catch {
    return p.defId;
  }
}

function ownerOf(state: MatchState, pieceId: string, fallbackPly: number): 'white' | 'black' {
  const p = state.pieces.find((x) => x.id === pieceId);
  if (p) return p.owner;
  return fallbackPly % 2 === 1 ? 'white' : 'black';
}

/** Build chronological move lines from a batch of events after a command. */
export function formatEventsToHistory(
  events: GameEvent[],
  stateAfter: MatchState,
  nextPly: number,
): MoveHistoryEntry[] {
  const entries: MoveHistoryEntry[] = [];
  let ply = nextPly;
  const notes: string[] = [];

  const pushMove = (player: 'white' | 'black', text: string) => {
    const extra = notes.length ? ` · ${notes.join(' · ')}` : '';
    notes.length = 0;
    entries.push({
      ply,
      turn: Math.ceil(ply / 2),
      player,
      text: text + extra,
    });
    ply += 1;
  };

  for (const e of events) {
    if (e.type === 'Captured') {
      notes.push('взятие');
    } else if (e.type === 'Damaged') {
      notes.push(`удар (${e.hpLeft} HP)`);
    } else if (e.type === 'Moved') {
      const ability =
        e.abilityId === 'retreat'
          ? ' (отступление)'
          : e.abilityId === 'royalWarp'
            ? ' (телепорт)'
            : e.abilityId === 'allyLeap'
              ? ' (прыжок)'
              : '';
      const name = pieceName(stateAfter, e.pieceId);
      pushMove(
        ownerOf(stateAfter, e.pieceId, ply),
        `${name} ${sq(e.from)}→${sq(e.to)}${ability}`,
      );
    } else if (e.type === 'Castled') {
      const side = e.side === 'kingside' ? '0-0' : '0-0-0';
      pushMove(ownerOf(stateAfter, e.kingId, ply), `Рокировка ${side}`);
    } else if (e.type === 'Teleported') {
      const last = entries[entries.length - 1];
      if (last) last.text += ` · пещера→${sq(e.to)}`;
    } else if (e.type === 'PieceDestroyed' && e.reason === 'spikes') {
      entries.push({
        ply,
        turn: Math.ceil(ply / 2),
        player: ply % 2 === 1 ? 'white' : 'black',
        text: `Шипы: уничтожена фигура на ${sq(e.at)}`,
      });
    } else if (e.type === 'GameOver') {
      entries.push({
        ply,
        turn: Math.ceil(Math.max(1, ply) / 2),
        player: e.winner,
        text: `Матч окончен — победа ${e.winner === 'white' ? 'белых' : 'чёрных'}`,
      });
    }
  }

  // Non-lethal strike: Damaged without Moved
  if (notes.length) {
    pushMove(ply % 2 === 1 ? 'white' : 'black', notes.join(' · '));
  }

  return entries;
}
