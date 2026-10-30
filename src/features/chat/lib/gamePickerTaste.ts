/**
 * Taste axes for the game picker. Cooperative/competitive and euro/ameritrash
 * are exclusive pairs. The other axes can be combined. Euro and ameritrash
 * are clusters of existing BoardGameGeek tags, not single categories.
 */

export type ConflictStyle = 'cooperative' | 'competitive';
export type DesignStyle = 'euro' | 'ameritrash';

export type GamePickerTaste = {
  conflict?: ConflictStyle;
  design?: DesignStyle;
  storyDriven?: boolean;
  areaControl: boolean;
  economic: boolean;
  coolMinis: boolean;
  extraTags: string[];
};

export function tastePromptSentences(taste: GamePickerTaste): string[] {
  const parts: string[] = [];

  if (taste.conflict === 'cooperative') {
    parts.push(
      'We want a cooperative game (BoardGameGeek mechanic: Cooperative Game), where the group plays together against the game.',
    );
  } else if (taste.conflict === 'competitive') {
    parts.push(
      'We want a competitive game, where players oppose each other rather than playing a cooperative game.',
    );
  }

  if (taste.design === 'euro') {
    parts.push(
      'Prefer Euro-style games: economic systems, point-salad scoring, resource management, low direct player interaction, and luck mitigation. Lean on tags such as Economic, Worker Placement, Set Collection, Tableau Building, and Network and Route Building.',
    );
  } else if (taste.design === 'ameritrash') {
    parts.push(
      'Prefer ameritrash-style games: miniatures or figures, fighting and defeating enemies, dice rolling, and high-luck decisions. Lean on tags such as Miniatures, Fighting, Dice Rolling, Take That, and Variable Player Powers.',
    );
  }

  if (taste.storyDriven === true) {
    parts.push(
      'We want a story-driven game: narrative, campaign, or a strong theme you play through.',
    );
  } else if (taste.storyDriven === false) {
    parts.push('We do not want a story-driven or campaign game.');
  }

  if (taste.areaControl) {
    parts.push('Include area control (BoardGameGeek mechanic: Area Majority / Influence).');
  }
  if (taste.economic) {
    parts.push('Include an economic game (BoardGameGeek category: Economic).');
  }
  if (taste.coolMinis) {
    parts.push('We want cool miniatures or figures (BoardGameGeek category: Miniatures).');
  }
  if (taste.extraTags.length > 0) {
    parts.push(`Preferred BoardGameGeek categories/mechanics: ${taste.extraTags.join(', ')}.`);
  }

  return parts;
}
