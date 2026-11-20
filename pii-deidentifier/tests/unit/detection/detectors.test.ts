import { describe, expect, it } from "vitest";
import { creditCardDetector } from "../../../src/core/detection/detectors/creditCard.detector";
import { dobDetector } from "../../../src/core/detection/detectors/dob.detector";
import { emailDetector } from "../../../src/core/detection/detectors/email.detector";
import { ipAddressDetector } from "../../../src/core/detection/detectors/ipAddress.detector";
import { phoneDetector } from "../../../src/core/detection/detectors/phone.detector";
import { ssnDetector } from "../../../src/core/detection/detectors/ssn.detector";
import type { EntityDetector } from "../../../src/core/detection/EntityDetector";

function values(detector: EntityDetector, text: string): string[] {
  return detector.detect(text).map((span) => text.slice(span.start, span.end));
}

describe("email detector", () => {
  it("finds an address and leaves the trailing period", () => {
    const text = "Write john.doe@example.com.";
    const spans = emailDetector.detect(text);
    expect(values(emailDetector, text)).toEqual(["john.doe@example.com"]);
    expect(text.slice(spans[0].end)).toBe(".");
  });

  it("finds two addresses separated by a comma", () => {
    expect(values(emailDetector, "a@b.co,c@d.co")).toEqual(["a@b.co", "c@d.co"]);
  });

  it("drops addresses with empty or doubled dots", () => {
    expect(values(emailDetector, "john..doe@example.com")).toEqual([]);
    expect(values(emailDetector, ".john@example.com")).toEqual([]);
  });

  it("finds accented, Cyrillic, and internationalized addresses", () => {
    expect(values(emailDetector, "josé@example.com")).toEqual(["josé@example.com"]);
    expect(values(emailDetector, "почта:иван@пример.рф.")).toEqual(["иван@пример.рф"]);
    expect(values(emailDetector, "user@münchen.de")).toEqual(["user@münchen.de"]);
  });

  it("does not swallow Chinese or Thai text that touches an address", () => {
    const chinese = "联系john@example.com谢谢";
    const [chineseSpan] = emailDetector.detect(chinese);
    expect(chinese.slice(chineseSpan.start, chineseSpan.end)).toBe("john@example.com");
    expect(chinese.slice(0, chineseSpan.start)).toBe("联系");
    expect(chinese.slice(chineseSpan.end)).toBe("谢谢");

    expect(values(emailDetector, "อีเมลjohn@example.comขอบคุณ")).toEqual(["john@example.com"]);
  });

  it("keeps surrounding punctuation out of the match", () => {
    expect(values(emailDetector, '(a@b.co) "c@d.co" <e@f.co>!')).toEqual(["a@b.co", "c@d.co", "e@f.co"]);
  });

  it("rejects file names, underscores in the domain, and a numeric TLD", () => {
    expect(values(emailDetector, "logo@2x.png")).toEqual([]);
    expect(values(emailDetector, "bundle@1.js")).toEqual([]);
    expect(values(emailDetector, "john@ex_ample.com")).toEqual([]);
    expect(values(emailDetector, "john@example.123")).toEqual([]);
  });

  it("rejects a local part longer than 64 characters", () => {
    expect(values(emailDetector, `${"a".repeat(65)}@example.com`)).toEqual([]);
  });
});

