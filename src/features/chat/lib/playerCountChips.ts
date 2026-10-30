const DEFAULT_PLAYER_CHIPS = ['1', '2', '3', '4', '5', '6', '6+'];

/**
 * Player chips limited to the game's published range.
 * With no metadata, the full default set stays available.
 */
export function playerCountChips(minPlayers?: number, maxPlayers?: number): string[] {
  if (minPlayers === undefined && maxPlayers === undefined) return DEFAULT_PLAYER_CHIPS;
  const min = clamp(minPlayers ?? 1, 1, 12);
  const max = clamp(maxPlayers ?? min, min, 20);
  const visibleMax = Math.min(max, 8);
  const chips: string[] = [];
  for (let count = min; count <= visibleMax; count += 1) chips.push(String(count));
  if (max > visibleMax) chips.push(`${visibleMax}+`);
  return chips.length > 0 ? chips : DEFAULT_PLAYER_CHIPS;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}
