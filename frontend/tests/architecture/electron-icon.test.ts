// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspace = process.cwd();

describe("Electron app icon wiring", () => {
  it("uses logo.png for packaging and packaged/development BrowserWindows", () => {
    const builderConfig = readFileSync(resolve(workspace, "electron-builder.yml"), "utf8");
    const mainSource = readFileSync(resolve(workspace, "src/electron/main.ts"), "utf8");

    expect(builderConfig).toContain("icon: src/electron/static/logo.png");
    expect(builderConfig).toContain("deleteAppDataOnUninstall: false");
    expect(builderConfig).not.toContain("deleteAppData: false");
    expect(mainSource).toContain('join(process.resourcesPath, "electron-static", "logo.png")');
    expect(mainSource).toContain('join(currentDir, "../src/electron/static/logo.png")');
    expect(mainSource).toContain("icon: appIconPath()");
  });
});
