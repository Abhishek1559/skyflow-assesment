import { describe, expect, it } from "vitest";
import { DeidentificationService } from "../../src/core/DeidentificationService";
import { DeidentificationInputError } from "../../src/core/errors";
import { DEFAULT_ENTITIES, MAX_TEXT_LENGTH } from "../../src/core/types";

const service = new DeidentificationService();

const SAMPLE =
  "Patient John Doe can be contacted at john.doe@example.com or +1-415-555-0134. DOB: 1990-05-12.";

describe("DeidentificationService", () => {
  it("redacts the sample and leaves the person's name", () => {
    expect(service.deidentify(SAMPLE)).toEqual({
      deidentifiedText:
        "Patient John Doe can be contacted at [EMAIL] or [PHONE]. DOB: [DATE_OF_BIRTH].",
      entitiesDetected: {
        EMAIL: 1,
        PHONE: 1,
        DATE_OF_BIRTH: 1,
      },
    });
  });

  it("redacts only the entities the caller asked for", () => {
    const result = service.deidentify("Contact john.doe@example.com at +1-415-555-0134", {
      entities: ["EMAIL"],
    });

    expect(result.deidentifiedText).toBe("Contact [EMAIL] at +1-415-555-0134");
    expect(result.entitiesDetected).toEqual({ EMAIL: 1 });
  });

  it("treats an empty entity list as an explicit opt-out", () => {
    expect(service.deidentify(SAMPLE, { entities: [] })).toEqual({
      deidentifiedText: SAMPLE,
      entitiesDetected: {},
    });
  });

  it("returns empty and whitespace text unchanged", () => {
    expect(service.deidentify("")).toEqual({ deidentifiedText: "", entitiesDetected: {} });
    expect(service.deidentify("  \n").deidentifiedText).toBe("  \n");
  });

  it("keeps a card that is glued to a short digit prefix", () => {
    expect(service.deidentify("ref 99-4111111111111111").deidentifiedText).toBe(
      "ref 99-[CREDIT_CARD]",
    );
  });

  it("counts repeated entities and does not redact an unlabeled name", () => {
    const result = service.deidentify("a@b.co and c@d.co for John Doe");
    expect(result.deidentifiedText).toBe("[EMAIL] and [EMAIL] for John Doe");
    expect(result.entitiesDetected).toEqual({ EMAIL: 2 });
  });

  it("leaves a labeled name in the text", () => {
    const text = "Patient Name: John Doe can be reached at john.doe@example.com";

    expect(service.deidentify(text).deidentifiedText).toBe(
      "Patient Name: John Doe can be reached at [EMAIL]",
    );
    expect(() => service.deidentify(text, { entities: ["NAME"] })).toThrow(/Unknown entity type: NAME/);
  });

  it("keeps the whole address when a higher-priority value sits inside it", () => {
    expect(service.deidentify("Mail 123-45-6789@example.com").deidentifiedText).toBe("Mail [EMAIL]");
    expect(service.deidentify("Mail 4111111111111111@example.com").deidentifiedText).toBe("Mail [EMAIL]");
    expect(service.deidentify("Mail o'brien@example.com and a#b@example.com").deidentifiedText).toBe(
      "Mail [EMAIL] and [EMAIL]",
    );
  });

});

