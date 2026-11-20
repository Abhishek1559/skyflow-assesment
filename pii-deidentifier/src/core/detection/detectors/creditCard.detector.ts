import { findSpans, type EntityDetector } from "../EntityDetector";
import type { MatchSpan } from "../../types";
import { isPlausibleCard } from "../validators";

const PRIORITY = 60;

// A continuous run has no separator. The lookahead tries every start, and (?!\d) refuses
// to cut a window out of a longer run of digits. 20 digits is not a 16-digit card.
const CONTINUOUS = /(?<!\d)(?=(?<card>\d{12,19})(?!\d))/dg;

// Every window that passes is reported. When a valid 16-digit prefix sits inside a valid
// 19-digit number, the span resolver keeps only the longer one.
export const creditCardDetector: EntityDetector = {
  type: "CREDIT_CARD",
  priority: PRIORITY,
  detect(text) {
    return [
      ...findSpans(text, CONTINUOUS, "CREDIT_CARD", PRIORITY, {
        captureGroup: "card",
        validate: isPlausibleCard,
      }),
      ...groupedCards(text),
    ];
  },
};

// Groups of 3 to 6 digits (the first is always 4), joined by one space, one hyphen,
// or one non-breaking space.
// The separator must stay the same through a run. A group can end one run and start the
// next, so "2024 4111-1111-1111-1111" still sees the hyphenated card.
function groupedCards(text: string): MatchSpan[] {
  const groups: { start: number; end: number }[] = [];

  for (let i = 0; i < text.length; i++) {
    if (!isDigit(text, i)) continue;
    let end = i + 1;
    while (end < text.length && isDigit(text, end)) end++;
    if (end - i >= 3 && end - i <= 6) groups.push({ start: i, end });
    i = end;
  }

  const spans: MatchSpan[] = [];
  let runStart = 0;

  while (runStart < groups.length) {
    let separator: string | null = null;
    let runEnd = runStart;

    while (runEnd + 1 < groups.length) {
      const between = text.slice(groups[runEnd].end, groups[runEnd + 1].start);
      if (!CARD_SEPARATORS.has(between) || (separator !== null && between !== separator)) break;
      separator = between;
      runEnd++;
    }

    for (let i = runStart; i < runEnd; i++) {
      // A printed card number starts with a group of four. Without this, a row of
      // quantities such as "500 600 700 800" passes Luhn as a 12-digit Maestro number.
      if (groups[i].end - groups[i].start !== 4) continue;
      let digits = "";
      for (let j = i; j <= runEnd && digits.length < 19; j++) {
        digits += text.slice(groups[j].start, groups[j].end);
        if (digits.length < 12 || !isPlausibleCard(digits)) continue;

        spans.push({ start: groups[i].start, end: groups[j].end, entityType: "CREDIT_CARD", priority: PRIORITY });
      }
    }

    // Start the next run on the group where the separator changed.
    // A run of one group has nothing to join, so move past it.
    runStart = runEnd === runStart ? runStart + 1 : runEnd;
  }

  return spans;
}

const CARD_SEPARATORS = new Set([" ", "-", "\u00a0"]);

function isDigit(text: string, index: number): boolean {
  const code = text.charCodeAt(index);
  return code >= 48 && code <= 57;
}
