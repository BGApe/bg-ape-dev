import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Copy } from '@/constants/copy';
import { Routes } from '@/constants/routes';
import { detectSetupDepth } from '@/features/assistant/lib/collectionContext';
import type { SetupDepth } from '@/features/assistant/types';
import { useBggGameProfile } from '@/features/collection/hooks/useBggGameProfile';
import { useCollection } from '@/features/collection/hooks/useCollection';
import { mapError } from '@/lib/mapError';
import {
  recordGameplayQuestion,
  type RulesFaqItem,
  type WinningStrategy,
} from '@/services/bgg/gameProfile';
import { logger } from '@/services/logger';
import { useChatUiStore } from '@/store/chatUiStore';
import { useComposerStore } from '@/store/composerStore';
import type { GameId } from '@/types';

import { useChatMessages } from '../hooks/useChatMessages';
import { useClearConversation } from '../hooks/useClearConversation';
import { useDeleteMessage } from '../hooks/useDeleteMessage';
import { useRecordExchange } from '../hooks/useRecordExchange';
import { useSendMessage } from '../hooks/useSendMessage';
import { useUpdateThread } from '../hooks/useUpdateThread';
import { discussionHeading, familyVersions, newDiscussionId } from '../lib/gameThread';
import {
  collapseRepeated,
  attachStrategyChildren,
  groupDiscussions,
  groupSolvedSegments,
  groupTopicRuns,
  newSegmentId,
  type DiscussionGroup,
} from '../lib/messageGroups';
import { playerCountChips } from '../lib/playerCountChips';
import { previewSentences, strategyTitles } from '../lib/previewText';
import {
  groupRecommendationRounds,
  type RecommendationRound,
  type RecommendationTip,
} from '../lib/recommendationRounds';
import {
  coreMechanicsPrompt,
  differentStrategiesPrompt,
  payAttentionPrompt,
  popularStrategiesPrompt,
  retargetGamePrompt,
  setupDepthPrompt,
  strategyFocusPrompt,
} from '../lib/replyPrompts';
import { splitSetupSections } from '../lib/setupSections';
import { REASON_EMOJI } from '../reasons';
import type { ChatMessage, ChatThread, ChatThreadPatch, DiscussionKind } from '../types';

import { CollapseBar } from './CollapseBar';
import { Composer } from './Composer';
import { GameContextCard } from './GameContextCard';
import { GameReplyBar, type GameReplyLayer } from './GameReplyBar';
import { GameSwitchSheet } from './GameSwitchSheet';
import { MessageBubble } from './MessageBubble';
import { RecommendationActions } from './RecommendationActions';
import { RecommendationRoundCard, type RecommendationBranch } from './RecommendationRoundCard';
import { ReplyActions, type ReplyFollowup, type ReplyMenu } from './ReplyActions';
import { RulesContextBar } from './RulesContextBar';
import { SetupContextBar } from './SetupContextBar';
import { SetupSectionList } from './SetupSectionList';
import { SolvedSegmentCard } from './SolvedSegmentCard';
import { TopicPreview } from './TopicPreview';

type Props = {
  thread: ChatThread;
  onBack: () => void;
};

type ChatRow =
  | {
      key: string;
      type: 'discussion';
      id: string;
      title: string;
      expanded: boolean;
      kind: DiscussionKind;
      versionName: string;
      playerCount?: string;
      depth?: SetupDepth;
    }
  | {
      key: string;
      type: 'umbrella';
      id: string;
      title: string;
      intro: string;
      expanded: boolean;
      tips: RecommendationTip[];
      branches: RecommendationBranch[];
    }
  | {
      key: string;
      type: 'segment';
      id: string;
      title: string;
      messages: ChatMessage[];
      children: { id: string; title: string; messages: ChatMessage[] }[];
    }
  | { key: string; type: 'message'; message: ChatMessage };

function tipNamesOf(round: RecommendationRound | undefined): string[] {
  if (round === undefined) return [];
  for (let index = round.topics.length - 1; index >= 0; index -= 1) {
    const tips = round.topics[index]?.tips ?? [];
    if (tips.length > 0) return tips.map((tip) => tip.name);
  }
  return round.tips.map((tip) => tip.name);
}

function discussionFields(discussion: DiscussionGroup): {
  discussionId?: string;
  discussionTitle?: string;
  discussionKind?: DiscussionKind;
  versionName?: string;
  playerCount?: string;
  turnReason: DiscussionKind;
} {
  const turnReason = discussion.kind;
  if (discussion.id === 'legacy') return { discussionId: 'legacy', turnReason };
  return {
    discussionId: discussion.id,
    discussionTitle: discussion.title,
    discussionKind: discussion.kind,
    versionName: discussion.versionName,
    turnReason,
    ...(discussion.playerCount !== undefined ? { playerCount: discussion.playerCount } : {}),
  };
}