describe("phone detector", () => {
  it("finds the common layouts, and returns exactly the number", () => {
    const layouts = [
      "+1-415-555-0134",
      "(415) 555-0134",
      "415.555.0134",
      "415-555-0134",
      "415 555 0134",
      "1-800-555-0199",
      "+1 (415) 555-0134",
      "+44 20 7946 0958",
      "+44 (0)20 7946 0958",
      "+91 98765 43210",
      "+91-415-555-0134",
      "+14155550134",
      "0044 20 7946 0958",
      "00 49 123456 789012 3",
      "+33 1 23 45 67 89",
      "+49 30 12345678",
    ];
    for (const number of layouts) {
      expect(values(phoneDetector, `Call ${number}.`)).toEqual([number]);
    }
  });

  it("treats a non-breaking space or Unicode hyphen as a separator", () => {
    expect(values(phoneDetector, "415\u00a0555\u00a00134")).toEqual(["415\u00a0555\u00a00134"]);
    expect(values(phoneDetector, "415\u2011555\u20110134")).toEqual(["415\u2011555\u20110134"]);
  });

  it("finds two numbers on one line", () => {
    expect(values(phoneDetector, "415-555-0134, 415-555-0135")).toEqual(["415-555-0134", "415-555-0135"]);
  });

  it("does not absorb a digit that follows the number", () => {
    expect(values(phoneDetector, "415-555-0134 5")).toEqual(["415-555-0134"]);
  });

  it("drops trailing digit groups that make an international number too long", () => {
    expect(values(phoneDetector, "+44 20 7946 0958 2024")).toEqual(["+44 20 7946 0958"]);
    expect(values(phoneDetector, "0044 20 7946 0958 4111 1111")).toEqual(["0044 20 7946 0958"]);
  });

  it("ignores bare digit runs, dates, and SSN-shaped numbers", () => {
    expect(values(phoneDetector, "4155550134")).toEqual([]);
    expect(values(phoneDetector, "1990-05-12")).toEqual([]);
    expect(values(phoneDetector, "10.12.2024")).toEqual([]);
    expect(values(phoneDetector, "123-45-6789")).toEqual([]);
    expect(values(phoneDetector, "192.168.0.1")).toEqual([]);
  });

  it("ignores times, year ranges, and ISBNs", () => {
    expect(values(phoneDetector, "Meeting 10:30-11:45")).toEqual([]);
    expect(values(phoneDetector, "Fiscal 2019-2024")).toEqual([]);
    expect(values(phoneDetector, "ISBN 978-3-16-148410-0")).toEqual([]);
  });

  it("ignores a number that is too short for a phone", () => {
    expect(values(phoneDetector, "555-0134")).toEqual([]);
  });

  it("ignores amounts, unassigned country codes, invalid NANP codes, and order ids", () => {
    expect(values(phoneDetector, "paid +1500000 today")).toEqual([]);
    expect(values(phoneDetector, "Call +89-415-555-0134.")).toEqual([]);
    expect(values(phoneDetector, "Invoice 123-456-7890")).toEqual([]);
    expect(values(phoneDetector, "Ref 012-345-6789")).toEqual([]);
    expect(values(phoneDetector, "Ref 415-055-0134")).toEqual([]);
    expect(values(phoneDetector, "ORD-123-456-7890")).toEqual([]);
    expect(values(phoneDetector, "ORD-415-555-0134")).toEqual([]);
    expect(values(phoneDetector, "Invoice 00912345678901")).toEqual([]);
    expect(values(phoneDetector, "ORD00442079460958")).toEqual([]);
    expect(values(phoneDetector, "GET /orders/212/555/0134")).toEqual([]);
    expect(values(phoneDetector, "415/555/0134")).toEqual([]);
  });
});

describe("SSN detector", () => {
  it("finds a hyphenated number that passes the allocation rules", () => {
    expect(values(ssnDetector, "SSN 123-45-6789.")).toEqual(["123-45-6789"]);
  });

  it("ignores numbers the SSA would not issue, and space-separated digits", () => {
    expect(values(ssnDetector, "000-12-3456")).toEqual([]);
    expect(values(ssnDetector, "666-12-3456")).toEqual([]);
    expect(values(ssnDetector, "900-12-3456")).toEqual([]);
    expect(values(ssnDetector, "123 45 6789")).toEqual([]);
  });
});

