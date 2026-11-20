import { createRegexDetector } from "../EntityDetector";
import { isValidIpv4 } from "../validators";

// Four groups of digits, and the validator checks 0-255 and leading zeros.
// The lookarounds make sure the four groups are the whole dotted run:
//   v1.2.3.4              no match (a letter touches the first digit)
//   1.2.3.4.5             no match (a fifth group would be left behind as ".5")
//   10.0.0.1.example.com  no match (looks like a hostname, not an address)
//   10.0.0.1:8080         match, the port stays
//   "from 10.0.0.1."      match, the sentence period stays
// "version 1.2.3.4" does match. That false positive is documented.
export const ipAddressDetector = createRegexDetector({
  type: "IP_ADDRESS",
  priority: 35,
  pattern: /(?<!\w)(?<!\w\.)(?:\d{1,3}\.){3}\d{1,3}(?!\w)(?!\.\w)/g,
  validate: isValidIpv4,
});
