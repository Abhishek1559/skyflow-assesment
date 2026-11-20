# PII de-identifier

A Node.js service that finds sensitive values in free text and replaces them with `[TYPE]` placeholders. Detection is regular expressions plus custom checks (Luhn, calling codes, a calendar). Nothing is sent to an external service and no PII library is used.

```
Patient John Doe can be contacted at john.doe@example.com or +1-415-555-0134. DOB: 1990-05-12.
```

becomes

```
Patient John Doe can be contacted at [EMAIL] or [PHONE]. DOB: [DATE_OF_BIRTH].
```

Names are not a detected type, so `John Doe` stays.

## Setup

Node 20 or newer.

```bash
npm install
npm test            # unit and HTTP tests
npm run typecheck   # tsc --noEmit
npm start           # http://localhost:3000, or PORT
```

There is no build step. `npm start` runs `src/api/server.ts` with `tsx`.

The same function is available without HTTP:

```ts
import { DeidentificationService } from "./src/index";

new DeidentificationService().deidentify("SSN 123-45-6789", { entities: ["SSN"] });
// { deidentifiedText: "SSN [SSN]", entitiesDetected: { SSN: 1 } }
```

### Layout

```
src/core/
  DeidentificationService.ts   input checks, then detect, resolve overlaps, redact
  detection/
    DetectorRegistry.ts        the six detectors, defaults, entity-name checks
    EntityDetector.ts          runs a pattern over the text and returns spans
    detectors/                 one file per entity: a pattern plus its validator
    validators.ts              Luhn, card brands, phone plans, SSN rules, IPv4, email, calendar
    callingCodes.ts            assigned calling codes and national number lengths
  replacement/
    SpanResolver.ts            picks one winner where spans overlap
    TextRedactor.ts            writes placeholders and counts them
src/api/                       Express app, route, controller, body check, error handler
tests/                         unit tests per layer, plus HTTP tests with supertest
```

## API

`POST /deidentify` with a JSON body:

| Field | Required | Meaning |
| --- | --- | --- |
| `text` | yes | The text to scan, up to 100,000 characters. |
| `entities` | no | Types to redact. Omitted means all six. `[]` means none, and the text comes back unchanged. |

The response holds `deidentifiedText` and `entitiesDetected`. The counts list only types that were replaced, so a zero is never written.

## Supported entities

| Type | What is replaced |
| --- | --- |
| `EMAIL` | A practical address, including Unicode letters (`josé@example.com`, `user@münchen.de`). |
| `PHONE` | A formatted NANP number, or a number with `+` or `00` and an assigned calling code. |
| `SSN` | `ddd-dd-dddd` with hyphens, excluding area `000`, `666`, `900–999`, group `00`, and serial `0000`. |
| `DATE_OF_BIRTH` | The date after `DOB`, `D.O.B.`, `Date of Birth`, `Birth date`, `Birthday`, or `Born`. The label stays. |
| `CREDIT_CARD` | 12–19 digits, continuous or grouped, that match a card brand and pass Luhn. |
| `IP_ADDRESS` | IPv4: four dotted groups, each 0–255, with no leading zero on a multi-digit group. |

Names are case sensitive. `email` or `DOB` is a 400 that lists the valid names, not a silent guess.

### Emails

The local part allows letters, digits, dots, and the RFC special characters (such as `'`, `#`, `+`, `%`, `_`, `-`), so `o'brien@example.com` is one address. The domain allows letters, digits, dots, and hyphens, and ends in a TLD of 2–24 letters. Dots at the edges, doubled dots, and labels that start or end with `-` are rejected. A domain ending in a file extension (`logo@2x.png`, `bundle@1.js`) is rejected. Chinese, Japanese, Korean, Thai, Lao, Khmer, and Myanmar characters are never part of an address, because those scripts do not put spaces between words: `联系john@example.com谢谢` becomes `联系[EMAIL]谢谢`.

### Phones

NANP, with a separator: `+1-415-555-0134`, `(415) 555-0134`, `415.555.0134`, `415 555 0134`, `1-800-555-0199`. The area code and the exchange both start with 2–9, and neither is an N11 code. `555` is allowed. Separators are a space, tab, dot, hyphen, non-breaking space, or Unicode hyphen. A slash is not, so `415/555/0134` and `/orders/212/555/0134` stay.

