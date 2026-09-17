type DictionaryEntry = {
  id: string;
  vocabularyStatus: string;
  parentTermId?: string;
  displayTerm?: string;
  definitionSummary?: string;
  provenance?: Array<{
    sourceName?: string;
    sourceType?: string;
    url?: string;
    accessedOn?: string;
    transformationNote?: string;
  }>;
};

type Dictionary = { entries: DictionaryEntry[] };

export function findDictionaryErrors(dictionary: Dictionary): string[] {
  const ids = new Set<string>();
  const errors: string[] = [];
  const vocabularyStatuses = new Set(["selectable", "reference-only", "legacy"]);
  for (const entry of dictionary.entries) {
    if (ids.has(entry.id)) errors.push(`Duplicate dictionary entry ID: ${entry.id}`);
    ids.add(entry.id);
    if (!vocabularyStatuses.has(entry.vocabularyStatus)) {
      errors.push(`Invalid vocabulary status in dictionary entry ${entry.id}`);
    }
    if (!entry.displayTerm || !entry.definitionSummary) {
      errors.push(`Missing definition fields in dictionary entry ${entry.id}`);
    }
    if (!entry.provenance?.length) {
      errors.push(`Missing provenance in dictionary entry ${entry.id}`);
    } else {
      for (const source of entry.provenance) {
        if (
          !source.sourceName ||
          !source.sourceType ||
          !source.url ||
          !source.accessedOn ||
          !source.transformationNote
        ) {
          errors.push(`Incomplete provenance in dictionary entry ${entry.id}`);
        }
      }
    }
  }
  for (const entry of dictionary.entries) {
    if (entry.parentTermId === entry.id) errors.push(`Entry cannot parent itself: ${entry.id}`);
    if (entry.parentTermId && !ids.has(entry.parentTermId)) {
      errors.push(`Unknown parent term ${entry.parentTermId} in ${entry.id}`);
    }
  }
  return errors;
}
