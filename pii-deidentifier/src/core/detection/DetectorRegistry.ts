import { DeidentificationInputError } from "../errors";
import { DEFAULT_ENTITIES } from "../types";
import type { EntityDetector } from "./EntityDetector";
import { creditCardDetector } from "./detectors/creditCard.detector";
import { dobDetector } from "./detectors/dob.detector";
import { emailDetector } from "./detectors/email.detector";
import { ipAddressDetector } from "./detectors/ipAddress.detector";
import { phoneDetector } from "./detectors/phone.detector";
import { ssnDetector } from "./detectors/ssn.detector";

const DETECTORS: EntityDetector[] = [
  emailDetector,
  phoneDetector,
  ssnDetector,
  dobDetector,
  creditCardDetector,
  ipAddressDetector,
];

export class DetectorRegistry {
  private readonly detectors = new Map(DETECTORS.map((detector) => [detector.type, detector]));

  knownTypes(): string[] {
    return [...this.detectors.keys()];
  }

  // Omitted means the defaults. An empty list means the caller chose nothing.
  // Names are exact: "email" and "DOB" are rejected, not guessed.
  resolve(requested?: unknown): EntityDetector[] {
    if (requested === undefined) return this.lookup(DEFAULT_ENTITIES);

    if (!Array.isArray(requested) || requested.some((name) => typeof name !== "string" || name === "")) {
      throw new DeidentificationInputError("entities must be an array of entity names", this.knownTypes());
    }
    return this.lookup(new Set(requested as string[]));
  }

  private lookup(names: Iterable<string>): EntityDetector[] {
    return [...names].map((name) => {
      const detector = this.detectors.get(name);
      if (!detector) {
        throw new DeidentificationInputError(`Unknown entity type: ${name}`, this.knownTypes());
      }
      return detector;
    });
  }
}
