import type React from 'react';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
import { useCollection } from '@/features/collection/hooks/useCollection';
import type { GameId } from '@/types';

import { REASON_EMOJI, REASON_ORDER } from '../reasons';
import type { ChatReason, NewChatThread } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: NewChatThread) => void;
};

function buildTitle(reason: ChatReason, gameName?: string): string {
  const label = Copy.chat.reasons[reason];
  return gameName !== undefined ? `${label} · ${gameName}` : label;
}

export function NewConversationSheet({ visible, onClose, onCreate }: Props): React.JSX.Element {
  const [reason, setReason] = useState<ChatReason>('recommendation');
  const [gameId, setGameId] = useState<GameId | null>(null);
  const { data: games = [] } = useCollection();

  const selectedGame = games.find((g) => g.id === gameId) ?? null;

  function handleCreate() {
    const input: NewChatThread = {
      title: buildTitle(reason, selectedGame?.name),
      reason,
    };
    if (selectedGame !== null) {
      input.gameId = selectedGame.id;
      input.gameName = selectedGame.name;
    }
    onCreate(input);
    setReason('recommendation');
    setGameId(null);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl border-t border-[#2A2A2A] bg-[#141414] px-5 pb-8 pt-4"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-[#3A3A3A]" />
          <Text className="mb-4 text-lg font-bold text-[#F9F9F9]">
            {Copy.chat.conversations.newTitle}
          </Text>

          <Text className="mb-2 text-sm text-neutral-400">
            {Copy.chat.conversations.reasonLabel}
          </Text>
          <View className="mb-5 gap-2">
            {REASON_ORDER.map((r) => {
              const active = r === reason;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setReason(r)}
                  accessibilityRole="button"
                  className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3 ${
                    active ? 'border-[#6D5DF6] bg-[#6D5DF6]/15' : 'border-[#2A2A2A] bg-[#1A1A1A]'
                  }`}
                >
                  <Text className="text-lg">{REASON_EMOJI[r]}</Text>
                  <Text className="text-base text-[#F9F9F9]">{Copy.chat.reasons[r]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {games.length > 0 && (
            <>
              <Text className="mb-2 text-sm text-neutral-400">
                {Copy.chat.conversations.gameLabel}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setGameId(null)}
                    accessibilityRole="button"
                    className={`rounded-full border px-4 py-2 ${
                      gameId === null
                        ? 'border-[#6D5DF6] bg-[#6D5DF6]/15'
                        : 'border-[#2A2A2A] bg-[#1A1A1A]'
                    }`}
                  >
                    <Text className="text-sm text-[#F9F9F9]">{Copy.chat.conversations.noGame}</Text>
                  </TouchableOpacity>
                  {games.map((game) => {
                    const active = game.id === gameId;
                    return (
                      <TouchableOpacity
                        key={game.id}
                        onPress={() => setGameId(game.id)}
                        accessibilityRole="button"
                        className={`rounded-full border px-4 py-2 ${
                          active
                            ? 'border-[#6D5DF6] bg-[#6D5DF6]/15'
                            : 'border-[#2A2A2A] bg-[#1A1A1A]'
                        }`}
                      >
                        <Text className="text-sm text-[#F9F9F9]">{game.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </>
          )}

          <TouchableOpacity
            onPress={handleCreate}
            accessibilityRole="button"
            className="items-center rounded-2xl bg-[#6D5DF6] py-4"
          >
            <Text className="text-base font-semibold text-white">
              {Copy.chat.conversations.create}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
