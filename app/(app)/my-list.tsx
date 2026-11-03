import { useRouter } from 'expo-router';
import type React from 'react';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Copy } from '@/constants/copy';
import { useAddMyListItem } from '@/features/myList/hooks/useAddMyListItem';
import { useMyList } from '@/features/myList/hooks/useMyList';
import { useRemoveMyListItem } from '@/features/myList/hooks/useRemoveMyListItem';
import { useUpdateMyListItem } from '@/features/myList/hooks/useUpdateMyListItem';
import type { MyListItem } from '@/features/myList/types';

const C = Copy.myList;

export default function MyListScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: items = [] } = useMyList();
  const addItem = useAddMyListItem();
  const updateItem = useUpdateMyListItem();
  const removeItem = useRemoveMyListItem();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');

  function add() {
    const trimmed = name.trim();
    if (trimmed.length === 0 || addItem.isPending) return;
    const already = items.some((item) => item.name.trim().toLowerCase() === trimmed.toLowerCase());
    addItem.mutate(
      { name: trimmed, ...(note.trim().length > 0 ? { note: note.trim() } : {}) },
      {
        onSuccess: () => {
          setName('');
          setNote('');
        },
      },
    );
    if (already) {
      setName('');
      setNote('');
    }
  }

  function openNote(item: MyListItem) {
    setEditingId(item.id);
    setDraftNote(item.note ?? '');
  }

  function saveNote(item: MyListItem) {
    updateItem.mutate({ itemId: item.id, patch: { note: draftNote } });
    setEditingId(null);
  }

  function confirmRemove(item: MyListItem) {
    Alert.alert(C.removeTitle, C.removeBody, [
      { text: Copy.chat.cancel, style: 'cancel' },
      {
        text: C.remove,
        style: 'destructive',
        onPress: () => removeItem.mutate(item.id),
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center gap-2 px-3 pb-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="px-2 py-1"
          accessibilityRole="button"
        >
          <Text className="text-lg text-neutral-300">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-[#F9F9F9]">{C.title}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          className="mb-2 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-sm text-[#F9F9F9]"
          placeholder={C.addPlaceholder}
          placeholderTextColor="#525252"
          value={name}
          onChangeText={setName}
          returnKeyType="next"
        />
        <TextInput
          className="mb-3 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-sm text-[#F9F9F9]"
          placeholder={C.notePlaceholder}
          placeholderTextColor="#525252"
          value={note}
          onChangeText={setNote}
          returnKeyType="done"
        />
        <TouchableOpacity
          onPress={add}
          disabled={name.trim().length === 0 || addItem.isPending}
          accessibilityRole="button"
          className="mb-6 items-center rounded-2xl border border-[#6D5DF6]/50 bg-[#6D5DF6]/15 py-3"
        >
          <Text className="text-sm font-semibold text-[#F9F9F9]">{C.addButton}</Text>
        </TouchableOpacity>

        {items.length === 0 ? (
          <View className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-5">
            <Text className="text-sm text-neutral-400">{C.empty}</Text>
          </View>
        ) : (
          <View className="gap-2">
            {items.map((item) => (
              <View
                key={item.id}
                className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3"
              >
                <View className="flex-row items-center gap-3">
                  <Text className="flex-1 text-base text-[#F9F9F9]" numberOfLines={2}>
                    {item.name}
                  </Text>
                  <TouchableOpacity onPress={() => confirmRemove(item)} accessibilityRole="button">
                    <Text className="text-xs text-neutral-500">{C.remove}</Text>
                  </TouchableOpacity>
                </View>
                {editingId === item.id ? (
                  <View className="mt-2">
                    <TextInput
                      className="rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] px-3 py-2 text-sm text-[#F9F9F9]"
                      placeholder={C.notePlaceholder}
                      placeholderTextColor="#525252"
                      value={draftNote}
                      onChangeText={setDraftNote}
                      multiline
                    />
                    <TouchableOpacity
                      onPress={() => saveNote(item)}
                      accessibilityRole="button"
                      className="mt-2 self-start"
                    >
                      <Text className="text-sm text-[#818CF8]">{C.saveNote}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => openNote(item)}
                    accessibilityRole="button"
                    className="mt-1"
                  >
                    <Text className="text-sm text-neutral-400">
                      {item.note !== undefined && item.note.length > 0 ? item.note : C.noteLabel}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
