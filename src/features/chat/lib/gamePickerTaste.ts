/**
 * Taste axes for the game picker. Cooperative/competitive and euro/ameritrash
 * are exclusive pairs. The other axes can be combined. Euro and ameritrash
 * are clusters of existing BoardGameGeek tags, not single categories.
 */

export type ConflictStyle = 'cooperative' | 'competitive';
export type DesignStyle = 'euro' | 'ameritrash';
export type KidsAge = 'under-6' | '6-9' | '10-12' | '14+';

export type GamePickerTaste = {
  conflict?: ConflictStyle;
  design?: DesignStyle;
  /** Set only when the player turns the story-driven toggle on. */
  storyDriven?: boolean;
  areaControl: boolean;
  economic: boolean;
  coolMinis: boolean;
  kidsFriendly: boolean;
  kidsAge?: KidsAge;
  cardGame: boolean;
  activityGame: boolean;
  extraTags: string[];
};

const TIP_COUNT = 5;

/** How many games to ask for, and whether they must come from the collection. */
export function pickerScopeSentences(fromCollection: boolean): string[] {
  const count = `Suggest exactly ${TIP_COUNT} games. Put each title in suggestedGames, and start each bullet with that title.`;
  if (fromCollection) {
    return ['Please suggest only from my collection.', count];
  }
  return [
    count,
    `You may mention one or two games from my collection when they fit well, but most of the ${TIP_COUNT} suggestions must be games I do not own.`,
  ];
}

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
  if (taste.kidsFriendly) {
    parts.push(
      'We want a kids-friendly game: approachable rules, a short teach, and a theme that works for children.',
    );
    if (taste.kidsAge === 'under-6') parts.push('It should suit children under 6.');
    else if (taste.kidsAge === '6-9') parts.push('It should suit children aged 6 to 9.');
    else if (taste.kidsAge === '10-12') parts.push('It should suit children aged 10 to 12.');
    else if (taste.kidsAge === '14+') parts.push('It should suit players aged 14 and up.');
  }
  if (taste.cardGame) {
    parts.push('We want a card game (BoardGameGeek category: Card Game).');
  }
  if (taste.activityGame) {
    parts.push(
      'We want an activity game: physical play such as charades, acting, movement, or other party activities (BoardGameGeek categories: Party Game, Action / Dexterity).',
    );
  }
  if (taste.extraTags.length > 0) {
    parts.push(`Preferred BoardGameGeek categories/mechanics: ${taste.extraTags.join(', ')}.`);
  }

  return parts;
}
