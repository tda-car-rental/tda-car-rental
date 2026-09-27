import { describe, expect, it } from "vitest";
import { getSupabaseConfig } from "@/lib/config";

describe("getSupabaseConfig", () => {
  it("returns the public Supabase configuration when both values are present", () => {
    expect(
      getSupabaseConfig({
        VITE_SUPABASE_URL: "https://tda.example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "public-anon-key",
      }),
    ).toEqual({
      url: "https://tda.example.supabase.co",
      anonKey: "public-anon-key",
    });
  });

  it("accepts the modern publishable key name", () => {
    expect(
      getSupabaseConfig({
        VITE_SUPABASE_URL: "https://tda.example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable-key",
      }),
    ).toEqual({
      url: "https://tda.example.supabase.co",
      anonKey: "sb_publishable-key",
    });
  });

  it("rejects incomplete configuration without exposing secret names in the error", () => {
    expect(() => getSupabaseConfig({ VITE_SUPABASE_URL: "" })).toThrow(
      "Cloud service configuration is unavailable.",
    );
  });
});
