import type React from 'react';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type { SetupSection } from '../lib/setupSections';

type Props = {
  intro: string;
  sections: SetupSection[];
};

/** Full-walkthrough sections. Each one opens on its own. */
export function SetupSectionList({ intro, sections }: Props): React.JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <View className="mx-4 mb-2">
      {intro.length > 0 && (
        <Text className="mb-2 text-sm leading-relaxed text-[#F4F6FB]">{intro}</Text>
      )}
      {sections.map((section) => {
        const expanded = openId === section.id;
        return (
          <View
            key={section.id}
            className="mb-2 border border-white/20 px-3 py-2.5"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
          >
            <TouchableOpacity
              onPress={() => setOpenId((current) => (current === section.id ? null : section.id))}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
            >
              <View className="flex-row items-center">
                <Text className="flex-1 pr-3 text-base font-semibold text-[#F4F6FB]">
                  {section.title}
                </Text>
                <Text className="text-lg text-[#D6DEEE]">{expanded ? '▴' : '▾'}</Text>
              </View>
            </TouchableOpacity>
            {expanded && <Markup text={section.body} />}
          </View>
        );
      })}
    </View>
  );
}

function Markup({ text }: { text: string }): React.JSX.Element {
  const lines = text.split('\n');
  return (
    <View className="mt-2">
      {lines.map((line, index) => {
        const bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
        if (bullet?.[1] !== undefined) {
          return (
            <View key={index} className="mt-1 flex-row">
              <Text className="text-sm leading-relaxed text-[#F4F6FB]">•</Text>
              <Text className="ml-2 flex-1 text-sm leading-relaxed text-[#F4F6FB]">
                {inline(bullet[1])}
              </Text>
            </View>
          );
        }
        if (line.trim().length === 0) return <View key={index} className="h-2" />;
        return (
          <Text key={index} className="mt-1 text-sm leading-relaxed text-[#F4F6FB]">
            {inline(line)}
          </Text>
        );
      })}
    </View>
  );
}

function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <Text key={index} className="font-semibold">
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}
