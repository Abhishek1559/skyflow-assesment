export const DEFAULT_ENTITIES = [
  "EMAIL",
  "PHONE",
  "SSN",
  "DATE_OF_BIRTH",
  "CREDIT_CARD",
  "IP_ADDRESS",
] as const;

export const MAX_TEXT_LENGTH = 100_000;

// A detected value, as UTF-16 offsets into the original text. The text itself is not copied.
export interface MatchSpan {
  start: number;
  end: number;
  entityType: string;
  priority: number;
}

export interface DeidentifyOptions {
  entities?: string[];
}

export interface DeidentifyResult {
  deidentifiedText: string;
  // Only types that were actually replaced. Zero counts are omitted.
  entitiesDetected: Record<string, number>;
}
