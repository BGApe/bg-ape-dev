import type React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
import type { CollectionGame } from '@/features/collection/types';

import type { RecommendationTip } from '../lib/recommendationRounds';
import type { ChatMessage } from '../types';

import { PickerPromptBar } from './PickerPromptBar';
import { RecommendationActions } from './RecommendationActions';

/** Solid filter bar. The open panel is a faint wash of the same blue. */
const BAR = '#2C3548';
const WASH = 'rgba(44, 53, 72, 0.55)';
/** Follow-up sets sit on a nearby hue so each branch stays its own tree. */
const BRANCH_BAR = '#3C3450';
const BRANCH_WASH = 'rgba(72, 53, 92, 0.5)';
const FRAME = 'rgba(244, 246, 251, 0.32)';
/** About 80% transparent, so the card reads as a light shade on its panel. */
const TIP_SHADE = 'rgba(0, 0, 0, 0.2)';

export type RecommendationBranch = {
  id: string;
  title: string;
  intro: string;
  expanded: boolean;
  tips: RecommendationTip[];
};

type Props = {
  title: string;
  intro: string;
  expanded: boolean;
  tips: RecommendationTip[];
  branches: RecommendationBranch[];
  openTipId: string | null;
  pending: boolean;
  messages: ChatMessage[];
  games: CollectionGame[];
  disabled: boolean;
  latestGames: string[];
  onToggle: () => void;
  onToggleBranch: (id: string, expanded: boolean) => void;
  onToggleTip: (id: string) => void;
  onToggleBranchTip: (id: string) => void;
  onSend: (text: string, label: string, segment?: { id: string; title: string }) => void;
};

export function RecommendationRoundCard({
  title,
  intro,
  expanded,
  tips,
  branches,
  openTipId,
  pending,
  messages,
  games,
  disabled,
  latestGames,
  onToggle,
  onToggleBranch,
  onToggleTip,
  onToggleBranchTip,
  onSend,
}: Props): React.JSX.Element {
  const branchOpen = branches.some((branch) => branch.expanded);
  const waiting = pending && intro.length === 0 && tips.length === 0 && branches.length === 0;

  return (
    <View
      className="mx-4 my-1.5"
      style={expanded ? { backgroundColor: WASH } : { backgroundColor: BAR }}
    >
      <PickerPromptBar title={title} expanded={expanded} onPress={onToggle} />
      {expanded && (
        <View className="px-3 pb-3">
          {intro.length > 0 && (
            <Text className="mt-3 text-sm leading-relaxed text-[#F4F6FB]">{intro}</Text>
          )}
          {waiting && <Text className="mt-3 text-sm text-neutral-400">{Copy.chat.thinking}</Text>}
          {tips.map((tip) => (
            <TipCard
              key={tip.id}
              tip={tip}
              expanded={!branchOpen && openTipId === tip.id}
              compact={branchOpen}
              messages={messages}
              games={games}
              disabled={disabled}
              latestGames={latestGames}
              onPress={() => onToggleTip(tip.id)}
              onSend={onSend}
            />
          ))}
          {branches.map((branch) => (
            <View key={branch.id} className="-mx-3 mt-3" style={{ backgroundColor: BRANCH_WASH }}>
              <TouchableOpacity
                onPress={() => onToggleBranch(branch.id, branch.expanded)}
                accessibilityRole="button"
                accessibilityState={{ expanded: branch.expanded }}
                className="flex-row items-center px-4 py-3"
                style={{ backgroundColor: BRANCH_BAR }}
              >
                <Text className="flex-1 pr-3 text-base font-semibold text-[#F4F6FB]">
                  {branch.title}
                </Text>
                <Text className="text-2xl text-[#D6DEEE]">{branch.expanded ? '▴' : '▾'}</Text>
              </TouchableOpacity>
              {branch.expanded && (
                <View className="px-3 pb-3">
                  {branch.intro.length > 0 && (
                    <Text className="mt-3 text-sm leading-relaxed text-[#F4F6FB]">
                      {branch.intro}
                    </Text>
                  )}
                  {branch.intro.length === 0 && branch.tips.length === 0 && pending && (
                    <Text className="mt-3 text-sm text-neutral-400">{Copy.chat.thinking}</Text>
                  )}
                  {branch.tips.map((tip) => (
                    <TipCard
                      key={tip.id}
                      tip={tip}
                      expanded={openTipId === tip.id}
                      compact={false}
                      messages={messages}
                      games={games}
                      disabled={disabled}
                      latestGames={latestGames}
                      onPress={() => onToggleBranchTip(tip.id)}
                      onSend={onSend}
                    />
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TipCard({
  tip,
  expanded,
  compact,
  messages,
  games,
  disabled,
  latestGames,
  onPress,
  onSend,
}: {
  tip: RecommendationTip;
  expanded: boolean;
  /** Title only, used once a follow-up branch is the open set. */
  compact: boolean;
  messages: ChatMessage[];
  games: CollectionGame[];
  disabled: boolean;
  latestGames: string[];
  onPress: () => void;
  onSend: (text: string, label: string, segment?: { id: string; title: string }) => void;
}): React.JSX.Element {
  return (
    <View
      className="mt-2 px-3 py-2.5"
      style={{ borderWidth: 1, borderColor: FRAME, backgroundColor: TIP_SHADE }}
    >
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View className="flex-row items-start">
          <Text className="flex-1 pr-3 text-base font-semibold text-[#F4F6FB]">{tip.name}</Text>
          {!compact && <Text className="text-lg text-[#D6DEEE]">{expanded ? '▴' : '▾'}</Text>}
        </View>
        {!compact && !expanded && tip.preview.length > 0 && (
          <Text className="mt-1 text-sm leading-relaxed text-neutral-300" numberOfLines={2}>
            {tip.preview}
          </Text>
        )}
      </TouchableOpacity>
      {expanded && (
        <>
          {tip.body.length > 0 && (
            <Text className="mt-3 text-sm leading-relaxed text-[#F4F6FB]">{tip.body}</Text>
          )}
          {tip.followups.map((followup) => (
            <Text key={followup.id} className="mt-3 text-sm leading-relaxed text-[#F4F6FB]">
              {followup.content}
            </Text>
          ))}
          <RecommendationActions
            mode="game"
            game={tip.name}
            latestGames={latestGames}
            messages={messages}
            games={games}
            disabled={disabled}
            onSend={onSend}
          />
        </>
      )}
    </View>
  );
}
