import type { AssistantProvider } from '@/features/assistant/services/AssistantProvider';
import type {
  AssistantChunk,
  AssistantRequest,
  AssistantResponse,
} from '@/features/assistant/types';

const MOCK_RESPONSES: Record<string, AssistantResponse> = {
  recommendation: {
    type: 'recommendation',
    title: 'Game Recommendation',
    summary:
      'Based on your preferences, here are some games that should be a great fit for your group.',
    bullets: [
      'Wingspan — strategic engine builder, 1–5 players, ~60–90 min',
      'Ticket to Ride — accessible route-building, great for all skill levels',
      'Azul — elegant abstract tile-placement, plays in 30–45 min',
      'Cascadia — relaxing nature puzzle, easy to teach, competitive scoring',
    ],
  },
  quick_guide: {
    type: 'quick_guide',
    title: 'Quick-Start Guide',
    summary: 'Here is a concise overview to get your game started quickly.',
    bullets: [
      'Set up the board and distribute starting resources to each player',
      'Youngest player goes first; play proceeds clockwise',
      'On your turn: take one action (move, build, or trade)',
      'Game ends when a player reaches the victory condition',
      'Count all points — highest score wins!',
    ],
  },
  generic: {
    type: 'generic',
    title: 'Assistant Response',
    summary: 'Here is some helpful information about your board game question.',
    bullets: [
      'Board games are a great way to spend time with friends and family',
      'Check BoardGameGeek for detailed rules, reviews, and community tips',
      'Most hobby game stores offer demo nights to try before you buy',
    ],
  },
};

/** Clarifying question responses — used on the first message when context is thin. */
const CLARIFYING: Record<string, AssistantResponse> = {
  recommendation: {
    type: 'generic',
    title: 'A couple of quick questions',
    summary: 'Happy to help find the perfect game! To narrow it down:',
    bullets: [
      "What's the experience mix — new players, mostly veterans, or a mix?",
      "Any mood for tonight — competitive, cooperative, social/party, or doesn't matter?",
    ],
  },
  setup: {
    type: 'generic',
    title: 'One quick question',
    summary: 'Happy to walk you through it! Before I start:',
    bullets: [
      "Has anyone in the group played a similar game before (e.g. another engine-builder or worker-placement)? I'll adjust the level of detail.",
    ],
  },
  rules: {
    type: 'generic',
    title: 'Quick clarification',
    summary: 'To make sure I answer exactly the right thing:',
    bullets: [
      "Could you describe the specific situation you're unsure about? (e.g. which step of the turn, which card, which phase) — that way I can give you a precise answer.",
    ],
  },
};

/**
 * Returns true if the user's message already contains structured filter signals
 * from the intent screen (players, complexity, time, collection constraint, etc.).
 * When signals are present the assistant skips clarifying questions.
 */
function hasFilterSignals(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\d+\s*player/.test(t) ||
    t.includes('complexity') ||
    t.includes('minutes') ||
    t.includes('from my collection') ||
    t.includes('category') ||
    t.includes('mechanics') ||
    t.includes('table space') ||
    t.includes('cooperative') ||
    t.includes('competitive')
  );
}

function shouldAskClarifying(request: AssistantRequest): boolean {
  if (!request.isFirstMessage) return false;

  if (request.threadReason === 'recommendation') {
    return !hasFilterSignals(request.text);
  }

  // setup and rules always benefit from one clarifying question
  return request.threadReason === 'setup' || request.threadReason === 'rules';
}

const STREAM_CHUNK_SIZE = 6;
const STREAM_INTERVAL_MS = 40;

function buildStreamText(response: AssistantResponse): string {
  const bulletLines = response.bullets.map((b) => `• ${b}`).join('\n');
  return `${response.title}\n\n${response.summary}\n\n${bulletLines}`;
}

export class MockAssistantProvider implements AssistantProvider {
  complete(request: AssistantRequest): Promise<AssistantResponse> {
    const response = shouldAskClarifying(request)
      ? (CLARIFYING[request.threadReason] ?? MOCK_RESPONSES['generic'])
      : (MOCK_RESPONSES[request.intent] ?? MOCK_RESPONSES['generic']);
    return Promise.resolve(response as AssistantResponse);
  }

  async *stream(request: AssistantRequest): AsyncIterable<AssistantChunk> {
    const response = shouldAskClarifying(request)
      ? (CLARIFYING[request.threadReason] ?? MOCK_RESPONSES['generic'])
      : (MOCK_RESPONSES[request.intent] ?? MOCK_RESPONSES['generic']);
    const fullText = buildStreamText(response as AssistantResponse);

    for (let i = 0; i < fullText.length; i += STREAM_CHUNK_SIZE) {
      const delta = fullText.slice(i, i + STREAM_CHUNK_SIZE);
      const done = i + STREAM_CHUNK_SIZE >= fullText.length;

      await new Promise<void>((resolve) => setTimeout(resolve, STREAM_INTERVAL_MS));

      yield { delta, done };

      if (done) return;
    }

    yield { delta: '', done: true };
  }
}

export const mockAssistantProvider = new MockAssistantProvider();
