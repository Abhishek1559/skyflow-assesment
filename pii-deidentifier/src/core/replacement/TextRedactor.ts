import type { DeidentifyResult, MatchSpan } from "../types";

// One walk over the original string. slice() and the regex indexes are both UTF-16,
// so an emoji or a CRLF between spans is copied through unchanged.
// Counts are taken from the spans we actually write, not from a second search.
export function redactText(text: string, spans: MatchSpan[]): DeidentifyResult {
  let out = "";
  let cursor = 0;
  const entitiesDetected: Record<string, number> = {};

  for (const span of spans) {
    out += text.slice(cursor, span.start);
    out += `[${span.entityType}]`;
    entitiesDetected[span.entityType] = (entitiesDetected[span.entityType] ?? 0) + 1;
    cursor = span.end;
  }

  out += text.slice(cursor);
  return { deidentifiedText: out, entitiesDetected };
}
