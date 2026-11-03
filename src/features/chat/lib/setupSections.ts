export type SetupSection = {
  id: string;
  title: string;
  body: string;
};

export type SetupSectionSplit = {
  intro: string;
  sections: SetupSection[];
};

/** Pulls ## headings out of a full rules walkthrough. Fewer than two headings stays prose. */
export function splitSetupSections(content: string): SetupSectionSplit | null {
  const matches = [...content.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length < 2) return null;
  const first = matches[0];
  if (first?.index === undefined) return null;

  const intro = content.slice(0, first.index).replace(/^•\s*/gm, '').trim();
  const sections = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    const title = (match[1] ?? 'Section').trim();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return {
      id: `${index}-${slug.length > 0 ? slug : 'section'}`,
      title,
      body: content.slice(start, end).trim(),
    };
  });
  return { intro, sections };
}
