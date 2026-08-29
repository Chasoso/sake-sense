type Dimension = {
  id: string;
  polarities: string[];
};

type DictionaryEntry = {
  id: string;
  dimensions: Array<{ dimensionId: string; polarity: string }>;
};

type Dictionary = {
  dimensions: Dimension[];
  entries: DictionaryEntry[];
};

export function findDimensionMappingErrors(dictionary: Dictionary): string[] {
  const dimensionsById = new Map(
    dictionary.dimensions.map((dimension) => [dimension.id, dimension]),
  );
  const entryIds = new Set<string>();
  const errors: string[] = [];

  for (const entry of dictionary.entries) {
    if (entryIds.has(entry.id)) {
      errors.push(`Duplicate dictionary entry ID: ${entry.id}`);
    }
    entryIds.add(entry.id);

    for (const mapping of entry.dimensions) {
      const dimension = dimensionsById.get(mapping.dimensionId);
      if (!dimension) {
        errors.push(`Unknown dimension ${mapping.dimensionId} in ${entry.id}`);
      } else if (!dimension.polarities.includes(mapping.polarity)) {
        errors.push(
          `Invalid polarity ${mapping.polarity} for ${mapping.dimensionId} in ${entry.id}`,
        );
      }
    }
  }

  return errors;
}
