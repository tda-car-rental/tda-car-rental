// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspace = process.cwd();

describe("Electron preload wiring", () => {
  it("uses a CommonJS preload artifact for sandboxed BrowserWindows", () => {
    const mainSource = readFileSync(resolve(workspace, "src/electron/main.ts"), "utf8");

    expect(mainSource).toContain('preload: join(currentDir, "preload.cjs")');
    expect(mainSource).toContain("sandbox: true");
  });
});