describe("date of birth detector", () => {
  it("replaces the date and not the label", () => {
    const text = "DOB: 1990-05-12";
    const spans = dobDetector.detect(text);
    expect(spans).toHaveLength(1);
    expect(text.slice(spans[0].start, spans[0].end)).toBe("1990-05-12");
    expect(text.slice(0, spans[0].start)).toBe("DOB: ");
  });

  it("accepts the other labeled forms, including a line break after the colon", () => {
    expect(values(dobDetector, "Date of Birth: May 12, 1990")).toEqual(["May 12, 1990"]);
    expect(values(dobDetector, "D.O.B.: 05/12/1990")).toEqual(["05/12/1990"]);
    expect(values(dobDetector, "dob: 1990-05-12")).toEqual(["1990-05-12"]);
    expect(values(dobDetector, "DOB:\n1990-05-12")).toEqual(["1990-05-12"]);
  });

  it("ignores a date with no label, a bad day, and a city phrase", () => {
    expect(values(dobDetector, "Appointment 1990-05-12")).toEqual([]);
    expect(values(dobDetector, "DOB: 1990-02-30")).toEqual([]);
    expect(values(dobDetector, "Born in Boston, 05/12/1990")).toEqual([]);
    expect(values(dobDetector, "DOB: 13/05/1990")).toEqual([]);
  });

  it("accepts D.O.B with and without the last dot", () => {
    expect(values(dobDetector, "D.O.B: 1990-05-12")).toEqual(["1990-05-12"]);
    expect(values(dobDetector, "D.O.B.: 1990-05-12")).toEqual(["1990-05-12"]);
    expect(values(dobDetector, "D.O.B. 05/12/1990")).toEqual(["05/12/1990"]);
  });

  it("accepts day-first and ordinal dates, and the other label words", () => {
    expect(values(dobDetector, "DOB: 12 May 1990")).toEqual(["12 May 1990"]);
    expect(values(dobDetector, "DOB: 12-May-1990")).toEqual(["12-May-1990"]);
    expect(values(dobDetector, "DOB: May 12th, 1990")).toEqual(["May 12th, 1990"]);
    expect(values(dobDetector, "Born on 12/05/1990")).toEqual(["12/05/1990"]);
    expect(values(dobDetector, "Birthday is May 12, 1990")).toEqual(["May 12, 1990"]);
    expect(values(dobDetector, "Birth Date: 1990-05-12")).toEqual(["1990-05-12"]);
    expect(values(dobDetector, "DOB:1990-05-12")).toEqual(["1990-05-12"]);
    expect(values(dobDetector, "DOB: 1990/05/12")).toEqual(["1990/05/12"]);
    expect(values(dobDetector, "DOB: 1990/05-12")).toEqual([]);
  });

  it("ignores a two-digit year, a year alone, a dotted date, and a label buried in a word", () => {
    expect(values(dobDetector, "DOB: 05/12/90")).toEqual([]);
    expect(values(dobDetector, "DOB: 1990")).toEqual([]);
    expect(values(dobDetector, "DOB: 12.05.1990")).toEqual([]);
    expect(values(dobDetector, "SHAPEDOB: 1990-05-12")).toEqual([]);
  });

  it("applies the year bounds and the leap-year rule", () => {
    expect(values(dobDetector, "DOB: 1900-01-01")).toEqual(["1900-01-01"]);
    expect(values(dobDetector, "DOB: 1899-12-31")).toEqual([]);
    expect(values(dobDetector, "DOB: 2099-01-01")).toEqual([]);
    expect(values(dobDetector, "DOB: 2000-02-29")).toEqual(["2000-02-29"]);
    expect(values(dobDetector, "DOB: 1900-02-29")).toEqual([]);
  });
});

