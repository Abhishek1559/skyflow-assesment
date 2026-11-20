import type { MatchSpan } from "../types";

export interface EntityDetector {
  readonly type: string;
  readonly priority: number;
  detect(text: string): MatchSpan[];
}

interface ScanOptions {
  // Report only this named group, so a label such as "DOB:" stays in the text.
  // The pattern needs the `d` flag, which records where each group sits.
  captureGroup?: string;
  validate?: (value: string) => boolean;
}

// One scan of the original string. Nothing here writes placeholders.
// matchAll walks a copy of the pattern, so a shared global regex keeps no state between calls.
export function findSpans(
  text: string,
  pattern: RegExp,
  entityType: string,
  priority: number,
  options: ScanOptions = {},
): MatchSpan[] {
  const spans: MatchSpan[] = [];

  for (const match of text.matchAll(pattern)) {
    const range = options.captureGroup
      ? match.indices?.groups?.[options.captureGroup]
      : [match.index, match.index + match[0].length];
    if (!range) continue;

    const [start, end] = range;
    if (options.validate && !options.validate(text.slice(start, end))) continue;

    spans.push({ start, end, entityType, priority });
  }

  return spans;
}

export function createRegexDetector(config: {
  type: string;
  priority: number;
  pattern: RegExp;
  captureGroup?: string;
  validate?: (value: string) => boolean;
}): EntityDetector {
  const { type, priority, pattern, ...options } = config;
  return {
    type,
    priority,
    detect: (text) => findSpans(text, pattern, type, priority, options),
  };
}
