import { useRouter } from 'expo-router';
import type React from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
import { Routes } from '@/constants/routes';
import { useBggGameProfile } from '@/features/collection/hooks/useBggGameProfile';
import type { CollectionGame } from '@/features/collection/types';
import type { RulesFaqItem, WinningStrategy } from '@/services/bgg/gameProfile';

import { newSegmentId } from '../lib/messageGroups';
import {
  comparePrompt,
  detailedSetupPrompt,
  elaboratePrompt,
  moreGamesPrompt,
  moreInfoPrompt,
  playerCountFromMessages,
  popularStrategiesPrompt,
  quickOverviewPrompt,
  strategyDetailPrompt,
  topicFollowupPrompt,
} from '../lib/replyPrompts';
import { previouslySuggestedGames } from '../lib/suggestedGames';
import type { ChatMessage, ChatThread } from '../types';

const C = Copy.chat.reply;
const Faq = Copy.intent.rulesHelper;

export type ReplyMenu = 'root' | 'topics';

export type ReplyFollowup = {
  segmentId: string;
  segmentTitle: string;
};

type SegmentRef = {
  id: string;
  title: string;
};

type Props = {
  thread: ChatThread;
  message: ChatMessage;
  resetKey: string;
  messages: ChatMessage[];
  games: CollectionGame[];
  disabled: boolean;
  menu: ReplyMenu;
  followup: ReplyFollowup | null;
  onSend: (text: string, label: string, segment?: SegmentRef) => void;
  onMenu: (menu: ReplyMenu) => void;
  onMoveToRules: () => void;
  onDismissFollowup: () => void;
  onMarkSolved: (segment: ReplyFollowup) => void;
  onInsertFaq: (item: RulesFaqItem) => void;
  onInsertStrategies: (items: WinningStrategy[]) => void;
};

function ActionButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className="mr-2 mb-2 rounded-full border border-[#818CF8] bg-[#818CF8]/15 px-3 py-1.5"
    >
      <Text className="text-sm text-[#C7D2FE]">{label}</Text>
    </TouchableOpacity>
  );
}

function findOwnedGame(games: CollectionGame[], name: string): CollectionGame | undefined {
  const key = name.trim().toLowerCase();
  return games.find((game) => game.kind !== 'expansion' && game.name.toLowerCase() === key);
}

function findNamedGame(games: CollectionGame[], name: string): CollectionGame | undefined {
  const key = name.trim().toLowerCase();
  return games.find((game) => game.name.toLowerCase() === key);
}

