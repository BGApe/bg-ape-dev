import type { ChatMessage, ChatThread } from '@/features/chat/types';
import type { CollectionGame } from '@/features/collection/types';
import type { GameId, MessageId, ThreadId, UserId } from '@/types';

import {
  discussionHeading,
  familyVersions,
  findGameThread,
  openingTopicTitle,
  resolveGameAnchor,
} from '../lib/gameThread';
import {
  attachStrategyChildren,
  collapseRepeated,
  groupDiscussions,
  groupSolvedSegments,
  groupTopicRuns,
} from '../lib/messageGroups';
import { playerCountChips } from '../lib/playerCountChips';
import { previewSentences, strategyTitles } from '../lib/previewText';
import {
  elaboratePrompt,
  retargetGamePrompt,
  rulesFamilyNote,
  topicFollowupPrompt,
} from '../lib/replyPrompts';

const THREAD = 'thread-1' as ThreadId;

function message(
  id: string,
  role: ChatMessage['role'],
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: id as MessageId,
    threadId: THREAD,
    role,
    content,
    createdAt: 1,
    ...extra,
  };
}

describe('collapseRepeated', () => {
  it('drops a second copy of the same user question and answer', () => {
    const visible = collapseRepeated([
      message('1', 'user', 'Quick setup guide for Catan.'),
      message('2', 'assistant', 'Place the board.'),
      message('3', 'user', 'Quick setup guide for Catan.'),
      message('4', 'assistant', 'Place the board.'),
    ]);

    expect(visible.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('keeps a later question that is not the same exchange', () => {
    const visible = collapseRepeated([
      message('1', 'user', 'Quick setup guide for Catan.'),
      message('2', 'assistant', 'Place the board.'),
      message('3', 'user', 'What does each player start with?'),
      message('4', 'assistant', 'Each player starts with resources.'),
    ]);

    expect(visible).toHaveLength(4);
  });
});

describe('groupSolvedSegments', () => {
  it('collapses a solved topic and leaves the next question open', () => {
    const blocks = groupSolvedSegments(
      [
        message('1', 'user', 'What does each player start with?', {
          segmentId: 'seg-1',
          segmentTitle: 'Initial resources',
        }),
        message('2', 'assistant', 'Five cards.', {
          segmentId: 'seg-1',
          segmentTitle: 'Initial resources',
        }),
        message('3', 'user', 'How does combat work?', {
          segmentId: 'seg-2',
          segmentTitle: 'Combat',
        }),
        message('4', 'assistant', 'Roll two dice.', {
          segmentId: 'seg-2',
          segmentTitle: 'Combat',
        }),
      ],
      ['seg-1'],
    );

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ kind: 'segment', id: 'seg-1', title: 'Initial resources' });
    expect(blocks[1]).toMatchObject({ kind: 'message' });
    expect(blocks[2]).toMatchObject({ kind: 'message' });
  });
});

describe('groupTopicRuns', () => {
  it('collapses the opening exchange once a later topic starts', () => {
    const blocks = groupTopicRuns(
      [
        message(
          '1',
          'user',
          'Quick setup guide for Dominion. Give me just enough to start playing right now (5 minutes).',
        ),
        message('2', 'assistant', 'Lay out the supply.'),
        message('3', 'user', 'Explain scoring.', {
          segmentId: 'seg-score',
          segmentTitle: 'Scoring',
        }),
        message('4', 'assistant', 'Count victory points.', {
          segmentId: 'seg-score',
          segmentTitle: 'Scoring',
        }),
      ],
      'setup',
    );

    expect(blocks[0]).toMatchObject({ kind: 'segment', title: '5 minute setup' });
    expect(blocks[1]).toMatchObject({ kind: 'segment', title: 'Scoring' });
  });

  it('nests a strategy follow-up under popular strategies', () => {
    const blocks = attachStrategyChildren(
      groupTopicRuns(
        [
          message('1', 'assistant', '1. Big Money\nBuy treasure.\n\n2. Engine\nBuy actions.', {
            segmentId: 'seg-pop',
            segmentTitle: 'Popular strategies',
          }),
          message('2', 'assistant', 'Buy only treasure.', {
            segmentId: 'seg-detail',
            segmentTitle: 'Big Money',
            parentSegmentId: 'seg-pop',
          }),
        ],
        'setup',
      ),
      'Popular strategies',
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ title: 'Popular strategies' });
    if (blocks[0]?.kind !== 'segment') return;
    expect(blocks[0].children.map((child) => child.title)).toEqual(['Big Money']);
  });
});

