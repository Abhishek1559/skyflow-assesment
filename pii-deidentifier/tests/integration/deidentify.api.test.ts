import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/api/app";

const app = createApp();

const SAMPLE =
  "Patient John Doe can be contacted at john.doe@example.com or +1-415-555-0134. DOB: 1990-05-12.";

describe("POST /deidentify", () => {
  it("redacts the sample sentence", async () => {
    const response = await request(app).post("/deidentify").send({ text: SAMPLE });

    expect(response.status).toBe(200);
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.body).toEqual({
      deidentifiedText:
        "Patient John Doe can be contacted at [EMAIL] or [PHONE]. DOB: [DATE_OF_BIRTH].",
      entitiesDetected: {
        EMAIL: 1,
        PHONE: 1,
        DATE_OF_BIRTH: 1,
      },
    });
  });

  it("matches the request and response in the brief", async () => {
    const response = await request(app)
      .post("/deidentify")
      .send({ text: "Contact john.doe@example.com at +1-415-555-0134", entities: ["EMAIL", "PHONE"] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      deidentifiedText: "Contact [EMAIL] at [PHONE]",
      entitiesDetected: { EMAIL: 1, PHONE: 1 },
    });
  });

  it("honors a subset, an empty list, and an empty string", async () => {
    const emailOnly = await request(app)
      .post("/deidentify")
      .send({ text: "Contact john.doe@example.com at +1-415-555-0134", entities: ["EMAIL", "EMAIL"] });

    expect(emailOnly.status).toBe(200);
    expect(emailOnly.body.deidentifiedText).toBe("Contact [EMAIL] at +1-415-555-0134");

    const none = await request(app).post("/deidentify").send({ text: SAMPLE, entities: [] });
    expect(none.body.deidentifiedText).toBe(SAMPLE);
    expect(none.body.entitiesDetected).toEqual({});

    const empty = await request(app).post("/deidentify").send({ text: "" });
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ deidentifiedText: "", entitiesDetected: {} });
  });

  it("returns 400 for a missing text, a non-string, and an unknown entity", async () => {
    const missing = await request(app).post("/deidentify").send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error).toMatch(/text/);

    const number = await request(app).post("/deidentify").send({ text: 42 });
    expect(number.status).toBe(400);

    const typo = await request(app).post("/deidentify").send({ text: "hi", entities: ["EMIAL"] });
    expect(typo.status).toBe(400);
    expect(typo.body.error).toMatch(/EMIAL/);
    expect(typo.body.validEntities).toEqual([
      "EMAIL",
      "PHONE",
      "SSN",
      "DATE_OF_BIRTH",
      "CREDIT_CARD",
      "IP_ADDRESS",
    ]);
  });

});

describe("request limits and content types", () => {
  it("returns 413 for a body over 512 KB", async () => {
    const response = await request(app)
      .post("/deidentify")
      .send({ text: "a".repeat(600_000) });

    expect(response.status).toBe(413);
    expect(response.body.error).toMatch(/too large/);
  });

  it("returns 400 for text over the character limit but under the body limit", async () => {
    const response = await request(app)
      .post("/deidentify")
      .send({ text: "a".repeat(100_001) });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/longer than 100000/);
  });

  it("accepts text of exactly the character limit", async () => {
    const response = await request(app)
      .post("/deidentify")
      .send({ text: "a".repeat(100_000) });

    expect(response.status).toBe(200);
    expect(response.body.entitiesDetected).toEqual({});
  });

  it("accepts non-ASCII text under the character limit", async () => {
    const response = await request(app).post("/deidentify").send({ text: "日".repeat(40_000) });
    expect(response.status).toBe(200);
    expect(response.body.entitiesDetected).toEqual({});
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await request(app)
      .post("/deidentify")
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/valid JSON/);
  });

  it("returns 415 for a body that is not JSON", async () => {
    const response = await request(app)
      .post("/deidentify")
      .set("Content-Type", "text/plain")
      .send("a@b.co");

    expect(response.status).toBe(415);
    expect(response.body.error).toMatch(/application\/json/);
  });

  it("returns 400 when there is no body at all", async () => {
    const response = await request(app).post("/deidentify");
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/text/);
  });

  it("returns 400 for a body that is an array, and for null text", async () => {
    const array = await request(app).post("/deidentify").send([1, 2]);
    expect(array.status).toBe(400);
    expect(array.body.error).toMatch(/JSON object/);

    const nulled = await request(app).post("/deidentify").send({ text: null });
    expect(nulled.status).toBe(400);
    expect(nulled.body.error).toMatch(/text must be a string/);
  });

  it("returns 400 for entities that are null, a string, or hold a non-string", async () => {
    for (const entities of [null, "EMAIL", [1]]) {
      const response = await request(app).post("/deidentify").send({ text: "x", entities });
      expect(response.status).toBe(400);
    }
  });

  it("rejects a lower case entity name and says which names are valid", async () => {
    const response = await request(app).post("/deidentify").send({ text: "a@b.co", entities: ["email"] });
    expect(response.status).toBe(400);
    expect(response.body.validEntities).toContain("EMAIL");
  });

  it("ignores fields it does not know", async () => {
    const response = await request(app).post("/deidentify").send({ text: "a@b.co", extra: 1 });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deidentifiedText: "[EMAIL]", entitiesDetected: { EMAIL: 1 } });
  });

  it("does not echo the submitted text back in an error", async () => {
    const response = await request(app)
      .post("/deidentify")
      .send({ text: "secret 123-45-6789", entities: ["NOPE"] });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).not.toContain("123-45-6789");
  });
});

describe("unknown routes", () => {
  it("returns JSON, not an HTML page", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not found" });
  });

  it("does not treat a GET on /deidentify as a request to redact", async () => {
    const response = await request(app).get("/deidentify");
    expect(response.status).toBe(404);
  });
});
