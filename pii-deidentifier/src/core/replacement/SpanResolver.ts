import type { MatchSpan } from "../types";

// Picks the spans that will be replaced, so no character is replaced twice.
// 1. A span that sits entirely inside a longer one is dropped. An SSN typed inside an email
//    does not leave "@example.com" behind, and a 16-digit prefix of a 19-digit card is not kept.
// 2. A partial overlap keeps the higher priority, then the longer span, then the earlier start.
// Spans that only touch (end === next start) are both kept. Identical spans collapse to one.
export function resolveSpans(spans: MatchSpan[], textLength: number): MatchSpan[] {
  const ordered = dropContained(spans).sort(
    (a, b) => b.priority - a.priority || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );

  // Marks every character a kept span covers, so a check costs the candidate's length,
  // not the number of spans kept so far.
  const taken = new Uint8Array(textLength);
  const kept: MatchSpan[] = [];

  for (const candidate of ordered) {
    if (taken.subarray(candidate.start, candidate.end).includes(1)) continue;
    taken.fill(1, candidate.start, candidate.end);
    kept.push(candidate);
  }

  return kept.sort((a, b) => a.start - b.start);
}

// Sorted by start, longest first, a span is inside an earlier one exactly when the
// furthest end seen so far reaches its end. Equal ranges are not "inside" each other;
// priority decides between those.
function dropContained(spans: MatchSpan[]): MatchSpan[] {
  const byStart = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: MatchSpan[] = [];
  let reachStart = -1;
  let reachEnd = -1;

  for (const span of byStart) {
    const sameRange = reachStart === span.start && reachEnd === span.end;
    if (reachEnd < span.end || sameRange) kept.push(span);
    if (span.end > reachEnd) {
      reachStart = span.start;
      reachEnd = span.end;
    }
  }

  return kept;
}
