import { DetectorRegistry } from "./detection/DetectorRegistry";
import { DeidentificationInputError } from "./errors";
import { resolveSpans } from "./replacement/SpanResolver";
import { redactText } from "./replacement/TextRedactor";
import { MAX_TEXT_LENGTH, type DeidentifyOptions, type DeidentifyResult } from "./types";

export class DeidentificationService {
  private readonly registry = new DetectorRegistry();

  deidentify(text: string, options?: DeidentifyOptions): DeidentifyResult {
    if (typeof text !== "string") {
      throw new DeidentificationInputError("text must be a string", this.registry.knownTypes());
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new DeidentificationInputError(
        `text cannot be longer than ${MAX_TEXT_LENGTH} characters`,
        this.registry.knownTypes(),
      );
    }

    // Detect on the original string, drop overlaps, then rebuild once.
    const detectors = this.registry.resolve(options?.entities);
    const spans = detectors.flatMap((detector) => detector.detect(text));
    return redactText(text, resolveSpans(spans, text.length));
  }
}
