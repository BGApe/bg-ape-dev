import type React from 'react';
import { useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';

const C = Copy.chat.reply;

export type GameReplyLayer = 'root' | 'guide' | 'strategies' | 'rules';

type Props = {
  layer: GameReplyLayer;
  strategyTitles: readonly string[];
  disabled: boolean;
  faqOpen: boolean;
  /** Saved strategies were opened again, so offer detail or a different set. */
  repeatAsk: boolean;
  onPopularStrategies: () => void;
  onMoreStrategyDetail: () => void;
  onDifferentStrategies: () => void;
  onMoveToRules: () => void;
  onSetupDepth: (depth: 'basic' | 'full') => void;
  onStrategyDetail: (title: string) => void;
  onBackToSetup: () => void;
  onCoreMechanics: () => void;
  onPayAttention: () => void;
  onFaq: () => void;
};

function ActionButton({
  label,
  onPress,
  disabled,
  selected = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  selected?: boolean;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`mr-2 mb-2 rounded-full border px-3 py-1.5 ${
        selected ? 'border-[#C7D2FE] bg-[#818CF8]/30' : 'border-[#818CF8] bg-[#818CF8]/15'
      }`}
    >
      <Text className="text-sm text-[#C7D2FE]">{label}</Text>
    </TouchableOpacity>
  );
}

export function GameReplyBar({
  layer,
  strategyTitles,
  disabled,
  faqOpen,
  repeatAsk,
  onPopularStrategies,
  onMoreStrategyDetail,
  onDifferentStrategies,
  onMoveToRules,
  onSetupDepth,
  onStrategyDetail,
  onBackToSetup,
  onCoreMechanics,
  onPayAttention,
  onFaq,
}: Props): React.JSX.Element {
  const [depthOpen, setDepthOpen] = useState(false);

  useEffect(() => {
    setDepthOpen(false);
  }, [layer]);

  function track() {
    Alert.alert(C.trackPlay, C.trackPlayBody);
  }

  const strategyNames = [0, 1, 2].map((index) => strategyTitles[index] ?? `strategy ${index + 1}`);

  return (
    <View className="mx-4 mb-2 max-w-[92%]">
      {layer === 'root' && (
        <View className="flex-row flex-wrap">
          <ActionButton label={C.trackPlay} disabled={disabled} onPress={track} />
          <ActionButton
            label={C.popularStrategies}
            disabled={disabled}
            onPress={onPopularStrategies}
          />
          <ActionButton label={C.toRules} disabled={disabled} onPress={onMoveToRules} />
        </View>
      )}

      {layer === 'guide' && (
        <View className="flex-row flex-wrap">
          <ActionButton label={C.trackPlay} disabled={disabled} onPress={track} />
          <ActionButton
            label={C.popularStrategies}
            disabled={disabled}
            onPress={onPopularStrategies}
          />
          {depthOpen ? (
            <>
              <ActionButton
                label={C.setupFifteen}
                disabled={disabled}
                onPress={() => onSetupDepth('basic')}
              />
              <ActionButton
                label={C.setupFull}
                disabled={disabled}
                onPress={() => onSetupDepth('full')}
              />
            </>
          ) : (
            <ActionButton
              label={C.moreSetupDetail}
              disabled={disabled}
              onPress={() => setDepthOpen(true)}
            />
          )}
          <ActionButton label={C.toRules} disabled={disabled} onPress={onMoveToRules} />
        </View>
      )}

      {layer === 'strategies' && repeatAsk && (
        <View>
          <Text className="mb-2 text-sm leading-relaxed text-neutral-300">
            {C.strategySavedAsk}
          </Text>
          <View className="flex-row flex-wrap">
            <ActionButton
              label={C.moreStrategyDetail}
              disabled={disabled}
              onPress={onMoreStrategyDetail}
            />
            <ActionButton
              label={C.differentStrategies}
              disabled={disabled}
              onPress={onDifferentStrategies}
            />
            <ActionButton label={C.trackPlay} disabled={disabled} onPress={track} />
            <ActionButton label={C.toRules} disabled={disabled} onPress={onMoveToRules} />
          </View>
        </View>
      )}

      {layer === 'strategies' && !repeatAsk && (
        <View className="flex-row flex-wrap">
          {strategyNames.map((name, index) => (
            <ActionButton
              key={`${index}-${name}`}
              label={C.strategyMore(name)}
              disabled={disabled}
              onPress={() => onStrategyDetail(name)}
            />
          ))}
          <ActionButton label={C.trackPlay} disabled={disabled} onPress={track} />
          <ActionButton label={C.toRules} disabled={disabled} onPress={onMoveToRules} />
        </View>
      )}

      {layer === 'rules' && (
        <View className="flex-row flex-wrap">
          <ActionButton label={C.toSetup} disabled={disabled} onPress={onBackToSetup} />
          <ActionButton label={C.coreMechanics} disabled={disabled} onPress={onCoreMechanics} />
          <ActionButton label={C.payAttention} disabled={disabled} onPress={onPayAttention} />
          <ActionButton label={C.faq} disabled={disabled} selected={faqOpen} onPress={onFaq} />
        </View>
      )}
    </View>
  );
}
