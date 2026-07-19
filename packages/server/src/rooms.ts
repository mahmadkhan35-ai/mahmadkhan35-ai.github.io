import {
  applyCommand,
  createMatchFromPlacements,
  DECK_COST_CAP,
  deckCost,
  FORMATION_SLOTS,
  getFormationSlot,
  getPieceDefinition,
  type FormationPlacement,
  type GameCommand,
  type MatchState,
  type PlayerId,
} from '@chessforge/engine';
import type { WebSocket } from 'ws';
import type { ServerMessage } from './protocol.js';

export type Seat = {
  ws: WebSocket;
  color: PlayerId;
  placements: FormationPlacement[];
};

export type Room = {
  id: string;
  seats: Partial<Record<PlayerId, Seat>>;
  seed: number;
  state: MatchState | null;
};

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(room: Room, msg: ServerMessage, except?: WebSocket): void {
  for (const seat of Object.values(room.seats)) {
    if (!seat || seat.ws === except) continue;
    send(seat.ws, msg);
  }
}

export function validatePlacements(placements: FormationPlacement[]): string | null {
  if (placements.length !== FORMATION_SLOTS.length) {
    return `Нужно заполнить все ${FORMATION_SLOTS.length} слотов`;
  }
  const seen = new Set<string>();
  for (const p of placements) {
    if (seen.has(p.slotId)) return 'Дублирующий слот в колоде';
    seen.add(p.slotId);
    let slot;
    try {
      slot = getFormationSlot(p.slotId);
    } catch {
      return `Неизвестный слот ${p.slotId}`;
    }
    let def;
    try {
      def = getPieceDefinition(p.defId);
    } catch {
      return `Неизвестная фигура ${p.defId}`;
    }
    if (def.baseRole !== slot.role) {
      return `${def.name} не подходит для слота ${p.slotId}`;
    }
  }
  for (const slot of FORMATION_SLOTS) {
    if (!seen.has(slot.id)) return `Пустой слот ${slot.id}`;
  }
  if (deckCost(placements) > DECK_COST_CAP) {
    return `Колода дороже лимита ${DECK_COST_CAP}`;
  }
  return null;
}

function roomCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return out;
}

export class RoomHub {
  private rooms = new Map<string, Room>();
  private bySocket = new Map<WebSocket, string>();

  create(ws: WebSocket, placements: FormationPlacement[]): void {
    this.leave(ws);
    const err = validatePlacements(placements);
    if (err) {
      send(ws, { type: 'error', message: err });
      return;
    }

    let id = roomCode();
    while (this.rooms.has(id)) id = roomCode();

    const room: Room = {
      id,
      seats: {
        white: { ws, color: 'white', placements },
      },
      seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
      state: null,
    };
    this.rooms.set(id, room);
    this.bySocket.set(ws, id);
    send(ws, { type: 'created', roomId: id, color: 'white' });
    send(ws, { type: 'waiting', roomId: id });
  }

  join(ws: WebSocket, roomId: string, placements: FormationPlacement[]): void {
    this.leave(ws);
    const room = this.rooms.get(roomId.toLowerCase());
    if (!room) {
      send(ws, { type: 'error', message: 'Комната не найдена' });
      return;
    }
    if (room.seats.black) {
      send(ws, { type: 'error', message: 'Комната уже заполнена' });
      return;
    }
    const err = validatePlacements(placements);
    if (err) {
      send(ws, { type: 'error', message: err });
      return;
    }

    room.seats.black = { ws, color: 'black', placements };
    this.bySocket.set(ws, room.id);
    send(ws, { type: 'joined', roomId: room.id, color: 'black' });

    const white = room.seats.white;
    if (!white) {
      send(ws, { type: 'error', message: 'Хост комнаты отсутствует' });
      return;
    }

    room.state = createMatchFromPlacements(white.placements, placements, room.seed);
    const startWhite: ServerMessage = {
      type: 'matchStart',
      roomId: room.id,
      seed: room.seed,
      yourColor: 'white',
      white: white.placements,
      black: placements,
    };
    const startBlack: ServerMessage = {
      ...startWhite,
      yourColor: 'black',
    };
    send(white.ws, startWhite);
    send(ws, startBlack);
  }

  command(ws: WebSocket, command: GameCommand): void {
    const roomId = this.bySocket.get(ws);
    if (!roomId) {
      send(ws, { type: 'error', message: 'Вы не в комнате' });
      return;
    }
    const room = this.rooms.get(roomId);
    if (!room?.state) {
      send(ws, { type: 'error', message: 'Матч ещё не начался' });
      return;
    }

    const seat = Object.values(room.seats).find((s) => s?.ws === ws);
    if (!seat) {
      send(ws, { type: 'error', message: 'Место в комнате не найдено' });
      return;
    }
    if (room.state.phase !== 'play') {
      send(ws, { type: 'error', message: 'Матч уже окончен' });
      return;
    }
    if (seat.color !== room.state.activePlayer) {
      send(ws, { type: 'error', message: 'Сейчас ход соперника' });
      return;
    }

    const result = applyCommand(room.state, command);
    if (!result.ok) {
      send(ws, { type: 'error', message: result.message });
      return;
    }
    room.state = result.state;
    broadcast(room, { type: 'command', command, by: seat.color });
  }

  leave(ws: WebSocket): void {
    const roomId = this.bySocket.get(ws);
    if (!roomId) return;
    this.bySocket.delete(ws);
    const room = this.rooms.get(roomId);
    if (!room) return;

    const color = (Object.values(room.seats).find((s) => s?.ws === ws)?.color ??
      null) as PlayerId | null;
    if (color) {
      delete room.seats[color];
    }

    const remaining = Object.values(room.seats).filter(Boolean);
    if (remaining.length === 0) {
      this.rooms.delete(roomId);
      return;
    }

    broadcast(room, { type: 'opponentLeft' });
    // Tear down room after disconnect — rematch requires new invite
    for (const seat of remaining) {
      if (!seat) continue;
      this.bySocket.delete(seat.ws);
    }
    this.rooms.delete(roomId);
  }
}
