type DictionaryEntry = {
  id: string;
  vocabularyStatus: string;
  parentTermId?: string;
};

type Dictionary = { entries: DictionaryEntry[] };

export function findDictionaryErrors(dictionary: Dictionary): string[] {
  const ids = new Set<string>();
  const errors: string[] = [];
  for (const entry of dictionary.entries) {
    if (ids.has(entry.id)) errors.push(`Duplicate dictionary entry ID: ${entry.id}`);
    ids.add(entry.id);
  }
  for (const entry of dictionary.entries) {
    if (entry.parentTermId === entry.id) errors.push(`Entry cannot parent itself: ${entry.id}`);
    if (entry.parentTermId && !ids.has(entry.parentTermId)) {
      errors.push(`Unknown parent term ${entry.parentTermId} in ${entry.id}`);
    }
  }
  return errors;
}
