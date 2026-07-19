import {
  DECK_COST_CAP,
  FORMATION_SLOTS,
  deckCost,
  getFormationSlot,
  getPieceDefinition,
  type FormationPlacement,
} from '@chessforge/engine';

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
