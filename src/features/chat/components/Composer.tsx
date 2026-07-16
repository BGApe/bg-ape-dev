import type React from 'react';
import { TextInput, TouchableOpacity, View, Text } from 'react-native';

import { Copy } from '@/constants/copy';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isSending: boolean;
};

export function Composer({ value, onChangeText, onSend, isSending }: Props): React.JSX.Element {
  const canSend = value.trim().length > 0 && !isSending;

  return (
    <View className="flex-row items-end gap-2 border-t border-[#2A2A2A] bg-[#0F0F0F] px-4 py-3">
      <TextInput
        className="flex-1 rounded-2xl bg-[#1F1F1F] px-4 py-3 text-base text-[#F9F9F9]"
        style={{ minHeight: 88, maxHeight: 160, textAlignVertical: 'top' }}
        placeholder={Copy.chat.inputPlaceholder}
        placeholderTextColor="#525252"
        value={value}
        onChangeText={onChangeText}
        multiline
        numberOfLines={3}
        editable={!isSending}
        returnKeyType="send"
        onSubmitEditing={canSend ? onSend : undefined}
        blurOnSubmit={false}
      />
      <TouchableOpacity
        onPress={onSend}
        disabled={!canSend}
        className={`rounded-full px-4 py-3 ${canSend ? 'bg-indigo-600' : 'bg-[#2A2A2A]'}`}
        accessibilityLabel={Copy.chat.sendButton}
        accessibilityRole="button"
      >
        <Text className={`text-sm font-semibold ${canSend ? 'text-white' : 'text-[#525252]'}`}>
          {isSending ? Copy.chat.sending : Copy.chat.sendButton}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
