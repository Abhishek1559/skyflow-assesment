import { matchCallingCode, nationalLength } from "./callingCodes";

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

// Longest name first, so "september" is tried before "sep".
// Built from MONTHS, so the detector cannot name a month the parser does not know.
export const MONTH_NAME_PATTERN = Object.keys(MONTHS)
  .sort((left, right) => right.length - left.length)
  .join("|");

export const ORDINAL = "(?:st|nd|rd|th)?";

const MONTH_FIRST = new RegExp(
  String.raw`^([A-Za-z]+)\s+(\d{1,2})${ORDINAL},?\s+(\d{4})$`,
  "i",
);
const DAY_FIRST = new RegExp(
  String.raw`^(\d{1,2})${ORDINAL}[\s-]+([A-Za-z]+),?[\s-]+(\d{4})$`,
  "i",
);

// Double every second digit from the right. If doubling makes a number
// greater than 9, subtract 9. The total has to be divisible by 10.
export function passesLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;

  let sum = 0;
  let doubleDigit = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (doubleDigit) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

// Lengths these brands actually issue, inside the 12–19 scan window.
// Visa 13/16/19, Mastercard 16, Amex 15, Discover 16–19, JCB 16–19,
// UnionPay 16–19, Diners 14 (and 16 when it starts with 36), Maestro 12–19.
export function isKnownCardIin(digits: string): boolean {
  const length = digits.length;
  if (length < 12 || length > 19) return false;

  if (digits.startsWith("4") && (length === 13 || length === 16 || length === 19)) return true;
  if (length === 15 && (digits.startsWith("34") || digits.startsWith("37"))) return true;

  const firstTwo = Number(digits.slice(0, 2));
  const firstThree = Number(digits.slice(0, 3));
  const firstFour = Number(digits.slice(0, 4));

  if (length === 16 && firstTwo >= 51 && firstTwo <= 55) return true;
  if (length === 16 && firstFour >= 2221 && firstFour <= 2720) return true;

  if (length >= 16 && (digits.startsWith("6011") || digits.startsWith("65"))) return true;
  if (length >= 16 && firstFour >= 6440 && firstFour <= 6499) return true;
  if (length >= 16 && firstFour >= 3528 && firstFour <= 3589) return true;
  if (length >= 16 && digits.startsWith("62")) return true;

  if (length === 14 && firstThree >= 300 && firstThree <= 305) return true;
  if (length === 14 && (firstFour === 3095 || digits.startsWith("36") || digits.startsWith("38"))) {
    return true;
  }
  if (length === 16 && digits.startsWith("36")) return true;

  // Maestro. 50, and 56–69 except the Discover and UnionPay prefixes already accepted above.
  if (digits.startsWith("50")) return true;
  if (firstTwo >= 56 && firstTwo <= 69 && !digits.startsWith("62") && !digits.startsWith("65")) return true;

  return false;
}

// Digits only. The detector has already checked the separators.
export function isPlausibleCard(digits: string): boolean {
  // 0000000000000000 passes Luhn because the sum is 0.
  // A card number is not the same digit repeated.
  if (/^(\d)\1+$/.test(digits)) return false;
  return isKnownCardIin(digits) && passesLuhn(digits);
}

// A formatted NANP number, a number that starts with +, or a 00 international prefix.
// Bare digit runs never reach this function. The detector requires a separator, +, or 00.
// +1500000 fails: country code 1 is real, and the rest is not a 10-digit NANP number.
// +89 fails because 89 is not an assigned calling code.
export function isPlausiblePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (value.startsWith("+")) return isInternational(digits);
  if (value.startsWith("00")) return isInternational(digits.slice(2));
  return isValidNanp(digits);
}

// Calling code, then a national number that fits that code's plan.
// E.164 caps the whole number, without a trunk 0, at 15 digits.
function isInternational(digits: string): boolean {
  const code = matchCallingCode(digits);
  if (!code) return false;

  const national = fitNationalNumber(code, digits.slice(code.length));
  if (!national || code.length + national.length > 15) return false;
  return code === "1" ? isValidNanp(national) : true;
}