export function Conversation({ thread, onBack }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { data: fetchedMessages = [] } = useChatMessages(thread);
  const messages = collapseRepeated(fetchedMessages);
  const sendMessage = useSendMessage(thread);
  const updateThread = useUpdateThread();
  const recordExchange = useRecordExchange(thread);
  const clearConversation = useClearConversation(thread);
  const deleteMessage = useDeleteMessage(thread);
  const draft = useComposerStore((s) => s.draft);
  const setDraft = useComposerStore((s) => s.setDraft);
  const router = useRouter();
  const pendingMessage = useChatUiStore((s) => s.pendingMessage);
  const pendingTurn = useChatUiStore((s) => s.pendingTurn);
  const discussionFilter = useChatUiStore((s) => s.discussionFilter);
  const setDiscussionFilter = useChatUiStore((s) => s.setDiscussionFilter);
  const versionSeed = useChatUiStore((s) => s.versionSeed);
  const setVersionSeed = useChatUiStore((s) => s.setVersionSeed);
  const { data: collectionGames = [] } = useCollection();
  const canSwitchGame =
    thread.gameKey === undefined && (thread.reason === 'setup' || thread.reason === 'rules');
  const contextGame =
    thread.gameId !== undefined
      ? collectionGames.find((game) => game.id === thread.gameId)
      : thread.gameName !== undefined
        ? collectionGames.find((game) => game.name.toLowerCase() === thread.gameName?.toLowerCase())
        : undefined;

  const [menu, setMenu] = useState<ReplyMenu>(thread.reason === 'rules' ? 'topics' : 'root');
  const [dismissedSegmentId, setDismissedSegmentId] = useState<string | null>(null);
  const [expandedSegmentIds, setExpandedSegmentIds] = useState<string[]>([]);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [chosenDiscussionId, setChosenDiscussionId] = useState<string | null>('');
  const [activeDiscussionId, setActiveDiscussionId] = useState<string | null>(null);
  const [focusedSegmentKey, setFocusedSegmentKey] = useState<string | null>(null);
  const [rulesPick, setRulesPick] = useState<{ versionName: string; playerCount?: string } | null>(
    null,
  );
  const [faqOpen, setFaqOpen] = useState(false);
  const [strategyRepeatAsk, setStrategyRepeatAsk] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [chosenRoundId, setChosenRoundId] = useState<string | null>(null);
  const [chosenTopicId, setChosenTopicId] = useState<string | null>('');
  const [openTipId, setOpenTipId] = useState<string | null>(null);
  const [seenThreadId, setSeenThreadId] = useState(thread.id);
  if (seenThreadId !== thread.id) {
    setSeenThreadId(thread.id);
    setMenu(thread.reason === 'rules' ? 'topics' : 'root');
    setDismissedSegmentId(null);
    setExpandedSegmentIds([]);
    setNotice(null);
    setSwitchOpen(false);
    setChosenDiscussionId('');
    setActiveDiscussionId(null);
    setFocusedSegmentKey(null);
    setRulesPick(null);
    setFaqOpen(false);
    setExpandedFaq(null);
    setStrategyRepeatAsk(false);
    setChosenRoundId(null);
    setChosenTopicId('');
    setOpenTipId(null);
  }

  /** Auto-send any message queued by the intent screen, once per prompt. */
  useEffect(() => {
    if (pendingTurn) {
      if (!useChatUiStore.getState().tryConsumePendingTurn(pendingTurn)) return;
      setChosenDiscussionId(pendingTurn.discussionId);
      setActiveDiscussionId(pendingTurn.discussionId);
      const pendingKey =
        pendingTurn.segmentId !== undefined
          ? `${pendingTurn.discussionId}-${pendingTurn.segmentId}`
          : `${pendingTurn.discussionId}-opening`;
      setExpandedSegmentIds([pendingKey]);
      setFocusedSegmentKey(pendingKey);
      sendMessage.mutate({
        text: pendingTurn.text,
        discussionId: pendingTurn.discussionId,
        discussionTitle: pendingTurn.discussionTitle,
        discussionKind: pendingTurn.discussionKind,
        versionName: pendingTurn.versionName,
        turnReason: pendingTurn.discussionKind,
        ...(pendingTurn.segmentId !== undefined ? { segmentId: pendingTurn.segmentId } : {}),
        ...(pendingTurn.segmentTitle !== undefined
          ? { segmentTitle: pendingTurn.segmentTitle }
          : {}),
        ...(pendingTurn.playerCount !== undefined ? { playerCount: pendingTurn.playerCount } : {}),
        ...(pendingTurn.label !== undefined ? { label: pendingTurn.label } : {}),
      });
      return;
    }
    if (!pendingMessage) return;
    if (!useChatUiStore.getState().tryConsumePending(pendingMessage)) return;
    sendMessage.mutate(pendingMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id, pendingMessage, pendingTurn]);

  useEffect(() => {
    if (versionSeed === null || versionSeed.length === 0) return;
    setRulesPick({ versionName: versionSeed });
    setVersionSeed(null);
  }, [setVersionSeed, versionSeed]);

  const isSending = sendMessage.isPending || recordExchange.isPending || updateThread.isPending;
  const error = sendMessage.error ? mapError(sendMessage.error) : null;
  const topicKind = thread.reason === 'rules' ? 'rules' : 'setup';
  const unified =
    thread.gameKey !== undefined || messages.some((message) => message.discussionId !== undefined);
  const discussions = unified
    ? groupDiscussions(messages, {
        title: discussionHeading(thread.gameName ?? thread.title, topicKind),
        kind: topicKind,
        versionName: thread.gameName ?? thread.title,
      })
    : [];
  const visibleDiscussions =
    discussionFilter === null
      ? discussions
      : discussions.filter((discussion) => discussion.kind === discussionFilter);
  const latestDiscussionId = visibleDiscussions[visibleDiscussions.length - 1]?.id ?? null;
  const openDiscussionId =
    chosenDiscussionId === '' ? null : (chosenDiscussionId ?? latestDiscussionId);
  const openDiscussion = visibleDiscussions.find(
    (discussion) => discussion.id === openDiscussionId,
  );
  const blocks =
    thread.reason === 'setup' || thread.reason === 'rules'
      ? groupTopicRuns(messages, topicKind)
      : groupSolvedSegments(messages, thread.solvedSegmentIds ?? []);
  const recommendationRounds =
    !unified && thread.reason === 'recommendation' ? groupRecommendationRounds(messages) : [];
  const latestRoundId = recommendationRounds[recommendationRounds.length - 1]?.id ?? null;
  const openRoundId = chosenRoundId === '' ? null : (chosenRoundId ?? latestRoundId);
  const openRound = recommendationRounds.find((round) => round.id === openRoundId);
  const latestTopicId = openRound?.topics[openRound.topics.length - 1]?.id ?? null;
  const expandedTopicId = chosenTopicId === '' ? null : (chosenTopicId ?? latestTopicId);
  const latestRecommendationRound = [...recommendationRounds]
    .reverse()
    .find((round) => round.tips.length > 0 || round.topics.some((topic) => topic.tips.length > 0));
  const browseGames = tipNamesOf(openRound ?? latestRecommendationRound);
  const recommendationRows: ChatRow[] = recommendationRounds.map((round) => {
    const expanded = round.id === openRoundId;
    return {
      key: `round-${round.id}`,
      type: 'umbrella',
      id: round.id,
      title: round.query,
      intro: round.intro,
      expanded,
      tips: round.tips,
      branches: round.topics.map((topic) => ({
        id: topic.id,
        title: topic.title,
        intro: topic.intro,
        expanded: expanded && topic.id === expandedTopicId,
        tips: topic.tips,
      })),
    };
  });
  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const solvedIds = thread.solvedSegmentIds ?? [];
  const followup: ReplyFollowup | null =
    latestAssistant?.segmentId !== undefined &&
    latestAssistant.segmentTitle !== undefined &&
    !solvedIds.includes(latestAssistant.segmentId) &&
    dismissedSegmentId !== latestAssistant.segmentId
      ? { segmentId: latestAssistant.segmentId, segmentTitle: latestAssistant.segmentTitle }
      : null;

  const setupDiscussions = discussions.filter((discussion) => discussion.kind === 'setup');
  const setupTarget =
    (openDiscussion?.kind === 'setup' ? openDiscussion : undefined) ??
    setupDiscussions.find((discussion) => discussion.id === activeDiscussionId) ??
    setupDiscussions[setupDiscussions.length - 1];
  const activeDiscussion =
    discussions.find((discussion) => discussion.id === activeDiscussionId) ??
    visibleDiscussions[visibleDiscussions.length - 1];
  const rulesMode =
    unified &&
    (discussionFilter === 'rules' ||
      (discussionFilter === null && activeDiscussion?.kind === 'rules'));
  const setupMode = unified && !rulesMode;
  const latestRules = [...discussions].reverse().find((discussion) => discussion.kind === 'rules');
  const rulesVersionName =
    rulesPick?.versionName ??
    latestRules?.versionName ??
    setupTarget?.versionName ??
    thread.gameName ??
    thread.title;
  const rawPlayers =
    rulesPick !== null
      ? rulesPick.playerCount
      : (latestRules?.playerCount ?? setupTarget?.playerCount);
  const versionChoices = familyVersions(collectionGames, contextGame, rulesVersionName);
  const selectedVersion = versionChoices.find(
    (choice) => choice.name.toLowerCase() === rulesVersionName.trim().toLowerCase(),
  );
  const rulesPlayerChips = playerCountChips(
    selectedVersion?.game?.minPlayers ?? contextGame?.minPlayers,
    selectedVersion?.game?.maxPlayers ?? contextGame?.maxPlayers,
  );
  const rulesPlayerCount = rulesPlayerChips.includes(rawPlayers ?? '')
    ? rawPlayers
    : rulesPlayerChips[0];
  const profileName = rulesMode ? rulesVersionName : (setupTarget?.versionName ?? thread.gameName);
  const profileGame =
    profileName !== undefined
      ? collectionGames.find((game) => game.name.toLowerCase() === profileName.trim().toLowerCase())
      : undefined;
  const profile = useBggGameProfile(
    unified && profileName !== undefined && profileName.length > 2
      ? profileGame?.bggId !== undefined
        ? { bggId: profileGame.bggId }
        : { name: profileName }
      : null,
  );
  const openPieces =
    openDiscussion !== undefined
      ? groupTopicRuns(openDiscussion.messages, openDiscussion.kind)
      : [];
  const focusedPiece = openPieces.find(
    (piece) =>
      piece.kind === 'segment' && `${openDiscussion?.id ?? ''}-${piece.id}` === focusedSegmentKey,
  );
  const focusedTitle =
    focusedSegmentKey !== null &&
    expandedSegmentIds.includes(focusedSegmentKey) &&
    focusedPiece?.kind === 'segment'
      ? focusedPiece.title
      : undefined;
  const strategyNameList = strategyTitles(
    (setupTarget?.messages ?? [])
      .filter(
        (message) =>
          message.role === 'assistant' &&
          message.segmentTitle === Copy.chat.reply.popularStrategies,
      )
      .map((message) => message.content)
      .join('\n'),
  );
  const replyLayer: GameReplyLayer = rulesMode
    ? 'rules'
    : focusedTitle !== undefined &&
        (focusedTitle === Copy.chat.reply.popularStrategies ||
          strategyNameList.includes(focusedTitle))
      ? 'strategies'
      : focusedTitle !== undefined
        ? 'guide'
        : 'root';

  function sendRecommendation(
    text: string,
    label: string,
    segment?: { id: string; title: string },
  ) {
    if (segment === undefined) {
      setChosenRoundId(null);
      setChosenTopicId(null);
      setOpenTipId(null);
    }
    sendMessage.mutate({
      text,
      label,
      ...(segment !== undefined ? { segmentId: segment.id, segmentTitle: segment.title } : {}),
    });
  }

  function reveal(discussionId: string, segmentId: string) {
    const key = `${discussionId}-${segmentId}`;
    setChosenDiscussionId(discussionId);
    setActiveDiscussionId(discussionId);
    setExpandedSegmentIds([key]);
    setFocusedSegmentKey(key);
  }

  function sendInto(options: {
    kind: DiscussionKind;
    versionName: string;
    playerCount?: string;
    text: string;
    label: string;
    title: string;
    existing?: DiscussionGroup;
    parentSegmentId?: string;
  }) {
    const segmentId = newSegmentId();
    const players =
      options.playerCount !== undefined && options.playerCount.length > 0
        ? options.playerCount
        : undefined;
    if (options.existing !== undefined) {
      reveal(options.existing.id, segmentId);
      sendMessage.mutate({
        text: options.text,
        label: options.label,
        segmentId,
        segmentTitle: options.title,
        ...discussionFields(options.existing),
        ...(options.parentSegmentId !== undefined
          ? { parentSegmentId: options.parentSegmentId }
          : {}),
      });
      return;
    }
    const discussionId = newDiscussionId();
    reveal(discussionId, segmentId);
    sendMessage.mutate({
      text: options.text,
      label: options.label,
      segmentId,
      segmentTitle: options.title,
      discussionId,
      discussionTitle: discussionHeading(options.versionName, options.kind, players),
      discussionKind: options.kind,
      versionName: options.versionName,
      turnReason: options.kind,
      ...(players !== undefined ? { playerCount: players } : {}),
      ...(options.parentSegmentId !== undefined
        ? { parentSegmentId: options.parentSegmentId }
        : {}),
    });
  }

  function matchingRulesDiscussion(): DiscussionGroup | undefined {
    return discussions.find(
      (discussion) =>
        discussion.kind === 'rules' &&
        discussion.versionName.trim().toLowerCase() === rulesVersionName.trim().toLowerCase() &&
        discussion.playerCount === rulesPlayerCount,
    );
  }

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setDraft('');
    if (unified && rulesMode) {
      const title = trimmed.slice(0, 48);
      const existing = matchingRulesDiscussion();
      sendInto({
        kind: 'rules',
        versionName: rulesVersionName,
        ...(rulesPlayerCount !== undefined ? { playerCount: rulesPlayerCount } : {}),
        text: trimmed,
        label: title,
        title,
        ...(existing !== undefined ? { existing } : {}),
      });
      return;
    }
    if (unified) {
      const target = openDiscussion ?? visibleDiscussions[visibleDiscussions.length - 1];
      if (target !== undefined) {
        const segmentId = newSegmentId();
        reveal(target.id, segmentId);
        sendMessage.mutate({
          text: trimmed,
          segmentId,
          segmentTitle: trimmed.slice(0, 48),
          ...discussionFields(target),
        });
        return;
      }
      if (discussionFilter !== null) {
        const versionName = thread.gameName ?? thread.title;
        sendInto({
          kind: discussionFilter,
          versionName,
          text: trimmed,
          label: trimmed.slice(0, 48),
          title: trimmed.slice(0, 48),
        });
        return;
      }
    }
    if (!unified && thread.reason === 'recommendation') {
      setChosenRoundId(null);
      setChosenTopicId(null);
      setOpenTipId(null);
    }
    sendMessage.mutate(trimmed);
  }

  function handleSend() {
    sendText(draft);
  }

  function handleClear() {
    Alert.alert(Copy.chat.clearConfirmTitle, Copy.chat.clearConfirmBody, [
      { text: Copy.chat.cancel, style: 'cancel' },
      {
        text: Copy.chat.clearConversation,
        style: 'destructive',
        onPress: () => clearConversation.mutate(),
      },
    ]);
  }

  function handleDeleteMessage(message: ChatMessage) {
    if (message.id === 'streaming') return;
    Alert.alert(Copy.chat.deleteMessageTitle, Copy.chat.deleteMessageBody, [
      { text: Copy.chat.cancel, style: 'cancel' },
      {
        text: Copy.chat.delete,
        style: 'destructive',
        onPress: () => deleteMessage.mutate(message.id),
      },
    ]);
  }

  function openDiscussionForm(
    kind: DiscussionKind,
    prefillParent: boolean,
    versionOverride?: string,
  ) {
    const version = versionOverride ?? openDiscussion?.versionName ?? thread.gameName;
    const owned =
      version !== undefined
        ? collectionGames.find((game) => game.name.toLowerCase() === version.toLowerCase())
        : undefined;
    const params: Record<string, string> = {
      reason: kind,
      continueThreadId: thread.id,
    };
    if (prefillParent && thread.gameName !== undefined) params.searchPrefill = thread.gameName;
    if (!prefillParent && owned !== undefined) params.gameId = owned.id;
    else if (!prefillParent && version !== undefined) params.gameName = version;
    router.push({ pathname: Routes.intent, params });
  }

  function handleMoveToRules() {
    if (!unified) {
      setMenu('topics');
      return;
    }
    const source = setupTarget;
    setRulesPick({
      versionName: source?.versionName ?? thread.gameName ?? thread.title,
      ...(source?.playerCount !== undefined ? { playerCount: source.playerCount } : {}),
    });
    setFaqOpen(false);
    setExpandedFaq(null);
    setChosenDiscussionId('');
    setExpandedSegmentIds([]);
    setFocusedSegmentKey(null);
    setDiscussionFilter('rules');
  }

  function handleBackToSetup() {
    const match = discussions.find(
      (discussion) =>
        discussion.kind === 'setup' &&
        discussion.versionName.trim().toLowerCase() === rulesVersionName.trim().toLowerCase() &&
        (rulesPlayerCount === undefined || discussion.playerCount === rulesPlayerCount),
    );
    const fallback = [...discussions].reverse().find((discussion) => discussion.kind === 'setup');
    setDiscussionFilter('setup');
    setFaqOpen(false);
    setExpandedFaq(null);
    setChosenDiscussionId('');
    setExpandedSegmentIds([]);
    setFocusedSegmentKey(null);
    const next = match ?? fallback;
    if (next !== undefined) {
      setActiveDiscussionId(next.id);
      return;
    }
    openDiscussionForm('setup', false, rulesVersionName);
  }

  function askRules(text: string, label: string, title: string) {
    const existing = matchingRulesDiscussion();
    sendInto({
      kind: 'rules',
      versionName: rulesVersionName,
      ...(rulesPlayerCount !== undefined ? { playerCount: rulesPlayerCount } : {}),
      text,
      label,
      title,
      ...(existing !== undefined ? { existing } : {}),
    });
  }

  function insertStrategies(items: WinningStrategy[]) {
    const version = setupTarget?.versionName ?? thread.gameName ?? thread.title;
    const players = setupTarget?.playerCount;
    const segmentId = newSegmentId();
    const title = Copy.chat.reply.popularStrategies;
    const discussionId = setupTarget?.id ?? newDiscussionId();
    reveal(discussionId, segmentId);
    recordExchange.mutate({
      question: `Popular strategies for ${version}.`,
      answer: items
        .map((item, index) => `${index + 1}. ${item.title}\n${item.summary}`)
        .join('\n\n'),
      label: title,
      segmentId,
      segmentTitle: title,
      discussionId,
      discussionTitle: setupTarget?.title ?? discussionHeading(version, 'setup', players),
      discussionKind: 'setup',
      versionName: version,
      ...(players !== undefined ? { playerCount: players } : {}),
    });
  }

  const popularRun =
    setupTarget === undefined
      ? undefined
      : groupTopicRuns(setupTarget.messages, setupTarget.kind).find(
          (piece) => piece.kind === 'segment' && piece.title === Copy.chat.reply.popularStrategies,
        );
  const popularSegment = popularRun?.kind === 'segment' ? popularRun : undefined;

  async function openStrategies() {
    const version = setupTarget?.versionName ?? thread.gameName;
    if (version === undefined || version.length === 0) return;
    if (popularSegment !== undefined && setupTarget !== undefined) {
      reveal(setupTarget.id, popularSegment.id);
      setStrategyRepeatAsk(true);
      return;
    }
    let stored = profile.data?.winningStrategies ?? [];
    if (stored.length === 0) {
      try {
        const result = await profile.refetch();
        stored = result.data?.winningStrategies ?? [];
      } catch {
        stored = [];
      }
    }
    if (stored.length > 0) {
      insertStrategies(stored);
      setStrategyRepeatAsk(true);
      return;
    }
    setStrategyRepeatAsk(false);
    const prompt = popularStrategiesPrompt(version);
    sendInto({
      kind: 'setup',
      versionName: version,
      ...(setupTarget?.playerCount !== undefined ? { playerCount: setupTarget.playerCount } : {}),
      text: prompt.text,
      label: prompt.label,
      title: Copy.chat.reply.popularStrategies,
      ...(setupTarget !== undefined ? { existing: setupTarget } : {}),
    });
  }

  async function handleSwitchGame(selection: { gameId?: GameId; gameName: string }) {
    setSwitchOpen(false);
    const firstUser = messages.find((message) => message.role === 'user');
    const reason = thread.reason === 'rules' ? 'rules' : 'setup';
    const prompt = retargetGamePrompt(
      firstUser?.content ?? '',
      thread.gameName,
      selection.gameName,
      reason,
    );
    const patch: ChatThreadPatch = {
      gameName: selection.gameName,
      gameId: selection.gameId ?? null,
    };
    if (thread.gameName !== undefined && thread.title.includes(thread.gameName)) {
      patch.title = thread.title.split(thread.gameName).join(selection.gameName);
    }
    await updateThread.mutateAsync({ threadId: thread.id, patch });
    sendMessage.mutate({ text: prompt.text, label: prompt.label });
  }

  async function handleMarkSolved(segment: ReplyFollowup) {
    const related = messages.filter((message) => message.segmentId === segment.segmentId);
    const question = related.find((message) => message.role === 'user');
    const answer = [...related].reverse().find((message) => message.role === 'assistant');
    if (question !== undefined && answer !== undefined && thread.gameName !== undefined) {
      try {
        await recordGameplayQuestion({
          name: thread.gameName,
          topic: segment.segmentTitle,
          question: question.content,
          answer: answer.content,
          ...(contextGame?.bggId !== undefined ? { bggId: contextGame.bggId } : {}),
        });
        setNotice(null);
      } catch (saveError) {
        logger.captureException(saveError, { mapped: mapError(saveError) });
        setNotice(Copy.chat.reply.sharedSaveFailed);
      }
    }
    if (solvedIds.includes(segment.segmentId)) return;
    await updateThread.mutateAsync({
      threadId: thread.id,
      patch: { solvedSegmentIds: [...solvedIds, segment.segmentId] },
    });
  }

  function handleInsertFaq(item: RulesFaqItem) {
    const title = item.question.trim().slice(0, 80);
    const stamp = openDiscussion !== undefined ? discussionFields(openDiscussion) : undefined;
    recordExchange.mutate({
      question: item.question,
      answer: item.answer,
      label: title,
      segmentId: newSegmentId(),
      segmentTitle: title.length > 0 ? title : 'Rules question',
      ...(stamp?.discussionId !== undefined ? { discussionId: stamp.discussionId } : {}),
      ...(stamp?.discussionTitle !== undefined ? { discussionTitle: stamp.discussionTitle } : {}),
      ...(stamp?.discussionKind !== undefined ? { discussionKind: stamp.discussionKind } : {}),
      ...(stamp?.versionName !== undefined ? { versionName: stamp.versionName } : {}),
      ...(stamp?.playerCount !== undefined ? { playerCount: stamp.playerCount } : {}),
    });
    setDismissedSegmentId(null);
  }

  function toggleSegment(id: string) {
    setStrategyRepeatAsk(false);
    if (expandedSegmentIds.includes(id)) {
      setExpandedSegmentIds(expandedSegmentIds.filter((item) => item !== id));
      if (focusedSegmentKey === id) setFocusedSegmentKey(null);
      return;
    }
    setExpandedSegmentIds([...expandedSegmentIds, id]);
    setFocusedSegmentKey(id);
  }

  const thinkingRow = sendMessage.isPending ? (
    <View className="mx-4 mb-2 flex-row items-center gap-2 self-start rounded-2xl bg-[#1A1A1A] px-4 py-3">
      <ActivityIndicator color="#818CF8" size="small" />
      <Text className="text-sm text-neutral-400">{Copy.chat.thinking}</Text>
    </View>
  ) : null;

  const errorBanner =
    error !== null ? (
      <View className="mx-4 mb-2 rounded-xl bg-red-500/20 px-4 py-3">
        <Text className="text-sm text-red-400">{error.message}</Text>
        <Text className="mt-1 text-xs text-red-300 underline" onPress={() => sendMessage.reset()}>
          {Copy.chat.errorRetry}
        </Text>
      </View>
    ) : null;

  const noticeBanner =
    notice !== null ? (
      <View className="mx-4 mb-2 rounded-xl bg-[#818CF8]/15 px-4 py-3">
        <Text className="text-sm text-[#C7D2FE]">{notice}</Text>
      </View>
    ) : null;

  const composer = (
    <Composer
      value={draft}
      onChangeText={setDraft}
      onSend={handleSend}
      isSending={sendMessage.isPending}
    />
  );

  const gameRows: ChatRow[] = [];
  if (unified) {
    for (const discussion of visibleDiscussions) {
      const expanded = discussion.id === openDiscussionId;
      const firstAsk = discussion.messages.find((message) => message.role === 'user');
      const depth =
        discussion.kind === 'setup' && firstAsk !== undefined
          ? detectSetupDepth(firstAsk.content)
          : undefined;
      gameRows.push({
        key: `discussion-${discussion.id}`,
        type: 'discussion',
        id: discussion.id,
        title: discussion.title,
        expanded,
        kind: discussion.kind,
        versionName: discussion.versionName,
        ...(discussion.playerCount !== undefined ? { playerCount: discussion.playerCount } : {}),
        ...(depth !== undefined ? { depth } : {}),
      });
      if (!expanded) continue;
      const pieces = attachStrategyChildren(
        groupTopicRuns(discussion.messages, discussion.kind),
        Copy.chat.reply.popularStrategies,
      );
      for (const piece of pieces) {
        if (piece.kind === 'segment') {
          gameRows.push({
            key: `segment-${discussion.id}-${piece.id}`,
            type: 'segment',
            id: `${discussion.id}-${piece.id}`,
            title: piece.title,
            messages: piece.messages,
            children: piece.children.map((child) => ({
              id: `${discussion.id}-${child.id}`,
              title: child.title,
              messages: child.messages,
            })),
          });
        } else {
          gameRows.push({ key: piece.message.id, type: 'message', message: piece.message });
        }
      }
    }
  }

  const newDiscussionButton =
    unified && !rulesMode ? (
      <View className="mx-4 mb-3 gap-2">
        {visibleDiscussions.length === 0 && (
          <Text className="text-sm text-neutral-400">{Copy.chat.reply.gameChatEmpty}</Text>
        )}
        {(discussionFilter === null ? (['setup', 'rules'] as const) : [discussionFilter]).map(
          (kind) => (
            <TouchableOpacity
              key={kind}
              onPress={() => openDiscussionForm(kind, true)}
              accessibilityRole="button"
              className="rounded-2xl border border-[#818CF8] bg-[#818CF8]/15 px-4 py-3"
            >
              <Text className="text-center text-sm text-[#C7D2FE]">
                {kind === 'setup' ? Copy.chat.reply.differentSetup : Copy.chat.reply.differentRules}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </View>
    ) : null;

  const replyActions =
    !unified && latestAssistant !== undefined && !sendMessage.isPending ? (
      <ReplyActions
        thread={thread}
        resetKey={latestAssistant.id}
        games={collectionGames}
        disabled={isSending}
        menu={menu}
        followup={followup}
        onSend={(text, label, segment) => {
          if (segment !== undefined) setExpandedSegmentIds([segment.id]);
          sendMessage.mutate({
            text,
            label,
            ...(segment !== undefined
              ? { segmentId: segment.id, segmentTitle: segment.title }
              : {}),
          });
        }}
        onInsertStrategies={(items) => {
          const segmentId = newSegmentId();
          const title = Copy.chat.reply.popularStrategies;
          const game = thread.gameName ?? thread.title;
          setExpandedSegmentIds([segmentId]);
          recordExchange.mutate({
            question: `Popular strategies for ${game}.`,
            answer: items
              .map((item, index) => `${index + 1}. ${item.title}\n${item.summary}`)
              .join('\n\n'),
            label: title,
            segmentId,
            segmentTitle: title,
          });
        }}
        onMenu={setMenu}
        onMoveToRules={() => {
          void handleMoveToRules();
        }}
        onDismissFollowup={() => {
          if (followup !== null) setDismissedSegmentId(followup.segmentId);
          setMenu('topics');
        }}
        onMarkSolved={(segment) => {
          void handleMarkSolved(segment);
        }}
        onInsertFaq={handleInsertFaq}
      />
    ) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="border-b border-[#2A2A2A] pb-2">
        <View className="flex-row items-center gap-2 px-3 pt-1">
          <TouchableOpacity
            onPress={onBack}
            className="px-2 py-1"
            accessibilityRole="button"
            accessibilityLabel={Copy.tabs.chat}
          >
            <Text className="text-lg text-neutral-300">‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1"
            disabled={!canSwitchGame}
            onPress={() => setSwitchOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={Copy.chat.reply.changeGame}
          >
            <Text className="text-base font-semibold text-[#F9F9F9]" numberOfLines={1}>
              {REASON_EMOJI[thread.gameKey !== undefined ? 'general' : thread.reason]}{' '}
              {thread.title}
              {canSwitchGame ? '  ▾' : ''}
            </Text>
            {thread.gameKey !== undefined && discussionFilter !== null ? (
              <Text className="text-xs text-neutral-500" numberOfLines={1}>
                {discussionFilter === 'setup' ? Copy.chat.reasons.setup : Copy.chat.reasons.rules}
              </Text>
            ) : (
              thread.gameName !== undefined &&
              thread.gameName !== thread.title && (
                <Text className="text-xs text-neutral-500" numberOfLines={1}>
                  {thread.gameName}
                </Text>
              )
            )}
          </TouchableOpacity>
          {messages.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              className="px-2 py-1"
              accessibilityRole="button"
              accessibilityLabel={Copy.chat.clearConversation}
            >
              <Text className="text-sm text-neutral-400">{Copy.chat.clearConversation}</Text>
            </TouchableOpacity>
          )}
        </View>
        {unified && thread.gameName !== undefined && (
          <GameContextCard gameName={thread.gameName} game={contextGame} />
        )}
        {rulesMode && (
          <RulesContextBar
            playerChips={rulesPlayerChips}
            playerCount={rulesPlayerCount}
            versions={versionChoices}
            versionName={rulesVersionName}
            onPlayerCount={(count) =>
              setRulesPick({ versionName: rulesVersionName, playerCount: count })
            }
            onVersion={(name) =>
              setRulesPick({
                versionName: name,
                ...(rulesPlayerCount !== undefined ? { playerCount: rulesPlayerCount } : {}),
              })
            }
          />
        )}
      </View>

      {messages.length === 0 && !unified ? (
        <View className="flex-1 justify-center px-2">
          <Text className="mb-6 px-6 text-center text-base text-neutral-400">
            {Copy.chat.emptyState}
          </Text>
          <View className="mb-6 gap-2 px-4">
            {Copy.chat.starters.map((starter) => (
              <TouchableOpacity
                key={starter}
                onPress={() => sendText(starter)}
                disabled={sendMessage.isPending}
                className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3"
                accessibilityRole="button"
              >
                <Text className="text-sm text-[#F9F9F9]">{starter}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {thinkingRow}
          {errorBanner}
          {noticeBanner}
          {composer}
        </View>
      ) : (
        <View className="flex-1">
          <FlashList
            data={
              unified
                ? gameRows
                : thread.reason === 'recommendation'
                  ? recommendationRows
                  : blocks.map(
                      (block): ChatRow =>
                        block.kind === 'segment'
                          ? {
                              key: `segment-${block.id}`,
                              type: 'segment',
                              id: block.id,
                              title: block.title,
                              messages: block.messages,
                              children: [],
                            }
                          : { key: block.message.id, type: 'message', message: block.message },
                    )
            }
            keyExtractor={(item) => item.key}
            extraData={`${expandedSegmentIds.join('|')}:${focusedSegmentKey ?? ''}:${menu}:${followup?.segmentId ?? ''}:${sendMessage.isPending}:${openDiscussionId ?? ''}:${openRoundId ?? ''}:${expandedTopicId ?? ''}:${openTipId ?? ''}:${replyLayer}:${faqOpen}:${strategyRepeatAsk}:${rulesVersionName}:${rulesPlayerCount ?? ''}`}
            renderItem={({ item }) => {
              if (item.type === 'umbrella') {
                return (
                  <RecommendationRoundCard
                    title={item.title}
                    intro={item.intro}
                    expanded={item.expanded}
                    tips={item.tips}
                    branches={item.branches}
                    openTipId={openTipId}
                    pending={sendMessage.isPending}
                    messages={messages}
                    games={collectionGames}
                    disabled={isSending}
                    latestGames={browseGames}
                    onToggle={() => {
                      if (item.expanded) {
                        setChosenRoundId('');
                        setOpenTipId((current) =>
                          current !== null && current.startsWith(`${item.id}:`) ? null : current,
                        );
                        return;
                      }
                      setChosenRoundId(item.id);
                      setOpenTipId(null);
                    }}
                    onToggleBranch={(id, expanded) => {
                      setOpenTipId(null);
                      setChosenTopicId(expanded ? '' : id);
                    }}
                    onToggleTip={(id) => {
                      setChosenTopicId('');
                      setOpenTipId((current) => (current === id ? null : id));
                    }}
                    onToggleBranchTip={(id) =>
                      setOpenTipId((current) => (current === id ? null : id))
                    }
                    onSend={sendRecommendation}
                  />
                );
              }
              if (item.type === 'discussion') {
                const onPress = () => {
                  if (item.expanded) {
                    setChosenDiscussionId('');
                    setExpandedSegmentIds([]);
                    setFocusedSegmentKey(null);
                    setStrategyRepeatAsk(false);
                    return;
                  }
                  setChosenDiscussionId(item.id);
                  setActiveDiscussionId(item.id);
                  setExpandedSegmentIds([]);
                  setFocusedSegmentKey(null);
                };
                return (
                  <View className="mx-4 my-1.5 overflow-hidden rounded-2xl">
                    {item.kind === 'setup' ? (
                      <SetupContextBar
                        gameName={item.versionName}
                        expanded={item.expanded}
                        onPress={onPress}
                        {...(item.playerCount !== undefined
                          ? { playerCount: item.playerCount }
                          : {})}
                        {...(item.depth !== undefined ? { depth: item.depth } : {})}
                      />
                    ) : (
                      <CollapseBar title={item.title} expanded={item.expanded} onPress={onPress} />
                    )}
                  </View>
                );
              }
              if (item.type === 'segment') {
                if (unified) {
                  const topicCard = (
                    id: string,
                    title: string,
                    cardMessages: ChatMessage[],
                    indent: boolean,
                  ) => {
                    const assistants = cardMessages.filter(
                      (message) => message.role === 'assistant',
                    );
                    const sections = splitSetupSections(
                      assistants.map((message) => message.content).join('\n\n'),
                    );
                    if (sections !== null) {
                      return (
                        <SetupSectionList
                          key={id}
                          intro={sections.intro}
                          sections={sections.sections}
                        />
                      );
                    }
                    return (
                      <TopicPreview
                        key={id}
                        title={title}
                        preview={previewSentences(assistants[0]?.content ?? '')}
                        expanded={expandedSegmentIds.includes(id)}
                        indent={indent}
                        onPress={() => toggleSegment(id)}
                      >
                        {assistants.length === 0 && sendMessage.isPending ? (
                          <Text className="mt-2 text-sm text-neutral-400">
                            {Copy.chat.thinking}
                          </Text>
                        ) : (
                          assistants.map((message) => (
                            <Text
                              key={message.id}
                              onLongPress={() => handleDeleteMessage(message)}
                              className="mt-3 text-sm leading-relaxed text-[#F4F6FB]"
                            >
                              {message.content}
                            </Text>
                          ))
                        )}
                      </TopicPreview>
                    );
                  };
                  return (
                    <View>
                      {topicCard(item.id, item.title, item.messages, false)}
                      {item.children.map((child) =>
                        topicCard(child.id, child.title, child.messages, true),
                      )}
                    </View>
                  );
                }
                return (
                  <SolvedSegmentCard
                    title={item.title}
                    messages={item.messages}
                    expanded={expandedSegmentIds.includes(item.id)}
                    onToggle={() => toggleSegment(item.id)}
                    onLongPress={handleDeleteMessage}
                  />
                );
              }
              return <MessageBubble message={item.message} onLongPress={handleDeleteMessage} />;
            }}
            ListHeaderComponent={
              !unified && thread.gameName !== undefined ? (
                <GameContextCard gameName={thread.gameName} game={contextGame} />
              ) : null
            }
            ListFooterComponent={
              <>
                {rulesMode && faqOpen && (
                  <View>
                    {profile.isFetching && (
                      <View className="mx-4 mb-2 flex-row items-center gap-2">
                        <ActivityIndicator color="#818CF8" size="small" />
                        <Text className="text-sm text-neutral-400">
                          {Copy.intent.rulesHelper.faqLoading}
                        </Text>
                      </View>
                    )}
                    {profile.isError && (
                      <Text className="mx-4 mb-2 text-sm text-red-400">
                        {Copy.intent.rulesHelper.faqError}
                      </Text>
                    )}
                    {profile.data !== undefined &&
                      profile.data.rulesFaq.length === 0 &&
                      !profile.isFetching && (
                        <Text className="mx-4 mb-2 text-sm text-neutral-400">
                          {Copy.intent.rulesHelper.faqEmpty}
                        </Text>
                      )}
                    {profile.data?.rulesFaq.map((item) => (
                      <TopicPreview
                        key={item.question}
                        title={item.question}
                        preview={previewSentences(item.answer)}
                        expanded={expandedFaq === item.question}
                        onPress={() =>
                          setExpandedFaq((current) =>
                            current === item.question ? null : item.question,
                          )
                        }
                      >
                        <Text className="mt-2 text-sm leading-relaxed text-[#F4F6FB]">
                          {item.answer}
                        </Text>
                      </TopicPreview>
                    ))}
                  </View>
                )}
                {(setupMode || rulesMode) && (
                  <GameReplyBar
                    layer={replyLayer}
                    strategyTitles={strategyNameList}
                    disabled={isSending}
                    faqOpen={faqOpen}
                    repeatAsk={
                      strategyRepeatAsk && focusedTitle === Copy.chat.reply.popularStrategies
                    }
                    onPopularStrategies={() => {
                      void openStrategies();
                    }}
                    onMoreStrategyDetail={() => setStrategyRepeatAsk(false)}
                    onDifferentStrategies={() => {
                      const version = setupTarget?.versionName ?? thread.gameName;
                      if (version === undefined) return;
                      setStrategyRepeatAsk(false);
                      const prompt = differentStrategiesPrompt(version, strategyNameList);
                      sendInto({
                        kind: 'setup',
                        versionName: version,
                        ...(setupTarget?.playerCount !== undefined
                          ? { playerCount: setupTarget.playerCount }
                          : {}),
                        text: prompt.text,
                        label: prompt.label,
                        title: Copy.chat.reply.differentStrategies,
                        ...(setupTarget !== undefined ? { existing: setupTarget } : {}),
                        ...(popularSegment !== undefined
                          ? { parentSegmentId: popularSegment.id }
                          : {}),
                      });
                    }}
                    onMoveToRules={handleMoveToRules}
                    onSetupDepth={(depth) => {
                      const version = setupTarget?.versionName ?? thread.gameName;
                      if (version === undefined) return;
                      const prompt = setupDepthPrompt(version, depth, setupTarget?.playerCount);
                      const title =
                        depth === 'basic'
                          ? Copy.chat.reply.setupFifteen
                          : Copy.chat.reply.setupFull;
                      sendInto({
                        kind: 'setup',
                        versionName: version,
                        ...(setupTarget?.playerCount !== undefined
                          ? { playerCount: setupTarget.playerCount }
                          : {}),
                        text: prompt.text,
                        label: prompt.label,
                        title,
                        ...(setupTarget !== undefined ? { existing: setupTarget } : {}),
                      });
                    }}
                    onStrategyDetail={(title) => {
                      const version = setupTarget?.versionName ?? thread.gameName;
                      if (version === undefined) return;
                      const prompt = strategyFocusPrompt(version, title);
                      sendInto({
                        kind: 'setup',
                        versionName: version,
                        ...(setupTarget?.playerCount !== undefined
                          ? { playerCount: setupTarget.playerCount }
                          : {}),
                        text: prompt.text,
                        label: prompt.label,
                        title,
                        ...(setupTarget !== undefined ? { existing: setupTarget } : {}),
                        ...(popularSegment !== undefined
                          ? { parentSegmentId: popularSegment.id }
                          : {}),
                      });
                    }}
                    onBackToSetup={handleBackToSetup}
                    onCoreMechanics={() => {
                      const prompt = coreMechanicsPrompt(rulesVersionName, rulesPlayerCount);
                      askRules(prompt.text, prompt.label, Copy.chat.reply.coreMechanics);
                    }}
                    onPayAttention={() => {
                      const prompt = payAttentionPrompt(rulesVersionName, rulesPlayerCount);
                      askRules(prompt.text, prompt.label, Copy.chat.reply.payAttention);
                    }}
                    onFaq={() => {
                      setFaqOpen((open) => !open);
                      setExpandedFaq(null);
                    }}
                  />
                )}
                {replyActions}
                {!unified &&
                  thread.reason === 'recommendation' &&
                  openTipId === null &&
                  browseGames.length > 0 && (
                    <RecommendationActions
                      mode="browse"
                      latestGames={browseGames}
                      messages={messages}
                      games={collectionGames}
                      disabled={isSending}
                      onSend={sendRecommendation}
                    />
                  )}
                {newDiscussionButton}
              </>
            }
            contentContainerStyle={{ paddingVertical: 12 }}
            keyboardShouldPersistTaps="handled"
          />
          {thinkingRow}
          {errorBanner}
          {noticeBanner}
          {composer}
        </View>
      )}

      {canSwitchGame && (
        <GameSwitchSheet
          visible={switchOpen}
          games={collectionGames}
          onClose={() => setSwitchOpen(false)}
          onSwitch={(selection) => {
            void handleSwitchGame(selection);
          }}
          {...(thread.gameName !== undefined ? { currentName: thread.gameName } : {})}
        />
      )}
    </KeyboardAvoidingView>
  );
}
