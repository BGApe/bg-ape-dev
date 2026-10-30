import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
import type { CollectionGame } from '@/features/collection/types';
import type { GameId } from '@/types';

import { BggGameInput } from './intent/BggGameInput';

const C = Copy.chat.reply;

type Selection = {
  gameId?: GameId;
  gameName: string;
};

type Props = {
  visible: boolean;
  games: CollectionGame[];
  currentName?: string;
  onClose: () => void;
  onSwitch: (selection: Selection) => void;
};

export function GameSwitchSheet({
  visible,
  games,
  currentName,
  onClose,
  onSwitch,
}: Props): React.JSX.Element {
  const baseGames = useMemo(() => games.filter((game) => game.kind !== 'expansion'), [games]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [typedName, setTypedName] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSelectedId(undefined);
    setTypedName('');
  }, [visible]);

  const selected = baseGames.find((game) => game.id === selectedId);
  const nextName = selected?.name ?? typedName.trim();
  const canSwitch = nextName.length > 0 && nextName !== currentName;

  function confirm() {
    if (!canSwitch) return;
    if (selected) onSwitch({ gameId: selected.id, gameName: selected.name });
    else onSwitch({ gameName: nextName });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable
          className="max-h-[80%] rounded-t-3xl border-t border-[#2A2A2A] bg-[#141414] px-5 pb-8 pt-4"
          onPress={(event) => event.stopPropagation()}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-[#3A3A3A]" />
          <Text className="mb-1 text-lg font-bold text-[#F9F9F9]">{C.changeGame}</Text>
          <Text className="mb-4 text-sm text-neutral-400">{C.changeGameHint}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {baseGames.map((game) => {
              const active = game.id === selectedId;
              return (
                <TouchableOpacity
                  key={game.id}
                  onPress={() => {
                    setSelectedId(game.id);
                    setTypedName('');
                  }}
                  accessibilityRole="button"
                  className={`mb-2 rounded-2xl border px-4 py-3 ${
                    active ? 'border-[#818CF8] bg-[#818CF8]/15' : 'border-[#2A2A2A] bg-[#1A1A1A]'
                  }`}
                >
                  <Text className={`text-sm ${active ? 'text-[#C7D2FE]' : 'text-[#F9F9F9]'}`}>
                    {game.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <Text className="mb-2 mt-2 text-xs uppercase tracking-wide text-neutral-500">
              {C.otherGameLabel}
            </Text>
            <BggGameInput
              value={typedName}
              onChange={(name) => {
                setTypedName(name);
                setSelectedId(undefined);
              }}
              placeholder={Copy.intent.quickSetup.gameNamePlaceholder}
            />
          </ScrollView>
          <TouchableOpacity
            onPress={confirm}
            disabled={!canSwitch}
            accessibilityRole="button"
            className={`mt-4 rounded-2xl py-3.5 ${canSwitch ? 'bg-[#818CF8]' : 'bg-[#818CF8]/30'}`}
          >
            <Text className="text-center text-sm font-semibold text-white">
              {C.changeGameConfirm}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
