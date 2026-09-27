export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

type PublicEnv = Record<string, unknown>;

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function getSupabaseConfig(env: PublicEnv = import.meta.env as PublicEnv): SupabaseConfig {
  const url = requiredString(env.VITE_SUPABASE_URL);
  const anonKey =
    requiredString(env.VITE_SUPABASE_ANON_KEY) ??
    requiredString(env.VITE_SUPABASE_PUBLISHABLE_KEY);

  if (!url || !anonKey) {
    throw new Error("Cloud service configuration is unavailable.");
  }

  return { url, anonKey };
}
