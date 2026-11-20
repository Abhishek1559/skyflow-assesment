import { createRegexDetector } from "../EntityDetector";
import { isRecognizedDob, MONTH_NAME_PATTERN, ORDINAL } from "../validators";

// The label is in the match. Only the named group "date" is replaced.
// "D.O.B." and "D.O.B" are both seen. A trailing word boundary would not work after the final ".",
// so the last dot is simply optional.
const LABEL = String.raw`\bDOB\b|\bD\.O\.B\.?|\bDate\s+of\s+Birth\b|\bBirth\s*(?:date|day)\b|\bBorn\b`;

// Between label and date: "DOB: ", "DOB - ", "DOB is ", "Born on ", or just a space ("DOB 05/12/1990").
// "Born in Boston, 05/12/1990" still fails, because "in Boston," is not a date.
const SEPARATOR = String.raw`(?:\s*[:=\-]\s*|\s+(?:is|was|on)\s+|\s+)`;

// Year first (1990-05-12, 1990/05/12), US numeric, "May 12, 1990" / "May 12th, 1990",
// and "12 May 1990" / "12-May-1990".
// Two-digit years are not matched: 05/12/90 could be 1990 or 2090.
const DATE = [
  String.raw`\d{4}-\d{2}-\d{2}`,
  String.raw`\d{4}/\d{2}/\d{2}`,
  String.raw`\d{1,2}/\d{1,2}/\d{4}`,
  String.raw`\d{1,2}-\d{1,2}-\d{4}`,
  String.raw`(?:${MONTH_NAME_PATTERN})[ \t]+\d{1,2}${ORDINAL},?[ \t]+\d{4}`,
  String.raw`\d{1,2}${ORDINAL}[ \t-]+(?:${MONTH_NAME_PATTERN}),?[ \t-]+\d{4}`,
].join("|");

const pattern = new RegExp(String.raw`(?:${LABEL})${SEPARATOR}(?<date>${DATE})(?!\d)`, "dgi");

export const dobDetector = createRegexDetector({
  type: "DATE_OF_BIRTH",
  priority: 45,
  pattern,
  captureGroup: "date",
  validate: isRecognizedDob,
});