describe("input validation", () => {
  it("rejects every non-string text, and names the problem", () => {
    for (const bad of [null, undefined, 42, true, {}, [], ["a@b.co"]]) {
      expect(() => service.deidentify(bad as unknown as string)).toThrow(DeidentificationInputError);
      expect(() => service.deidentify(bad as unknown as string)).toThrow(/text must be a string/);
    }
  });

  it("rejects an entities value that is not a list of names", () => {
    for (const bad of [null, "EMAIL", 7, {}]) {
      expect(() => service.deidentify("x", { entities: bad as unknown as string[] })).toThrow(/array/);
    }
    for (const bad of [[1], [null], [""], [["EMAIL"]]]) {
      expect(() => service.deidentify("x", { entities: bad as unknown as string[] })).toThrow(/entity names/);
    }
  });

  it("does not accept a lower case name or an object key as an entity", () => {
    expect(() => service.deidentify("a@b.co", { entities: ["email"] })).toThrow(/Unknown entity type: email/);
    expect(() => service.deidentify("x", { entities: ["constructor"] })).toThrow(/Unknown entity type/);
    expect(() => service.deidentify("x", { entities: ["__proto__"] })).toThrow(/Unknown entity type/);
  });

  it("lists the valid types on the error, so a typo is easy to fix", () => {
    try {
      service.deidentify("x", { entities: ["EMIAL"] });
      throw new Error("expected a rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(DeidentificationInputError);
      expect((error as DeidentificationInputError).validEntities).toEqual([
        "EMAIL",
        "PHONE",
        "SSN",
        "DATE_OF_BIRTH",
        "CREDIT_CARD",
        "IP_ADDRESS",
      ]);
    }
  });

  it("accepts text of exactly the limit and rejects one character more", () => {
    expect(service.deidentify("a".repeat(MAX_TEXT_LENGTH)).entitiesDetected).toEqual({});
    expect(() => service.deidentify("a".repeat(MAX_TEXT_LENGTH + 1))).toThrow(/longer than/);
  });
});

describe("overlapping rules, end to end", () => {
  it("gives a hyphenated card one placeholder, with nothing left over", () => {
    const result = service.deidentify("Card 4532-0151-1283-0366 on file");
    expect(result.deidentifiedText).toBe("Card [CREDIT_CARD] on file");
    expect(result.entitiesDetected).toEqual({ CREDIT_CARD: 1 });
  });

  it("calls a dashed 3-2-4 number an SSN, never a phone", () => {
    const result = service.deidentify("SSN 123-45-6789");
    expect(result.deidentifiedText).toBe("SSN [SSN]");
    expect(result.entitiesDetected).toEqual({ SSN: 1 });
  });

  it("leaves a date under DOB: to the date rule, not the phone rule", () => {
    const result = service.deidentify("DOB: 1990-05-12");
    expect(result.entitiesDetected).toEqual({ DATE_OF_BIRTH: 1 });
  });

  it("does not turn dates, years, or a bare 10-digit id into anything", () => {
    for (const text of ["10.12.2024", "2019-2024", "order 4155550134", "1990-05-12", "ISBN 978-3-16-148410-0"]) {
      expect(service.deidentify(text)).toEqual({ deidentifiedText: text, entitiesDetected: {} });
    }
  });

  it("leaves an amount and keeps a 19-digit card in one piece", () => {
    const text =
      "John Doe paid +1500000 with card 4111 1111 1111 1111 003 and can be contacted at john.doe@example.com or +91-415-555-0134. DOB: 1990-05-12.";

    expect(service.deidentify(text, { entities: ["EMAIL", "PHONE", "DATE_OF_BIRTH", "CREDIT_CARD"] })).toEqual({
      deidentifiedText:
        "John Doe paid +1500000 with card [CREDIT_CARD] and can be contacted at [EMAIL] or [PHONE]. DOB: [DATE_OF_BIRTH].",
      entitiesDetected: { CREDIT_CARD: 1, EMAIL: 1, PHONE: 1, DATE_OF_BIRTH: 1 },
    });
  });

  it("replaces a 19-digit card once, not as a 16-digit card plus a leftover group", () => {
    for (const card of ["4111 1111 1111 1111 003", "4111-1111-1111-1111-003"]) {
      expect(service.deidentify(`Card ${card} ok`)).toEqual({
        deidentifiedText: "Card [CREDIT_CARD] ok",
        entitiesDetected: { CREDIT_CARD: 1 },
      });
    }
  });

  it("finds a card that sits after a 4-digit group, in a full pass", () => {
    expect(service.deidentify("Expires 2024 4111 1111 1111 1111").deidentifiedText).toBe(
      "Expires 2024 [CREDIT_CARD]",
    );
  });

  it("handles every default entity in one text", () => {
    const text = [
      "Email: ada@example.com",
      "Phone: +44 20 7946 0958",
      "SSN: 123-45-6789",
      "DOB: 12 May 1990",
      "Card: 4111 1111 1111 1111",
      "IP: 192.168.0.1",
    ].join("\n");

    expect(service.deidentify(text)).toEqual({
      deidentifiedText: [
        "Email: [EMAIL]",
        "Phone: [PHONE]",
        "SSN: [SSN]",
        "DOB: [DATE_OF_BIRTH]",
        "Card: [CREDIT_CARD]",
        "IP: [IP_ADDRESS]",
      ].join("\n"),
      entitiesDetected: { EMAIL: 1, PHONE: 1, SSN: 1, DATE_OF_BIRTH: 1, CREDIT_CARD: 1, IP_ADDRESS: 1 },
    });
  });

  it("counts every occurrence of the same type, in different formats", () => {
    const result = service.deidentify("Call 415-555-0134, (415) 555-0135, or +1 415 555 0136.");
    expect(result.deidentifiedText).toBe("Call [PHONE], [PHONE], or [PHONE].");
    expect(result.entitiesDetected).toEqual({ PHONE: 3 });
  });

  it("reports counts that match the placeholders in the output", () => {
    const text = "a@b.co, c@d.co, 192.168.0.1, 10.0.0.1, 123-45-6789, DOB: 1990-05-12";
    const { deidentifiedText, entitiesDetected } = service.deidentify(text);

    for (const [type, count] of Object.entries(entitiesDetected)) {
      expect(deidentifiedText.split(`[${type}]`).length - 1).toBe(count);
    }
    expect(Object.values(entitiesDetected).every((count) => count > 0)).toBe(true);
  });

  it("does not match inside a placeholder that was already in the input", () => {
    const result = service.deidentify("I wrote [EMAIL] and [PHONE] here");
    expect(result).toEqual({ deidentifiedText: "I wrote [EMAIL] and [PHONE] here", entitiesDetected: {} });
  });

  it("gives the same answer twice, so no regex state leaks between calls", () => {
    const first = service.deidentify(SAMPLE);
    const second = service.deidentify(SAMPLE);
    expect(second).toEqual(first);
  });
});

describe("text that must come through unchanged", () => {
  it("keeps emoji, accents, and CJK around an address", () => {
    const text = "café 😊 john@ex.com 日本語 +1-415-555-0134 ✅";
    expect(service.deidentify(text).deidentifiedText).toBe("café 😊 [EMAIL] 日本語 [PHONE] ✅");
  });

  it("keeps Chinese and Thai that touch an address", () => {
    expect(service.deidentify("联系john@example.com谢谢").deidentifiedText).toBe("联系[EMAIL]谢谢");
    expect(service.deidentify("อีเมลjohn@example.comขอบคุณ").deidentifiedText).toBe("อีเมล[EMAIL]ขอบคุณ");
  });

  it("keeps emoji that touch an address", () => {
    expect(service.deidentify("😊john@example.com😊").deidentifiedText).toBe("😊[EMAIL]😊");
  });

  it("keeps LF, CRLF, tabs, and blank lines", () => {
    const text = "a@b.co\r\n\r\n\t415-555-0134\n\n";
    expect(service.deidentify(text).deidentifiedText).toBe("[EMAIL]\r\n\r\n\t[PHONE]\n\n");
  });

  it("keeps punctuation that touches a value", () => {
    expect(service.deidentify("(a@b.co), \"c@d.co\"; <192.168.0.1>!").deidentifiedText).toBe(
      "([EMAIL]), \"[EMAIL]\"; <[IP_ADDRESS]>!",
    );
  });

  it("does not normalize or trim", () => {
    const text = "  cafe\u0301   \n";
    expect(service.deidentify(text).deidentifiedText).toBe(text);
  });

  it("copes with a lone surrogate and a NUL byte", () => {
    expect(service.deidentify("\ud800 a@b.co \udc00").deidentifiedText).toBe("\ud800 [EMAIL] \udc00");
    expect(service.deidentify("a\u0000b a@b.co").deidentifiedText).toBe("a\u0000b [EMAIL]");
  });
});

describe("worst-case input", () => {
  // These are shapes that make a careless regex take quadratic or exponential time.
  // The limit is far above what a linear scan needs. Hitting it means a pattern got worse.
  const LIMIT_MS = 1500;

  function timed(text: string): number {
    const started = performance.now();
    service.deidentify(text.slice(0, MAX_TEXT_LENGTH), { entities: [...DEFAULT_ENTITIES] });
    return performance.now() - started;
  }

  it.each([
    ["one long local part", "a".repeat(MAX_TEXT_LENGTH - 1) + "@"],
    ["dotted local part", "a.".repeat(50_000) + "@x"],
    ["long domain", "x@" + "a".repeat(99_990)],
    ["dotted domain", "x@" + "a.".repeat(49_990)],
    ["label then spaces", "DOB" + " ".repeat(99_990)],
    ["label then digits", "DOB: " + "1".repeat(99_990)],
    ["repeated labels", "DOB ".repeat(25_000)],
    ["plus and single digits", "+1" + " 1".repeat(49_000)],
    ["groups of four", "1111 ".repeat(20_000)],
    ["hyphenated groups", "1234-".repeat(20_000)],
    ["dotted digits", "1.2.3.".repeat(16_000)],
    ["partial SSNs", "123-45-".repeat(14_000)],
    ["unicode letters", "é".repeat(MAX_TEXT_LENGTH)],
  ])("stays fast on %s", (_name, text) => {
    expect(timed(text)).toBeLessThan(LIMIT_MS);
  });

  it("handles thousands of real matches in one text", () => {
    const text = "a@b.co 415-555-0134 4111 1111 1111 1111 192.168.0.1 ".repeat(1_900);
    const started = performance.now();
    const result = service.deidentify(text);
    expect(performance.now() - started).toBeLessThan(LIMIT_MS);
    expect(result.entitiesDetected).toEqual({ EMAIL: 1_900, PHONE: 1_900, CREDIT_CARD: 1_900, IP_ADDRESS: 1_900 });
  });
});