// Drop one trunk 0 only when the plan does not fit until it is gone.
// +44 (0)20 7946 0958 is written with a 0. +39 keeps its 0 when that length is legal.
function fitNationalNumber(code: string, rest: string): string | null {
  const range = nationalLength(code);
  if (!range) return null;
  const [min, max] = range;
  if (rest.length >= min && rest.length <= max) return rest;
  if (rest.startsWith("0")) {
    const dropped = rest.slice(1);
    if (dropped.length >= min && dropped.length <= max) return dropped;
  }
  return null;
}

// NANP: NPA NXX XXXX. The first digit of each is 2-9, and N11 (211, 911) is not a subscriber code.
// 555 is allowed. The sample number uses it. 123 and 012 are not area codes.
function isValidNanp(digits: string): boolean {
  let national = digits;
  if (digits.length === 11 && digits.startsWith("1")) national = digits.slice(1);
  if (national.length !== 10) return false;
  return isNanpCode(national.slice(0, 3)) && isNanpCode(national.slice(3, 6));
}

function isNanpCode(code: string): boolean {
  return /^[2-9]\d{2}$/.test(code) && code.slice(1) !== "11";
}

// Area 000, 666, and 900-999 were not issued. Group 00 and serial 0000 were not either.
// This still accepts dummy numbers such as 123-45-6789. The shape is valid. We cannot know if it was issued.
export function isPlausibleSsn(value: string): boolean {
  const match = /^(\d{3})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return false;

  const area = Number(match[1]);
  const group = Number(match[2]);
  const serial = Number(match[3]);

  if (area === 0 || area === 666 || area >= 900) return false;
  if (group === 0 || serial === 0) return false;
  return true;
}

// The detector supplies four dotted groups of 1–3 digits. Each must be 0–255.
// "001" is rejected. A single 0 is a real octet (0.0.0.0, 10.0.0.1).
export function isValidIpv4(value: string): boolean {
  return value
    .split(".")
    .every((octet) => !(octet.length > 1 && octet.startsWith("0")) && Number(octet) <= 255);
}

// "logo@2x.png" has the shape of an address. No real mail domain ends in a file extension.
const ASSET_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp",
  "css", "js", "json", "woff", "woff2",
]);

// The detector supplies one "@" and a dotted domain. This checks what a regex states badly:
// no empty or edge dots, no label that starts or ends with "-", and a TLD that starts with a letter.
export function isPlausibleEmail(value: string): boolean {
  const at = value.indexOf("@");
  const local = value.slice(0, at);
  const labels = value.slice(at + 1).split(".");

  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (labels.some((label) => label === "" || label.startsWith("-") || label.endsWith("-"))) return false;

  const tld = labels[labels.length - 1];
  return !ASSET_EXTENSIONS.has(tld.toLowerCase()) && /^\p{L}/u.test(tld);
}

// Date.parse("1990-02-30") rolls into March. Check the day against the month instead.
function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

function parseDate(value: string): { year: number; month: number; day: number } | null {
  // 1990-05-12 / 1990/05/12, with the same separator twice.
  const yearFirst = /^(\d{4})([-/])(\d{2})\2(\d{2})$/.exec(value);
  if (yearFirst) {
    return { year: Number(yearFirst[1]), month: Number(yearFirst[3]), day: Number(yearFirst[4]) };
  }

  // Slash and dash dates are read as month/day/year. 13/05/1990 is not a US date.
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (us) {
    return { year: Number(us[3]), month: Number(us[1]), day: Number(us[2]) };
  }

  // May 12, 1990 / May 12th, 1990
  const monthFirst = MONTH_FIRST.exec(value);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()];
    if (!month) return null;
    return { year: Number(monthFirst[3]), month, day: Number(monthFirst[2]) };
  }

  // 12 May 1990 / 12-May-1990 / 12th May, 1990
  const dayFirst = DAY_FIRST.exec(value);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].toLowerCase()];
    if (!month) return null;
    return { year: Number(dayFirst[3]), month, day: Number(dayFirst[1]) };
  }

  return null;
}

// A real calendar day, from 1900 through today.
export function isRecognizedDob(value: string, today = new Date()): boolean {
  const parsed = parseDate(value);
  if (!parsed) return false;

  const { year, month, day } = parsed;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  if (year < 1900) return false;

  const date = year * 10_000 + month * 100 + day;
  const limit = today.getFullYear() * 10_000 + (today.getMonth() + 1) * 100 + today.getDate();
  return date <= limit;
}