describe('game threads', () => {
  it('names a setup discussion with the version and player count', () => {
    expect(discussionHeading('Dominion Prosperity', 'setup', '4')).toBe(
      'Dominion Prosperity: Quick setup (for 4 players)',
    );
    expect(discussionHeading('Dominion', 'rules', '2')).toBe(
      'Dominion: Rules help (for 2 players)',
    );
    expect(
      openingTopicTitle('setup', 'Give me just enough to start playing right now (5 minutes).'),
    ).toBe('5 minute setup');
    expect(
      openingTopicTitle('rules', 'Rules question for Dominion. Topic: Scoring. Explain scoring.'),
    ).toBe('Scoring');
  });

  it('stores an expansion discussion on the parent game', () => {
    const dominion = {
      id: 'base' as GameId,
      name: 'Dominion',
      kind: 'base',
      bggId: 36218,
      source: 'bgg',
      addedAt: 1,
    } satisfies CollectionGame;
    const prosperity = {
      id: 'exp' as GameId,
      name: 'Dominion: Prosperity',
      kind: 'expansion',
      bggId: 1,
      parentBggId: 36218,
      source: 'bgg',
      addedAt: 2,
    } satisfies CollectionGame;

    const anchor = resolveGameAnchor({ gameId: prosperity.id, gameName: prosperity.name }, [
      dominion,
      prosperity,
    ]);

    expect(anchor).not.toBeNull();
    if (anchor === null) return;
    expect(anchor.gameName).toBe('Dominion');
    expect(anchor.versionName).toBe('Dominion: Prosperity');
    expect(anchor.key).toBe('game:base');

    const older = {
      id: 'thread-prosperity' as ThreadId,
      userId: 'user' as UserId,
      title: 'Dominion: Prosperity',
      reason: 'setup',
      createdAt: 1,
      updatedAt: 10,
      gameId: prosperity.id,
      gameName: prosperity.name,
    } satisfies ChatThread;

    expect(findGameThread([older], anchor, [dominion, prosperity])?.id).toBe(older.id);
  });

  it('names an older setup from the prompt when it has no discussion title', () => {
    const [group] = groupDiscussions(
      [
        message(
          '1',
          'user',
          'Quick setup guide for Dominion: Prosperity. We are 4 players. Give me just enough to start playing right now (5 minutes).',
        ),
        message('2', 'assistant', 'Lay out the supply.'),
      ],
      { title: 'Dominion: Quick setup', kind: 'setup', versionName: 'Dominion' },
    );

    expect(group?.title).toBe('Dominion: Prosperity: Quick setup (for 4 players)');
    expect(group?.versionName).toBe('Dominion: Prosperity');
    expect(group?.playerCount).toBe('4');
  });
});

describe('player count chips', () => {
  it('limits chips to the published player range', () => {
    expect(playerCountChips(2, 4)).toEqual(['2', '3', '4']);
    expect(playerCountChips()).toEqual(['1', '2', '3', '4', '5', '6', '6+']);
  });
});

describe('rules family note', () => {
  it('names the base game and the owned expansions', () => {
    const note = rulesFamilyNote({ name: 'Dominion', kind: 'base', bggId: 36218 }, [
      { name: 'Dominion', kind: 'base', bggId: 36218 },
      { name: 'Dominion: Prosperity', kind: 'expansion', parentBggId: 36218 },
    ]);
    expect(note).toContain('Dominion');
    expect(note).toContain('Dominion: Prosperity');
    expect(note).toContain('not in the base game');
  });
});

describe('follow-up prompts', () => {
  it('keeps a topic question in the same game', () => {
    const prompt = topicFollowupPrompt('Catan', 'Initial resources');
    expect(prompt.label).toBe('Initial resources');
    expect(prompt.text).toContain('Catan');
    expect(prompt.text).toContain('What does each player start with?');
  });

  it('asks for a deeper answer on the same topic', () => {
    const prompt = elaboratePrompt('Catan', 'Initial resources');
    expect(prompt.label).toContain('Initial resources');
    expect(prompt.text).toContain('Do not repeat your previous answer');
  });

  it('rewrites the opening request for a different game', () => {
    const prompt = retargetGamePrompt(
      'Quick setup guide for Catan. We are 4 players.',
      'Catan',
      'Azul',
      'setup',
    );
    expect(prompt.text).toContain('Quick setup guide for Azul.');
    expect(prompt.text).toContain('We are 4 players.');
    expect(prompt.text).not.toContain('Catan');
  });
});

describe('topic previews', () => {
  it('keeps the first two sentences and the numbered strategy titles', () => {
    expect(previewSentences('Lay out the cards. Deal five copper. Then start.')).toBe(
      'Lay out the cards. Deal five copper.',
    );
    expect(
      strategyTitles(
        '1. Big Money\nBuy treasure.\n\n2. Engine\nBuy actions.\n\n3. Rush\nEnd early.',
      ),
    ).toEqual(['Big Money', 'Engine', 'Rush']);
  });

  it('lists the base game and owned expansions', () => {
    const dominion = {
      id: 'base' as GameId,
      name: 'Dominion',
      kind: 'base',
      bggId: 36218,
      source: 'bgg',
      addedAt: 1,
    } satisfies CollectionGame;
    const prosperity = {
      id: 'exp' as GameId,
      name: 'Dominion: Prosperity',
      kind: 'expansion',
      bggId: 1,
      parentBggId: 36218,
      source: 'bgg',
      addedAt: 2,
    } satisfies CollectionGame;
    expect(
      familyVersions([dominion, prosperity], dominion, 'Dominion: Prosperity').map(
        (item) => item.name,
      ),
    ).toEqual(['Dominion', 'Dominion: Prosperity']);
  });
});
