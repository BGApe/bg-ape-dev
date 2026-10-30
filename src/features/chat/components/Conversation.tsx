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
import { useCollection } from '@/features/collection/hooks/useCollection';
import { mapError } from '@/lib/mapError';
import { recordGameplayQuestion, type RulesFaqItem } from '@/services/bgg/gameProfile';
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
import { discussionHeading, newDiscussionId } from '../lib/gameThread';
import {
  collapseRepeated,
  groupDiscussions,
  groupSolvedSegments,
  groupTopicRuns,
  newSegmentId,
  type DiscussionGroup,
} from '../lib/messageGroups';
import { retargetGamePrompt } from '../lib/replyPrompts';
import { REASON_EMOJI } from '../reasons';
import type { ChatMessage, ChatThread, ChatThreadPatch, DiscussionKind } from '../types';

import { Composer } from './Composer';
import { GameContextCard } from './GameContextCard';
import { GameSwitchSheet } from './GameSwitchSheet';
import { MessageBubble } from './MessageBubble';
import { ReplyActions, type ReplyFollowup, type ReplyMenu } from './ReplyActions';
import { SolvedSegmentCard } from './SolvedSegmentCard';

type Props = {
  thread: ChatThread;
  onBack: () => void;
};

type ChatRow =
  | { key: string; type: 'discussion'; id: string; title: string; expanded: boolean }
  | { key: string; type: 'segment'; id: string; title: string; messages: ChatMessage[] }
  | { key: string; type: 'message'; message: ChatMessage }
  | { key: string; type: 'actions'; discussionId: string };

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
  const [chosenDiscussionId, setChosenDiscussionId] = useState<string | null>(null);
  const [seenThreadId, setSeenThreadId] = useState(thread.id);
  if (seenThreadId !== thread.id) {
    setSeenThreadId(thread.id);
    setMenu(thread.reason === 'rules' ? 'topics' : 'root');
    setDismissedSegmentId(null);
    setExpandedSegmentIds([]);
    setNotice(null);
    setSwitchOpen(false);
    setChosenDiscussionId(null);
  }

  /** Auto-send any message queued by the intent screen, once per prompt. */
  useEffect(() => {
    if (pendingTurn) {
      if (!useChatUiStore.getState().tryConsumePendingTurn(pendingTurn)) return;
      setChosenDiscussionId(pendingTurn.discussionId);
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
      ? groupTopicRuns(messages, topicKind, thread.solvedSegmentIds ?? [])
      : groupSolvedSegments(messages, thread.solvedSegmentIds ?? []);
  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const suggestionMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && (message.suggestedGames?.length ?? 0) > 0);
  const solvedIds = thread.solvedSegmentIds ?? [];
  const followup: ReplyFollowup | null =
    latestAssistant?.segmentId !== undefined &&
    latestAssistant.segmentTitle !== undefined &&
    !solvedIds.includes(latestAssistant.segmentId) &&
    dismissedSegmentId !== latestAssistant.segmentId
      ? { segmentId: latestAssistant.segmentId, segmentTitle: latestAssistant.segmentTitle }
      : null;

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setDraft('');
    if (unified) {
      const target = openDiscussion ?? visibleDiscussions[visibleDiscussions.length - 1];
      if (target !== undefined) {
        setChosenDiscussionId(target.id);
        sendMessage.mutate({
          text: trimmed,
          segmentId: newSegmentId(),
          segmentTitle: trimmed.slice(0, 48),
          ...discussionFields(target),
        });
        return;
      }
      if (discussionFilter !== null) {
        const versionName = thread.gameName ?? thread.title;
        const discussionId = newDiscussionId();
        setChosenDiscussionId(discussionId);
        sendMessage.mutate({
          text: trimmed,
          discussionId,
          discussionTitle: discussionHeading(versionName, discussionFilter),
          discussionKind: discussionFilter,
          versionName,
          turnReason: discussionFilter,
        });
        return;
      }
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

  function openDiscussionForm(kind: DiscussionKind, prefillParent: boolean) {
    const version = openDiscussion?.versionName ?? thread.gameName;
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
    if (unified) {
      openDiscussionForm('rules', false);
      return;
    }
    setMenu('topics');
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
    setExpandedSegmentIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
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
      gameRows.push({
        key: `discussion-${discussion.id}`,
        type: 'discussion',
        id: discussion.id,
        title: discussion.title,
        expanded,
      });
      if (!expanded) continue;
      const pieces = groupTopicRuns(discussion.messages, discussion.kind, solvedIds);
      for (const piece of pieces) {
        if (piece.kind === 'segment') {
          gameRows.push({
            key: `segment-${discussion.id}-${piece.id}`,
            type: 'segment',
            id: `${discussion.id}-${piece.id}`,
            title: piece.title,
            messages: piece.messages,
          });
        } else {
          gameRows.push({ key: piece.message.id, type: 'message', message: piece.message });
        }
      }
      gameRows.push({
        key: `actions-${discussion.id}`,
        type: 'actions',
        discussionId: discussion.id,
      });
    }
  }

  function replyFor(discussion: DiscussionGroup): React.JSX.Element | null {
    const latest = [...discussion.messages]
      .reverse()
      .find((message) => message.role === 'assistant');
    if (latest === undefined || sendMessage.isPending) return null;
    const topicFollowup: ReplyFollowup | null =
      latest.segmentId !== undefined &&
      latest.segmentTitle !== undefined &&
      !solvedIds.includes(latest.segmentId) &&
      dismissedSegmentId !== latest.segmentId
        ? { segmentId: latest.segmentId, segmentTitle: latest.segmentTitle }
        : null;
    return (
      <ReplyActions
        thread={{ ...thread, reason: discussion.kind }}
        message={latest}
        resetKey={latest.id}
        messages={discussion.messages}
        games={collectionGames}
        disabled={isSending}
        menu={menu}
        followup={topicFollowup}
        onSend={(text, label, segment) =>
          sendMessage.mutate({
            text,
            label,
            ...discussionFields(discussion),
            ...(segment !== undefined
              ? { segmentId: segment.id, segmentTitle: segment.title }
              : {}),
          })
        }
        onMenu={setMenu}
        onMoveToRules={handleMoveToRules}
        onDismissFollowup={() => {
          if (topicFollowup !== null) setDismissedSegmentId(topicFollowup.segmentId);
          setMenu('topics');
        }}
        onMarkSolved={(segment) => {
          void handleMarkSolved(segment);
        }}
        onInsertFaq={handleInsertFaq}
      />
    );
  }

  const newDiscussionButton = unified ? (
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
        message={
          thread.reason === 'recommendation' && suggestionMessage !== undefined
            ? suggestionMessage
            : latestAssistant
        }
        resetKey={latestAssistant.id}
        messages={messages}
        games={collectionGames}
        disabled={isSending}
        menu={menu}
        followup={followup}
        onSend={(text, label, segment) =>
          sendMessage.mutate({
            text,
            label,
            ...(segment !== undefined
              ? { segmentId: segment.id, segmentTitle: segment.title }
              : {}),
          })
        }
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
      <View className="flex-row items-center gap-2 border-b border-[#2A2A2A] px-3 pb-2 pt-1">
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
            {REASON_EMOJI[thread.gameKey !== undefined ? 'general' : thread.reason]} {thread.title}
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
                : blocks.map(
                    (block): ChatRow =>
                      block.kind === 'segment'
                        ? {
                            key: `segment-${block.id}`,
                            type: 'segment',
                            id: block.id,
                            title: block.title,
                            messages: block.messages,
                          }
                        : { key: block.message.id, type: 'message', message: block.message },
                  )
            }
            keyExtractor={(item) => item.key}
            extraData={`${expandedSegmentIds.join('|')}:${menu}:${followup?.segmentId ?? ''}:${sendMessage.isPending}:${openDiscussionId ?? ''}`}
            renderItem={({ item }) => {
              if (item.type === 'discussion') {
                return (
                  <TouchableOpacity
                    onPress={() => setChosenDiscussionId(item.expanded ? '' : item.id)}
                    accessibilityRole="button"
                    className="mx-4 my-1 rounded-2xl border border-[#2A2A2A] bg-[#141414] px-4 py-3"
                  >
                    <Text className="text-sm font-semibold text-[#F9F9F9]">{item.title}</Text>
                    <Text className="mt-1 text-xs text-[#C7D2FE]">
                      {item.expanded
                        ? Copy.chat.reply.solvedCollapse
                        : Copy.chat.reply.solvedExpand}
                    </Text>
                  </TouchableOpacity>
                );
              }
              if (item.type === 'segment') {
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
              if (item.type === 'actions') {
                const discussion = visibleDiscussions.find(
                  (entry) => entry.id === item.discussionId,
                );
                return discussion !== undefined ? replyFor(discussion) : null;
              }
              return <MessageBubble message={item.message} onLongPress={handleDeleteMessage} />;
            }}
            ListHeaderComponent={
              thread.gameName !== undefined ? (
                <GameContextCard gameName={thread.gameName} game={contextGame} />
              ) : null
            }
            ListFooterComponent={
              <>
                {replyActions}
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
