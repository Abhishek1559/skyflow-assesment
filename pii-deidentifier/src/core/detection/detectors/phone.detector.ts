import type { EntityDetector } from "../EntityDetector";
import type { MatchSpan } from "../../types";
import { isPlausiblePhone } from "../validators";

const PRIORITY = 20;

// Space, tab, dot, hyphen, plus the characters a copy from a web page or a word processor leaves
// behind: non-breaking space, narrow no-break space, and the Unicode hyphens (U+2010, U+2011).
// A slash is not a separator. It appears in paths and ratios.
const SEP = String.raw`[ \t\u00a0\u202f.\u2010\u2011-]`;

// The lookbehind refuses a number glued to an id, such as ORD-415-555-0134.
// A bare 10-digit order id has no separator, so it never matches these patterns.
const BOUNDARY = String.raw`(?<![\w\u2010\u2011-])`;

// +1-415-555-0134, (415) 555-0134, 415.555.0134, 1-800-555-0199.
// The area code and exchange are checked later. 123-456-7890 matches the shape and then fails.
const NANP = new RegExp(
  String.raw`${BOUNDARY}(?:\+?1${SEP}?)?(?:\(\d{3}\)${SEP}?|\d{3}${SEP})\d{3}${SEP}\d{4}(?!\d)`,
  "g",
);

// +44 20 7946 0958, +33 1 23 45 67 89, +49 30 12345678, +44 (0)20 7946 0958.
// Country code 1 is left to the NANP rule, so "+1 (415) 555-0134" is not reported twice.
const INTERNATIONAL = new RegExp(
  String.raw`(?<!\w)\+(?!1\D{0,2}\d)\d{1,3}(?:${SEP}?\(\d{1,4}\)\d{0,8})?(?:${SEP}\d{1,8}){1,6}(?!\d)`,
  "g",
);

// +14155550134. Seven digits is too short: +1500000 is an amount, not a phone.
// Fifteen is the E.164 maximum, and it also stops this from swallowing a 16-digit card.
const E164 = /(?<!\w)\+\d{8,15}(?!\d)/g;

// 0044 20 7946 0958. The 00 has to be its own token and the number has to contain a separator,
// so ORD00442079460958 and 00912345678901 stay as ids.
const FROM_ABROAD = new RegExp(
  String.raw`${BOUNDARY}00${SEP}?\d{1,3}(?:${SEP}\d{1,8}){1,6}(?!\d)`,
  "g",
);

const PATTERNS = [NANP, INTERNATIONAL, E164, FROM_ABROAD];
const TRAILING_GROUP = new RegExp(String.raw`${SEP}\d+$`);

export const phoneDetector: EntityDetector = {
  type: "PHONE",
  priority: PRIORITY,
  detect(text) {
    const spans: MatchSpan[] = [];
    for (const pattern of PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        const phone = longestPlausible(match[0]);
        if (phone) spans.push({ start: match.index, end: match.index + phone.length, entityType: "PHONE", priority: PRIORITY });
      }
    }
    return spans;
  },
};

// A pattern takes every digit group it can reach. When that is too long for the country's plan,
// trailing groups are dropped until it fits, so "+44 20 7946 0958 2024" is a phone and a year.
function longestPlausible(value: string): string | null {
  let candidate = value;
  while (!isPlausiblePhone(candidate)) {
    const shorter = candidate.replace(TRAILING_GROUP, "");
    if (shorter === candidate) return null;
    candidate = shorter;
  }
  return candidate;
}
