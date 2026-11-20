import { createRegexDetector } from "../EntityDetector";
import { isPlausibleSsn } from "../validators";

// Hyphens only, in the 3-2-4 layout. "123 45 6789" is left alone.
// The lookarounds keep this from cutting a window out of a longer hyphenated id:
// "123-45-6789-1234" and "9-123-45-6789" are not SSNs, so nothing is replaced.
export const ssnDetector = createRegexDetector({
  type: "SSN",
  priority: 50,
  pattern: /(?<!\w)(?<!\d-)\d{3}-\d{2}-\d{4}(?!\w)(?!-\d)/g,
  validate: isPlausibleSsn,
});
