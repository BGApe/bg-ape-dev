import type { ChatIntent } from '../types';

const RECOMMENDATION_KEYWORDS = [
  'recommend',
  'suggestion',
  'suggest',
  'what should',
  'what game',
  'best game',
  'good game',
  'similar to',
  'like to play',
];

const QUICK_GUIDE_KEYWORDS = [
  'how to play',
  'rules',
  'rule',
  'setup',
  'set up',
  'explain',
  'teach',
  'quick guide',
  'tutorial',
  'how do',
  'what are the',
];

/**
 * Pure function — maps raw user text to a ChatIntent using keyword heuristics.
 * Swappable for an ML-based classifier without touching any UI code.
 */
export function resolveIntent(text: string): ChatIntent {
  const lower = text.toLowerCase();

  if (RECOMMENDATION_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'recommendation';
  }

  if (QUICK_GUIDE_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'quick_guide';
  }

  return 'generic';
}
