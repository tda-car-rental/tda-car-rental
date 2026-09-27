import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const migrationPattern = /^(?<sequence>\d{6})_(?<date>\d{8})-(?<time>\d{4})_(?<purpose>[a-z0-9_]+)\.sql$/;

export function parseMigrationName(name) {
  const match = migrationPattern.exec(name);
  if (!match?.groups) throw new Error(`Invalid migration filename: ${name}`);

  const sequence = Number(match.groups.sequence);
  const month = Number(match.groups.date.slice(0, 2));
  const day = Number(match.groups.date.slice(2, 4));
  const year = Number(match.groups.date.slice(4, 8));
  const hour = Number(match.groups.time.slice(0, 2));
  const minute = Number(match.groups.time.slice(2, 4));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    throw new Error(`Invalid migration filename: ${name}`);
  }

  return { sequence, date: match.groups.date, time: match.groups.time, purpose: match.groups.purpose };
}

export function validateMigrationNames(names) {
  const parsed = names.map(parseMigrationName).sort((left, right) => left.sequence - right.sequence);
  for (let index = 1; index < parsed.length; index += 1) {
    if (parsed[index].sequence <= parsed[index - 1].sequence) {
      throw new Error("Migration sequence numbers must be unique and increasing");
    }
  }
  return parsed;
}

function trackedMigrationNames(root) {
  try {
    const output = execFileSync("git", ["ls-files", "supabase/migrations/*.sql"], {
      cwd: root,
      encoding: "utf8",
    });
    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((path) => path.slice(path.lastIndexOf("/") + 1));
  } catch {
    return [];
  }
}

function changedTrackedMigrations(root) {
  const changed = new Set();
  for (const args of [
    ["diff", "--name-only", "--diff-filter=MD", "HEAD", "--", "supabase/migrations"],
    ["diff", "--cached", "--name-only", "--diff-filter=MD", "--", "supabase/migrations"],
  ]) {
    const output = execFileSync("git", args, { cwd: root, encoding: "utf8" });
    for (const path of output.split(/\r?\n/).filter(Boolean)) changed.add(path);
  }
  return [...changed];
}

export function verifyMigrations(root = process.cwd()) {
  const directory = resolve(root, "supabase", "migrations");
  if (!existsSync(directory)) return { migrations: [], changed: [] };

  const names = readdirSync(directory).filter((name) => name.endsWith(".sql"));
  const parsed = validateMigrationNames(names);
  const tracked = new Set(trackedMigrationNames(root));
  const changed = changedTrackedMigrations(root).filter((path) => path.endsWith(".sql"));
  if (changed.length > 0) {
    throw new Error(`Existing SQL migrations are immutable: ${changed.join(", ")}`);
  }
  for (const name of names) {
    if (readFileSync(join(directory, name), "utf8").includes("<<<<<<<")) {
      throw new Error(`Merge conflict markers found in migration: ${name}`);
    }
    if (tracked.has(name) && !existsSync(join(directory, name))) {
      throw new Error(`Tracked migration is missing: ${name}`);
    }
  }
  return { migrations: parsed, changed };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(dirname(process.argv[1]), "verify-supabase-migrations.mjs")) {
  const result = verifyMigrations(process.cwd());
  console.log(`Verified ${result.migrations.length} immutable Supabase migration(s).`);
}
