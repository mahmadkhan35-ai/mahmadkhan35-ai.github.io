import {
  applyCommand,
  getLegalMoves,
  type GameCommand,
  type LegalMove,
  type MatchState,
} from '@chessforge/engine';
import { evaluate, pieceTacticalValue } from './evaluate.js';

const DEFAULT_DEPTH = 2;
const NODE_LIMIT = 8000;

type SearchContext = {
  nodes: number;
};

function moveToCommand(m: LegalMove): GameCommand {
  return {
    type: 'move',
    from: { ...m.from },
    to: { ...m.to },
    ...(m.abilityId !== undefined ? { abilityId: m.abilityId } : {}),
  };
}

function orderMoves(state: MatchState, moves: LegalMove[]): LegalMove[] {
  return [...moves].sort((a, b) => {
    const score = (m: LegalMove) => {
      let s = 0;
      if (m.captures && m.targetPieceId) {
        const target = state.pieces.find((p) => p.id === m.targetPieceId);
        if (target) s += 1000 + pieceTacticalValue(target.defId);
      }
      if (m.abilityId) s += 80;
      return s;
    };
    return score(b) - score(a);
  });
}

/** Eval from the side about to move. */
function evalStm(state: MatchState): number {
  return evaluate(state, state.activePlayer);
}

function quiesce(state: MatchState, alpha: number, beta: number, ctx: SearchContext): number {
  ctx.nodes += 1;
  const standPat = evalStm(state);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (ctx.nodes > NODE_LIMIT || state.phase === 'gameOver') return standPat;

  const captures = orderMoves(
    state,
    getLegalMoves(state).filter((m) => m.captures),
  );
  for (const m of captures) {
    const result = applyCommand(state, moveToCommand(m));
    if (!result.ok) continue;
    // After apply, STM flipped — negate child score
    const score = -quiesce(result.state, -beta, -alpha, ctx);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(
  state: MatchState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchContext,
): number {
  ctx.nodes += 1;
  if (ctx.nodes > NODE_LIMIT || state.phase === 'gameOver') {
    return evalStm(state);
  }
  if (depth <= 0) {
    return quiesce(state, alpha, beta, ctx);
  }

  const moves = orderMoves(state, getLegalMoves(state));
  if (moves.length === 0) {
    return evalStm(state);
  }

  let best = -Infinity;
  for (const m of moves) {
    const result = applyCommand(state, moveToCommand(m));
    if (!result.ok) continue;
    const score = -negamax(result.state, depth - 1, -beta, -alpha, ctx);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }

  return best === -Infinity ? evalStm(state) : best;
}

export type ChooseOptions = {
  depth?: number;
};

/**
 * Pick the best command for the active player via alphabeta search.
 */
export function chooseCommand(state: MatchState, options: ChooseOptions = {}): GameCommand {
  const depth = options.depth ?? DEFAULT_DEPTH;
  const moves = orderMoves(state, getLegalMoves(state));
  if (moves.length === 0) {
    return { type: 'endTurn' };
  }

  const ctx: SearchContext = { nodes: 0 };

  let bestMove = moves[0]!;
  let bestScore = -Infinity;

  // Full window at root so each candidate gets an exact score (shared AB
  // cutoffs can return bounds that look equal and then lose to jitter).
  for (const m of moves) {
    const result = applyCommand(state, moveToCommand(m));
    if (!result.ok) continue;
    const score = -negamax(result.state, depth - 1, -Infinity, Infinity, ctx);
    const jitter = ((m.from.x * 17 + m.to.y * 13 + m.from.y) % 7) * 0.001;
    const adjusted = score + jitter;
    if (adjusted > bestScore) {
      bestScore = adjusted;
      bestMove = m;
    }
  }

  return moveToCommand(bestMove);
}
