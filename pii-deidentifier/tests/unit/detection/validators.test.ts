import { describe, expect, it } from "vitest";
import {
  isKnownCardIin,
  isPlausibleCard,
  isPlausibleEmail,
  isPlausiblePhone,
  isPlausibleSsn,
  isRecognizedDob,
  isValidIpv4,
  passesLuhn,
} from "../../../src/core/detection/validators";

describe("Luhn and card prefixes", () => {
  it("accepts the usual test cards", () => {
    expect(passesLuhn("4111111111111111")).toBe(true);
    expect(passesLuhn("5500000000000004")).toBe(true);
    expect(passesLuhn("378282246310005")).toBe(true);
    expect(passesLuhn("6011111111111117")).toBe(true);
    expect(passesLuhn("4532015112830366")).toBe(true);
  });

  it("rejects a card that fails the checksum", () => {
    expect(passesLuhn("4111111111111112")).toBe(false);
  });

  it("rejects sixteen zeros even though the Luhn sum is 0", () => {
    expect(passesLuhn("0000000000000000")).toBe(true);
    expect(isPlausibleCard("0000000000000000")).toBe(false);
  });

  it("knows the common issuer ranges", () => {
    expect(isKnownCardIin("4111111111111111")).toBe(true);
    expect(isKnownCardIin("2221000000000000")).toBe(true);
    expect(isKnownCardIin("2720000000000000")).toBe(true);
    expect(isKnownCardIin("2220000000000000")).toBe(false);
    expect(isKnownCardIin("2721000000000000")).toBe(false);
    expect(isKnownCardIin("378282246310005")).toBe(true);
    expect(isKnownCardIin("6011111111111117")).toBe(true);
    expect(isKnownCardIin("7111111111111111")).toBe(false);
  });

  it("accepts a 19-digit Visa and rejects lengths Visa does not issue", () => {
    expect(isPlausibleCard("4111111111111111003")).toBe(true);
    expect(isKnownCardIin("41111111111111")).toBe(false);
    expect(isKnownCardIin("41111111111111111")).toBe(false);
  });
});

describe("phone numbering plans", () => {
  it("accepts a valid NANP number and a valid country code", () => {
    expect(isPlausiblePhone("415-555-0134")).toBe(true);
    expect(isPlausiblePhone("+1-415-555-0134")).toBe(true);
    expect(isPlausiblePhone("+14155550134")).toBe(true);
    expect(isPlausiblePhone("+91-415-555-0134")).toBe(true);
    expect(isPlausiblePhone("+44 (0)20 7946 0958")).toBe(true);
    expect(isPlausiblePhone("0044 20 7946 0958")).toBe(true);
    expect(isPlausiblePhone("00491234567890123")).toBe(true);
  });

  it("rejects an amount, an unassigned code, and an impossible area code", () => {
    expect(isPlausiblePhone("+1500000")).toBe(false);
    expect(isPlausiblePhone("+89-415-555-0134")).toBe(false);
    expect(isPlausiblePhone("123-456-7890")).toBe(false);
    expect(isPlausiblePhone("415-055-0134")).toBe(false);
  });
});

describe("SSN allocation rules", () => {
  it("accepts a well-formed number", () => {
    expect(isPlausibleSsn("123-45-6789")).toBe(true);
  });

  it("rejects area, group, and serial numbers that were never issued", () => {
    expect(isPlausibleSsn("000-12-3456")).toBe(false);
    expect(isPlausibleSsn("666-12-3456")).toBe(false);
    expect(isPlausibleSsn("900-12-3456")).toBe(false);
    expect(isPlausibleSsn("123-00-6789")).toBe(false);
    expect(isPlausibleSsn("123-45-0000")).toBe(false);
  });
});

describe("IPv4 octets", () => {
  it("accepts ordinary addresses, including a single zero", () => {
    expect(isValidIpv4("192.168.0.1")).toBe(true);
    expect(isValidIpv4("0.0.0.0")).toBe(true);
  });

  it("rejects out of range octets and leading zeros", () => {
    expect(isValidIpv4("256.1.1.1")).toBe(false);
    expect(isValidIpv4("192.168.001.1")).toBe(false);
  });
});

describe("email shape", () => {
  it("accepts a normal address and a plus-tag", () => {
    expect(isPlausibleEmail("john.doe@example.com")).toBe(true);
    expect(isPlausibleEmail("user+tag@example.co.uk")).toBe(true);
  });

  it("rejects empty labels and doubled dots", () => {
    expect(isPlausibleEmail("john..doe@example.com")).toBe(false);
    expect(isPlausibleEmail(".john@example.com")).toBe(false);
    expect(isPlausibleEmail("john@example..com")).toBe(false);
    expect(isPlausibleEmail("john@.example.com")).toBe(false);
  });
});

describe("dates of birth", () => {
  const today = new Date(2026, 10, 17);

  it("accepts real dates in the three formats we scan for", () => {
    expect(isRecognizedDob("1990-05-12", today)).toBe(true);
    expect(isRecognizedDob("05/12/1990", today)).toBe(true);
    expect(isRecognizedDob("May 12, 1990", today)).toBe(true);
    expect(isRecognizedDob("2000-02-29", today)).toBe(true);
  });

  it("rejects impossible days, future years, and day/month order", () => {
    expect(isRecognizedDob("1990-02-30", today)).toBe(false);
    expect(isRecognizedDob("1990-02-29", today)).toBe(false);
    expect(isRecognizedDob("1899-01-01", today)).toBe(false);
    expect(isRecognizedDob("2099-01-01", today)).toBe(false);
    expect(isRecognizedDob("13/05/1990", today)).toBe(false);
  });
});