export function ReplyActions({
  thread,
  message,
  resetKey,
  messages,
  games,
  disabled,
  menu,
  followup,
  onSend,
  onMenu,
  onMoveToRules,
  onDismissFollowup,
  onMarkSolved,
  onInsertFaq,
  onInsertStrategies,
}: Props): React.JSX.Element | null {
  const router = useRouter();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState(false);
  const gameName = thread.gameName;
  const owned = gameName !== undefined ? findOwnedGame(games, gameName) : undefined;
  const named = gameName !== undefined ? findNamedGame(games, gameName) : undefined;
  const profileGame = named ?? owned;
  const profile = useBggGameProfile(
    gameName !== undefined &&
      gameName.length > 2 &&
      (thread.reason === 'setup' || thread.reason === 'rules' || faqOpen)
      ? profileGame?.bggId !== undefined
        ? { bggId: profileGame.bggId }
        : { name: gameName }
      : null,
  );

  useEffect(() => {
    setSelectedGame(null);
    setFaqOpen(false);
  }, [resetKey]);

  if (thread.reason === 'recommendation') {
    const gamesNamed = message.suggestedGames ?? [];
    if (gamesNamed.length === 0) return null;
    const more = moreGamesPrompt(previouslySuggestedGames(messages));
    const selected = selectedGame;
    return (
      <View className="mx-4 mb-2 max-w-[90%]">
        {selected === null ? (
          <View className="flex-row flex-wrap">
            {gamesNamed.map((game) => (
              <ActionButton
                key={game}
                label={game}
                disabled={disabled}
                onPress={() => setSelectedGame(game)}
              />
            ))}
            <ActionButton
              label={C.moreGames}
              disabled={disabled}
              onPress={() => onSend(more.text, more.label)}
            />
          </View>
        ) : (
          <View className="flex-row flex-wrap">
            <ActionButton
              label={selected}
              disabled={disabled}
              onPress={() => setSelectedGame(null)}
            />
            <ActionButton
              label={C.overview}
              disabled={disabled}
              onPress={() => {
                const prompt = quickOverviewPrompt(selected);
                onSend(prompt.text, prompt.label);
              }}
            />
            <ActionButton
              label={C.setup}
              disabled={disabled}
              onPress={() => {
                const playerCount = playerCountFromMessages(messages);
                const params: Record<string, string> = {
                  reason: 'setup',
                  gameName: selected,
                };
                const ownedGame = findOwnedGame(games, selected);
                if (ownedGame) params.gameId = ownedGame.id;
                if (playerCount !== undefined) params.playerCount = playerCount;
                router.push({ pathname: Routes.intent, params });
              }}
            />
            <ActionButton
              label={C.moreInfo}
              disabled={disabled}
              onPress={() => {
                const prompt = moreInfoPrompt(selected);
                onSend(prompt.text, prompt.label);
              }}
            />
            <ActionButton
              label={C.compare(gamesNamed.length)}
              disabled={disabled}
              onPress={() => {
                const prompt = comparePrompt(selected, gamesNamed.length);
                onSend(prompt.text, prompt.label);
              }}
            />
          </View>
        )}
      </View>
    );
  }

  if (thread.reason !== 'setup' && thread.reason !== 'rules') return null;

  function sendTopic(topic: string) {
    if (gameName === undefined) return;
    const prompt = topicFollowupPrompt(gameName, topic);
    onSend(prompt.text, prompt.label, { id: newSegmentId(), title: topic });
  }

  const showSetup = thread.reason === 'setup' && followup === null;
  const showTopics = followup === null && (menu === 'topics' || thread.reason === 'rules');
  const strategyFollowup = followup?.segmentTitle === C.popularStrategies;

  function sendDetailedSetup() {
    if (gameName === undefined) return;
    const prompt = detailedSetupPrompt(gameName);
    onSend(prompt.text, prompt.label, { id: newSegmentId(), title: C.detailedSetupTitle });
  }

  async function openStrategies() {
    if (gameName === undefined) return;
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
      onInsertStrategies(stored);
      return;
    }
    const prompt = popularStrategiesPrompt(gameName);
    onSend(prompt.text, prompt.label, { id: newSegmentId(), title: C.popularStrategies });
  }

  return (
    <View className="mx-4 mb-2 max-w-[90%]">
      {strategyFollowup && followup !== null && gameName !== undefined && (
        <View className="flex-row flex-wrap">
          <ActionButton
            label={C.trackPlay}
            disabled={disabled}
            onPress={() => Alert.alert(C.trackPlay, C.trackPlayBody)}
          />
          <ActionButton
            label={C.strategyDetail}
            disabled={disabled}
            onPress={() => {
              const prompt = strategyDetailPrompt(gameName);
              onSend(prompt.text, prompt.label, {
                id: followup.segmentId,
                title: followup.segmentTitle,
              });
            }}
          />
          <ActionButton label={C.toRules} disabled={disabled} onPress={onMoveToRules} />
        </View>
      )}

      {followup !== null && !strategyFollowup && gameName !== undefined && (
        <View className="flex-row flex-wrap">
          <ActionButton
            label={C.somethingElse}
            disabled={disabled}
            onPress={() => {
              onDismissFollowup();
              onMenu('topics');
            }}
          />
          <ActionButton
            label={C.elaborate}
            disabled={disabled}
            onPress={() => {
              const prompt = elaboratePrompt(gameName, followup.segmentTitle);
              onSend(prompt.text, prompt.label, {
                id: followup.segmentId,
                title: followup.segmentTitle,
              });
            }}
          />
          <ActionButton
            label={C.markSolved}
            disabled={disabled}
            onPress={() => onMarkSolved(followup)}
          />
        </View>
      )}

      {showSetup && (
        <View className="flex-row flex-wrap">
          <ActionButton
            label={C.moreSetupHelp}
            disabled={disabled || gameName === undefined}
            onPress={sendDetailedSetup}
          />
          <ActionButton
            label={C.popularStrategies}
            disabled={disabled || gameName === undefined}
            onPress={() => {
              void openStrategies();
            }}
          />
          <ActionButton
            label={C.toRules}
            disabled={disabled || gameName === undefined}
            onPress={onMoveToRules}
          />
        </View>
      )}

      {showTopics && gameName !== undefined && (
        <View className="flex-row flex-wrap">
          {C.rulesTopics.map((topic) => (
            <ActionButton
              key={topic}
              label={topic}
              disabled={disabled}
              onPress={() => sendTopic(topic)}
            />
          ))}
          {thread.reason === 'rules' && (
            <ActionButton
              label={C.specificRule}
              disabled={disabled}
              onPress={() => setFaqOpen((open) => !open)}
            />
          )}
        </View>
      )}

      {faqOpen && (
        <View className="mt-1">
          <Text className="mb-2 text-xs text-neutral-500">{Faq.faqHint}</Text>
          {profile.isFetching && (
            <View className="mb-2 flex-row items-center gap-2">
              <ActivityIndicator color="#818CF8" size="small" />
              <Text className="text-sm text-neutral-400">{Faq.faqLoading}</Text>
            </View>
          )}
          {profile.isError && <Text className="mb-2 text-sm text-red-400">{Faq.faqError}</Text>}
          {profile.data !== undefined &&
            profile.data.rulesFaq.length === 0 &&
            !profile.isFetching && (
              <Text className="mb-2 text-sm text-neutral-400">{Faq.faqEmpty}</Text>
            )}
          {profile.data?.rulesFaq.map((item) => (
            <TouchableOpacity
              key={item.question}
              onPress={() => onInsertFaq(item)}
              disabled={disabled}
              accessibilityRole="button"
              className="mb-2 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2"
            >
              <Text className="text-sm text-[#F9F9F9]">{item.question}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
