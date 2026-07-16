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
      'Based on your interests, here are some games you might enjoy playing with your group.',
    bullets: [
      'Wingspan — strategic card-driven engine builder, 1–5 players',
      'Ticket to Ride — accessible route-building, great for all ages',
      'Azul — abstract tile-placement with elegant rules',
      'Cascadia — relaxing nature-themed puzzle, plays in 30–45 min',
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

const STREAM_CHUNK_SIZE = 6;
const STREAM_INTERVAL_MS = 40;

function buildStreamText(response: AssistantResponse): string {
  const bulletLines = response.bullets.map((b) => `• ${b}`).join('\n');
  return `${response.title}\n\n${response.summary}\n\n${bulletLines}`;
}

export class MockAssistantProvider implements AssistantProvider {
  complete(request: AssistantRequest): Promise<AssistantResponse> {
    const response = MOCK_RESPONSES[request.intent] ?? MOCK_RESPONSES['generic'];
    return Promise.resolve(response as AssistantResponse);
  }

  async *stream(request: AssistantRequest): AsyncIterable<AssistantChunk> {
    const response = MOCK_RESPONSES[request.intent] ?? MOCK_RESPONSES['generic'];
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
