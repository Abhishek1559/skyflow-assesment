// Thrown for bad input. The HTTP layer turns this into a 400.
// The library throws the same error when there is no Express in front of it.
export class DeidentificationInputError extends Error {
  readonly validEntities: readonly string[];

  constructor(message: string, validEntities: readonly string[]) {
    super(message);
    this.name = "DeidentificationInputError";
    this.validEntities = validEntities;
  }
}