International: a leading `+`, or a `00` token with a separator in it, then an assigned calling code and a national number of the right length. `+1` and `+7` need exactly 10 national digits, and so do `+44` and `+91`. Other codes accept 8–13 (8–12 for Vatican City and the service and satellite codes). One trunk `0`, as in `+44 (0)20 7946 0958`, is dropped when the length fits after that. The whole number is capped at 15 digits. If digit groups follow a number and make it too long, they are dropped, so `+44 20 7946 0958 2024` is a phone followed by a year.

| Text | Result |
| --- | --- |
| `+91-415-555-0134`, `+44 20 7946 0958`, `+33 1 23 45 67 89`, `0044 20 7946 0958`, `+14155550134` | phone |
| `+89-415-555-0134` | stays: 89 is not an assigned code |
| `+1500000` | stays: code 1 plus six digits is an amount |
| `4155550134`, `ORD-415-555-0134`, `00912345678901`, `ORD00442079460958` | stays: bare or glued to an id |
| `123-456-7890`, `415-055-0134` | stays: impossible NANP codes |

### Dates of birth

Only a date right after a label counts. Between the label and the date: `:`, `=`, `-`, `is`, `was`, `on`, or whitespace, including a line break. Formats: `1990-05-12`, `1990/05/12`, `05/12/1990`, `05-12-1990`, `May 12, 1990`, `May 12th, 1990`, `12 May 1990`, `12-May-1990`. The day has to exist, including leap days, and the year runs from 1900 through today. Slash and dash dates are month/day/year, so `13/05/1990` is rejected. `Born in Boston, 05/12/1990` is rejected, because `in Boston,` is not a separator.

### Cards

Continuous digits, or groups of 3–6 digits joined by one kind of separator (space, hyphen, or non-breaking space). A grouped number starts with a group of four, as printed cards do, so `Qty 400 500 600 700 800` is not a card. Mixed separators are rejected. A 20-digit run is not cut down to 16.

Brands and lengths: Visa 13, 16, or 19; Mastercard 16; American Express 15; Discover, JCB, and UnionPay 16–19; Diners 14; Maestro 12–19. A 14-digit number starting with `4` is not a Visa, so it stays. `0000000000000000` passes Luhn and is rejected because every digit is the same.

`4111 1111 1111 1111 003` is one 19-digit Visa and becomes one `[CREDIT_CARD]`. In `2024 4111 1111 1111 1111`, only the card is replaced.

## Examples

All six types:

```bash
curl -s localhost:3000/deidentify \
  -H 'content-type: application/json' \
  -d '{"text":"Patient John Doe can be contacted at john.doe@example.com or +1-415-555-0134. DOB: 1990-05-12."}'
```

```json
{
  "deidentifiedText": "Patient John Doe can be contacted at [EMAIL] or [PHONE]. DOB: [DATE_OF_BIRTH].",
  "entitiesDetected": { "EMAIL": 1, "PHONE": 1, "DATE_OF_BIRTH": 1 }
}
```

A subset. The amount stays, the 19-digit card is one placeholder, and `+91` is accepted:

```bash
curl -s localhost:3000/deidentify \
  -H 'content-type: application/json' \
  -d '{"text":"John Doe paid +1500000 with card 4111 1111 1111 1111 003 and can be contacted at john.doe@example.com or +91-415-555-0134. DOB: 1990-05-12.","entities":["EMAIL","PHONE","DATE_OF_BIRTH","CREDIT_CARD"]}'
```

```json
{
  "deidentifiedText": "John Doe paid +1500000 with card [CREDIT_CARD] and can be contacted at [EMAIL] or [PHONE]. DOB: [DATE_OF_BIRTH].",
  "entitiesDetected": { "CREDIT_CARD": 1, "EMAIL": 1, "PHONE": 1, "DATE_OF_BIRTH": 1 }
}
```

An unknown name:

```json
{ "error": "Unknown entity type: DOB", "validEntities": ["EMAIL", "PHONE", "SSN", "DATE_OF_BIRTH", "CREDIT_CARD", "IP_ADDRESS"] }
```

### Errors

