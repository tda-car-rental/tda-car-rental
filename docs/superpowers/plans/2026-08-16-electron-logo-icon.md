# Electron Logo Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use `src/electron/static/logo.png` as the canonical icon for the exported Windows app and its packaged Electron windows.

**Architecture:** electron-builder will read the canonical PNG directly from `src/electron/static`. The Electron main process will resolve that same file from the packaged `electron-static` resources directory when packaged and from the source tree during development, then reuse the resolved path for both BrowserWindows.

**Tech Stack:** Electron 43, electron-builder 26, TypeScript, Vitest, YAML.

## Global Constraints

- Keep `src/electron/static/logo.png` as the single icon source.
- Preserve the existing web favicon reference and unrelated working-tree changes.
- Do not add image conversion or generated icon files.
- Verify with the focused architecture test, full test suite, lint, and Electron build.

---

### Task 1: Add the failing icon architecture test

**Files:**
- Create: `tests/architecture/electron-icon.test.ts`

**Interfaces:**
- Consumes: `electron-builder.yml` and `src/electron/main.ts` as text fixtures.
- Produces: Regression coverage for the canonical builder icon and packaged/development runtime icon paths.

- [ ] **Step 1: Write the failing test**

```ts
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
    expect(mainSource).toContain('join(process.resourcesPath, "electron-static", "logo.png")');
    expect(mainSource).toContain('join(currentDir, "../src/electron/static/logo.png")');
    expect(mainSource).toContain("icon: appIconPath()");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/architecture/electron-icon.test.ts`

Expected: FAIL because the builder currently references `public/icon.png` and the main process has no packaged/source `logo.png` resolver.

### Task 2: Wire the canonical logo into export and Electron windows

**Files:**
- Modify: `electron-builder.yml:3`
- Modify: `src/electron/main.ts` near `staticPath()` and both `BrowserWindow` definitions

**Interfaces:**
- Consumes: The failing assertions from Task 1.
- Produces: `appIconPath(): string`, used by the main and migration windows and backed by the packaged/source `logo.png` paths.

- [ ] **Step 1: Point electron-builder at the canonical logo**

Change the builder configuration to:

```yaml
icon: src/electron/static/logo.png
```

- [ ] **Step 2: Keep the NSIS configuration valid for electron-builder 26**

Rename the obsolete option while preserving its existing `false` value:

```yaml
deleteAppDataOnUninstall: false
```

The electron-builder 26.15.3 schema rejects the former `deleteAppData` name and prevents any Windows export from starting.

- [ ] **Step 3: Add the packaged/development icon resolver**

Add this helper after `staticPath()`:

```ts
function appIconPath() {
  return app.isPackaged
    ? join(process.resourcesPath, "electron-static", "logo.png")
    : join(currentDir, "../src/electron/static/logo.png");
}
```

- [ ] **Step 4: Reuse the resolver for both windows**

Replace each existing `icon: join(currentDir, "../public/icon.png")` with:

```ts
icon: appIconPath(),
```

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `npx vitest run tests/architecture/electron-icon.test.ts`

Expected: PASS.

### Task 3: Run regression and export checks

**Files:**
- Modify: none

**Interfaces:**
- Consumes: The completed icon wiring from Task 2.
- Produces: Verified test, lint, and Electron build results.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: PASS with no test failures.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS with no lint errors.

- [ ] **Step 3: Build Electron artifacts**

Run: `npm run build:electron`

Expected: PASS, producing updated `dist-electron` artifacts without TypeScript errors.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff -- electron-builder.yml src/electron/main.ts tests/architecture/electron-icon.test.ts`

Expected: Only the canonical icon path, resolver, window references, and focused test are changed; existing user changes remain separate.