describe("credit card detector", () => {
  it("finds continuous, grouped, and Amex numbers", () => {
    expect(values(creditCardDetector, "4111111111111111")).toEqual(["4111111111111111"]);
    expect(values(creditCardDetector, "4111-1111-1111-1111")).toEqual(["4111-1111-1111-1111"]);
    expect(values(creditCardDetector, "4111 1111 1111 1111")).toEqual(["4111 1111 1111 1111"]);
    expect(values(creditCardDetector, "378282246310005")).toEqual(["378282246310005"]);
    expect(values(creditCardDetector, "3782 822463 10005")).toEqual(["3782 822463 10005"]);
    expect(values(creditCardDetector, "4532-0151-1283-0366")).toEqual(["4532-0151-1283-0366"]);
  });

  it("ignores checksum failures, repeated zeros, mixed separators, and a longer digit run", () => {
    expect(values(creditCardDetector, "4111111111111112")).toEqual([]);
    expect(values(creditCardDetector, "0000000000000000")).toEqual([]);
    expect(values(creditCardDetector, "4111-1111 1111-1111")).toEqual([]);
    expect(values(creditCardDetector, "41111111111111111234")).toEqual([]);
  });

  // Regression: the grouped pattern used to read "2024 4111 1111 1111" as one window, fail the
  // checksum, consume it, and never look at the card that starts one group later.
  it("finds a card that follows another group of four digits", () => {
    expect(values(creditCardDetector, "2024 4111 1111 1111 1111")).toEqual(["4111 1111 1111 1111"]);
    expect(values(creditCardDetector, "1234 4111 1111 1111 1111")).toEqual(["4111 1111 1111 1111"]);
    expect(values(creditCardDetector, "Expires 2024 4111-1111-1111-1111")).toEqual(["4111-1111-1111-1111"]);
  });

  it("reports a 19-digit Visa, including the final group", () => {
    expect(values(creditCardDetector, "4111 1111 1111 1111 003")).toContain("4111 1111 1111 1111 003");
    expect(values(creditCardDetector, "4111-1111-1111-1111-003")).toContain("4111-1111-1111-1111-003");
    expect(values(creditCardDetector, "4111111111111111003")).toEqual(["4111111111111111003"]);
  });

  it("finds two cards written one after the other", () => {
    expect(values(creditCardDetector, "4111 1111 1111 1111 5500 0000 0000 0004")).toEqual([
      "4111 1111 1111 1111",
      "5500 0000 0000 0004",
    ]);
  });

  it("reports the exact span, so the text around the card is untouched", () => {
    const text = "Card 4532-0151-1283-0366 expires 12/28.";
    const [span] = creditCardDetector.detect(text);
    expect(text.slice(span.start, span.end)).toBe("4532-0151-1283-0366");
  });

  it("accepts a non-breaking space between groups", () => {
    expect(values(creditCardDetector, "4111\u00a01111\u00a01111\u00a01111")).toEqual([
      "4111\u00a01111\u00a01111\u00a01111",
    ]);
  });

  it("finds the other brands inside the 12 to 19 digit window", () => {
    expect(values(creditCardDetector, "30569309025904")).toEqual(["30569309025904"]);
    expect(values(creditCardDetector, "3530111333300000")).toEqual(["3530111333300000"]);
    expect(values(creditCardDetector, "501800000009")).toEqual(["501800000009"]);
  });

  it("leaves a number that is not one of those brands alone", () => {
    expect(values(creditCardDetector, "7111111111111116")).toEqual([]);
  });

  it("needs a first group of four, so a row of quantities is not a card", () => {
    expect(values(creditCardDetector, "Qty 400 500 600 700 800")).toEqual([]);
    expect(values(creditCardDetector, "5018 0000 0009")).toEqual(["5018 0000 0009"]);
  });
});

describe("IP detector", () => {
  it("finds a normal address", () => {
    expect(values(ipAddressDetector, "host 192.168.0.1 up")).toEqual(["192.168.0.1"]);
  });

  it("rejects bad octets, leading zeros, and a v prefix", () => {
    expect(values(ipAddressDetector, "256.1.1.1")).toEqual([]);
    expect(values(ipAddressDetector, "192.168.001.1")).toEqual([]);
    expect(values(ipAddressDetector, "v1.2.3.4")).toEqual([]);
  });

  it("still matches a version string that is four plain octets", () => {
    expect(values(ipAddressDetector, "version 1.2.3.4")).toEqual(["1.2.3.4"]);
  });
});
