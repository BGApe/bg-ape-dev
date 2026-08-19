import type React from 'react';
import { useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useBggSearch } from '@/features/collection/hooks/useBggSearch';

type Props = {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
};

/**
 * Text input with a live BGG search dropdown.
 * Debounces the query by 400 ms to avoid hammering the API.
 */
export function BggGameInput({ value, onChange, placeholder }: Props): React.JSX.Element {
  const [inputText, setInputText] = useState(value);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: results = [], isFetching } = useBggSearch(debouncedQuery);

  function handleChangeText(v: string) {
    setInputText(v);
    onChange(v);
    setShowResults(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(v), 400);
  }

  function handleSelect(name: string) {
    setInputText(name);
    onChange(name);
    setShowResults(false);
    setDebouncedQuery('');
  }

  const visibleResults = showResults && inputText.trim().length >= 2 ? results.slice(0, 6) : [];

  return (
    <View>
      <View className="flex-row items-center rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3">
        <TextInput
          style={{ flex: 1 }}
          className="text-sm text-[#F9F9F9]"
          placeholder={placeholder ?? 'Search BoardGameGeek…'}
          placeholderTextColor="#525252"
          value={inputText}
          onChangeText={handleChangeText}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
          onFocus={() => inputText.trim().length >= 2 && setShowResults(true)}
          returnKeyType="search"
        />
        {isFetching && inputText.length >= 2 && (
          <ActivityIndicator size="small" color="#818CF8" style={{ marginLeft: 8 }} />
        )}
      </View>

      {visibleResults.length > 0 && (
        <View className="mt-1 overflow-hidden rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A]">
          {visibleResults.map((r, i) => (
            <TouchableOpacity
              key={r.bggId}
              onPress={() => handleSelect(r.name)}
              accessibilityRole="button"
              className={`flex-row items-center px-4 py-3 ${
                i < visibleResults.length - 1 ? 'border-b border-[#2A2A2A]' : ''
              }`}
            >
              <Text className="flex-1 text-sm text-[#F9F9F9]" numberOfLines={1}>
                {r.name}
              </Text>
              {r.yearPublished !== undefined && (
                <Text className="ml-2 text-xs text-neutral-500">{r.yearPublished}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
