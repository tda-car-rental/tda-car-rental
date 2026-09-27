import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

describe("frontend data boundary", () => {
  it("keeps renderer code free of direct Supabase queries and document IPC calls", () => {
    const violations = sourceFiles(sourceRoot)
      .filter((path) => !relative(sourceRoot, path).startsWith("electron\\main"))
      .filter((path) => /electronApi\(\)\.documents|\.from\s*\(\s*["']/.test(readFileSync(path, "utf8")))
      .map((path) => relative(sourceRoot, path));

    expect(violations).toEqual([]);
  });
});