| Case | Status |
| --- | --- |
| `text` missing or not a string, or longer than 100,000 characters | 400 |
| `entities` is not a list of supported names | 400 |
| Body is not a JSON object, or the JSON does not parse | 400 |
| Body larger than 512 KB | 413 |
| Content type present and not JSON | 415 |
| Any other method or path | 404 |

A 400 from the service includes `validEntities`. No error copies the submitted text, and the text is never logged. Empty or whitespace-only text is valid and comes back unchanged. The service does not trim or normalize.

## Design decisions and trade-offs

**Detection is separate from replacement.** Each selected detector reads the original string and returns spans (start, end, type, priority). `resolveSpans` chooses which spans to keep, and `redactText` writes the placeholders in one pass and counts what it wrote. Replacing as each rule matched would go wrong: a hyphenated card contains groups that look like a phone, and if the phone were written first, the Luhn check would never see the card.

**Overlaps.** A span that sits entirely inside a longer one is dropped, so `123-45-6789@example.com` becomes `[EMAIL]`, not `[SSN]@example.com`, and a valid 16-digit prefix of a 19-digit card is not kept. For a partial overlap, the higher priority wins (card 60, SSN 50, date of birth 45, email 40, IP 35, phone 20), then the longer span, then the earlier start. Spans that only touch are both kept.

**Precision over recall.** A phone needs a separator or a `+`/`00` prefix. A date of birth needs a label. A card needs a brand and a checksum. Loosening any of these would also redact order ids, amounts, and ordinary dates. A missed value is the accepted cost.

**The text is not normalized.** Indexes are UTF-16, the same as `slice`, so emoji, accents, CRLF, and other unrelated characters are copied through exactly. Folding fullwidth digits would find a few more numbers and break that guarantee.

**Adding an entity does not touch replacement.** A detector is a type, a priority, and a `detect(text)` that returns spans. A new rule is a file in `detectors/` (usually `createRegexDetector` with a pattern and a validator) plus one line in `DetectorRegistry.ts`, and its name in `DEFAULT_ENTITIES` if it should run by default. The resolver, the redactor, the HTTP layer, and the entity-name check work from the registry and need no change.

**Omitted and empty `entities` are different.** Omitted means the documented default of all six. `[]` is an explicit choice of nothing.

**Bounded work.** Text is capped at 100,000 characters. The JSON limit is 512 KB so that the cap is reachable for non-ASCII text. Patterns avoid nested repeats and cap the length of each value, and the tests feed long inputs shaped to slow a careless regex down, with a time limit, because Node has no regex timeout. Shared global patterns are safe across requests because `matchAll` iterates a copy.

## Known limitations

- A bare 10-digit number is not a phone, even after `Tel:`. A national number with no `+` or `00` (`020 7946 0958`) and a 7-digit local number are not detected.
- Phone lengths are exact only for `+1`, `+7`, `+44`, and `+91`. Other codes use an 8–13 digit range, which is looser than most real plans. The NANP check does not consult the list of assigned area codes. `+91-415-555-0134` is accepted on length, even though Indian mobile numbers start with 6–9.
- An SSN must be written `ddd-dd-dddd`. `123456789` and `123 45 6789` are not detected. `123-45-6789` is redacted: it is a well-known dummy number, but it fits the SSN rules.
- `version 1.2.3.4` is redacted as an IP. `v1.2.3.4`, `1.2.3.4.5`, and `10.0.0.1.example.com` are not. IPv6 is not supported.
- A long numeric id that happens to match a card brand and pass Luhn is redacted. A card split across lines or written with dots is not detected.
- Dates without a label, two-digit years, and dotted dates (`12.05.1990`) are not detected. `03/04/1990` is read as March 4.
- Quoted email local parts (`"john doe"@example.com`) are not matched. A real address whose TLD is a file extension, such as `.js`, is not matched.
- Fullwidth digits are not folded into ASCII.
- Names are not detected.

## Possible improvements

- Use the word before a dotted number (`version`, `v`) to skip version strings.
- Accept a bare 10-digit number only right after a label such as `Tel:` or `Phone:`.
- Let the caller choose day/month order for slash dates.
- Replace the 8–13 range with each country's numbering plan, and check NANP area codes against the assigned list.
- Detect names after labels such as `Patient Name:`, as an opt-in type.
