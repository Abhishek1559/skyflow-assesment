import { describe, expect, it } from "vitest";
import { resolveSpans } from "../../../src/core/replacement/SpanResolver";
import { redactText } from "../../../src/core/replacement/TextRedactor";
import type { MatchSpan } from "../../../src/core/types";

function span(start: number, end: number, entityType: string, priority: number): MatchSpan {
  return { start, end, entityType, priority };
}

describe("resolveSpans", () => {
  it("keeps an address that fully contains a higher-priority span", () => {
    const email = span(0, 23, "EMAIL", 40);
    const ssn = span(0, 11, "SSN", 50);
    expect(resolveSpans([ssn, email], 23)).toEqual([email]);
  });

  it("keeps the higher priority when two spans partly overlap", () => {
    const phone = span(0, 18, "PHONE", 20);
    const card = span(3, 19, "CREDIT_CARD", 60);
    expect(resolveSpans([phone, card], 19)).toEqual([card]);
  });

  it("drops a phone span that sits inside a card", () => {
    const card = span(0, 19, "CREDIT_CARD", 60);
    const phone = span(5, 17, "PHONE", 20);
    expect(resolveSpans([phone, card], 19)).toEqual([card]);
  });

  it("prefers SSN when both rules cover the same characters", () => {
    const ssn = span(0, 11, "SSN", 50);
    const phone = span(0, 11, "PHONE", 20);
    expect(resolveSpans([phone, ssn], 11)).toEqual([ssn]);
  });

  it("keeps neighbors that only touch, in text order", () => {
    const first = span(0, 6, "EMAIL", 40);
    const second = span(6, 12, "EMAIL", 40);
    expect(resolveSpans([second, first], 12)).toEqual([first, second]);
  });

  it("collapses duplicate spans from two phone grammars", () => {
    const hit = span(0, 15, "PHONE", 20);
    expect(resolveSpans([hit, { ...hit }], 15)).toEqual([hit]);
  });
});

describe("redactText", () => {
  it("copies emoji and CRLF through untouched", () => {
    const text = "café 😊 john@ex.com\r\nnext";
    const start = text.indexOf("john@ex.com");
    const result = redactText(text, [span(start, start + "john@ex.com".length, "EMAIL", 40)]);

    expect(result.deidentifiedText).toBe("café 😊 [EMAIL]\r\nnext");
    expect(result.entitiesDetected).toEqual({ EMAIL: 1 });
  });

  it("returns the original text when there is nothing to replace", () => {
    expect(redactText("  \n", [])).toEqual({ deidentifiedText: "  \n", entitiesDetected: {} });
  });
});
