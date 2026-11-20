import { createRegexDetector } from "../EntityDetector";
import { isPlausibleEmail } from "../validators";

// A practical address, not the full RFC. Quoted local-parts and comments are out.
//
// Letters and digits are Unicode-aware, so josé@example.com, иван@пример.рф and user@münchen.de
// are found. Scripts that are written without spaces between words (Chinese, Japanese, Korean,
// Thai, Lao, Khmer, Myanmar) are left out of the address on purpose. In "联系john@example.com谢谢"
// the surrounding characters are ordinary text, and counting them as part of the address
// would redact words that were never sensitive.
//
// This uses the `v` flag, which allows subtracting one character set from another.
const NO_SPACE_SCRIPTS = [
  "Han",
  "Hiragana",
  "Katakana",
  "Hangul",
  "Thai",
  "Lao",
  "Khmer",
  "Myanmar",
]
  .map((script) => String.raw`\p{Script=${script}}`)
  .join("");

const LETTER = String.raw`[[\p{L}\p{M}]--[${NO_SPACE_SCRIPTS}]]`;
const WORD_CHAR = String.raw`[[\p{L}\p{M}\p{N}]--[${NO_SPACE_SCRIPTS}]]`;
// RFC local-part characters, plus Unicode letters. An apostrophe or a hash has to be
// included, or o'brien@example.com is cut into o' and [EMAIL].
// In a `v` class, / { } | and - are operators, so they are escaped.
const LOCAL_CHAR =
  "[" + WORD_CHAR + String.raw`!#$%&'*+\/=?^_` + "`" + String.raw`\{\|\}~._\-` + "]";
const DOMAIN_CHAR = String.raw`[${WORD_CHAR}.\-]`;

// The lookbehind refuses to start in the middle of a longer word.
// The lookahead keeps a trailing comma, period, or CJK character out of the match.
// The validator drops ".john@example.com", "john..doe@example.com", and "logo@2x.png".
const pattern = new RegExp(
  String.raw`(?<!${LOCAL_CHAR})${LOCAL_CHAR}{1,64}@${DOMAIN_CHAR}{1,253}\.${LETTER}{2,24}(?!${LETTER})`,
  "gv",
);

export const emailDetector = createRegexDetector({
  type: "EMAIL",
  priority: 40,
  pattern,
  validate: isPlausibleEmail,
});
