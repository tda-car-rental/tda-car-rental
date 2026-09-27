import { describe, expect, it } from "vitest";
import { parseMigrationName, validateMigrationNames } from "../../../../scripts/verify-supabase-migrations.mjs";

describe("Supabase migration names", () => {
  it("parses the required sequence/date/time/purpose format", () => {
    expect(parseMigrationName("000001_09272026-2025_extensions_and_enums.sql")).toEqual({
      sequence: 1,
      date: "09272026",
      time: "2025",
      purpose: "extensions_and_enums",
    });
  });

  it("rejects names without a six-digit sequence and creation timestamp", () => {
    expect(() => parseMigrationName("1_extensions.sql")).toThrow("Invalid migration filename");
  });

  it("requires strictly increasing unique sequence numbers", () => {
    expect(() =>
      validateMigrationNames([
        "000001_09272026-2025_first.sql",
        "000001_09272026-2026_duplicate.sql",
      ]),
    ).toThrow("Migration sequence numbers must be unique and increasing");
  });
});
