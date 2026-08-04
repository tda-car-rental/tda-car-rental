# Electron Persistent Database Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Electron SQLite database in a stable branded app-data folder across reinstalls and migrate existing user data from the legacy profile folder once.

**Architecture:** Extract Electron document-storage path selection into a dedicated startup helper that resolves the branded app-data directory and performs a one-time file migration before `DocumentDatabase` opens the SQLite file. Keep database CRUD behavior unchanged and verify the migration logic with node-environment integration tests.

**Tech Stack:** Electron, TypeScript, Node `fs`/`path`, Vitest, native SQLite via `node:sqlite`.

## Global Constraints

- Store the SQLite document database outside the install directory.
- Use a stable branded Electron storage folder instead of the current `tanstack_start_ts` profile.
- Migrate the legacy `tda-car-rental.sqlite` file only when the new database file does not already exist.
- Do not change the document schema or renderer save/update APIs.
- Follow TDD: write the failing test first and watch it fail before implementation.

---

### Task 1: Add failing tests for persistent path resolution

**Files:**
- Create: `tests/integration/electron-storage/storage-path.test.ts`

**Interfaces:**
- Consumes: `resolveDocumentDatabasePath(options: { appDataRoot: string; appName?: string; legacyAppName?: string; databaseFileName?: string }): string`
- Produces: coverage for branded profile path resolution and one-time legacy migration behavior

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirectories: string[] = [];

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "tda-electron-storage-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("resolveDocumentDatabasePath", () => {
  it("uses the branded Electron profile directory", async () => {
    const module = await import("@/electron/main/storage-path").catch(() => undefined);
    expect(module?.resolveDocumentDatabasePath).toBeTypeOf("function");
    if (!module) return;

    const appDataRoot = temporaryDirectory();
    const file = module.resolveDocumentDatabasePath({ appDataRoot });

    expect(file).toBe(join(appDataRoot, "TDA Car Rental", "tda-car-rental.sqlite"));
  });

  it("moves the legacy database into the branded directory once", async () => {
    const module = await import("@/electron/main/storage-path").catch(() => undefined);
    expect(module?.ensurePersistentDocumentDatabase).toBeTypeOf("function");
    if (!module) return;

    const appDataRoot = temporaryDirectory();
    const legacyDirectory = join(appDataRoot, "tanstack_start_ts");
    const brandedDirectory = join(appDataRoot, "TDA Car Rental");
    const legacyFile = join(legacyDirectory, "tda-car-rental.sqlite");
    writeFileSync(legacyFile, "legacy");

    const file = module.ensurePersistentDocumentDatabase({ appDataRoot });

    expect(file).toBe(join(brandedDirectory, "tda-car-rental.sqlite"));
    expect(existsSync(file)).toBe(true);
    expect(existsSync(legacyFile)).toBe(false);
  });

  it("keeps the branded database when both files exist", async () => {
    const module = await import("@/electron/main/storage-path").catch(() => undefined);
    expect(module?.ensurePersistentDocumentDatabase).toBeTypeOf("function");
    if (!module) return;

    const appDataRoot = temporaryDirectory();
    const legacyDirectory = join(appDataRoot, "tanstack_start_ts");
    const brandedDirectory = join(appDataRoot, "TDA Car Rental");
    const legacyFile = join(legacyDirectory, "tda-car-rental.sqlite");
    const brandedFile = join(brandedDirectory, "tda-car-rental.sqlite");
    writeFileSync(legacyFile, "legacy");
    writeFileSync(brandedFile, "current");

    const file = module.ensurePersistentDocumentDatabase({ appDataRoot });

    expect(file).toBe(brandedFile);
    expect(existsSync(brandedFile)).toBe(true);
    expect(existsSync(legacyFile)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/electron-storage/storage-path.test.ts`
Expected: FAIL because `@/electron/main/storage-path` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const APP_NAME = "TDA Car Rental";
const LEGACY_APP_NAME = "tanstack_start_ts";
const DATABASE_FILE_NAME = "tda-car-rental.sqlite";

export function resolveDocumentDatabasePath(options: {
  appDataRoot: string;
  appName?: string;
  legacyAppName?: string;
  databaseFileName?: string;
}) {
  const appName = options.appName ?? APP_NAME;
  const databaseFileName = options.databaseFileName ?? DATABASE_FILE_NAME;
  return join(options.appDataRoot, appName, databaseFileName);
}

export function ensurePersistentDocumentDatabase(options: {
  appDataRoot: string;
  appName?: string;
  legacyAppName?: string;
  databaseFileName?: string;
}) {
  const appName = options.appName ?? APP_NAME;
  const legacyAppName = options.legacyAppName ?? LEGACY_APP_NAME;
  const databaseFileName = options.databaseFileName ?? DATABASE_FILE_NAME;
  const brandedDirectory = join(options.appDataRoot, appName);
  const brandedFile = join(brandedDirectory, databaseFileName);
  const legacyFile = join(options.appDataRoot, legacyAppName, databaseFileName);

  mkdirSync(brandedDirectory, { recursive: true });
  if (!existsSync(brandedFile) && existsSync(legacyFile)) {
    cpSync(legacyFile, brandedFile);
  }
  return brandedFile;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/electron-storage/storage-path.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -- tests/integration/electron-storage/storage-path.test.ts src/electron/main/storage-path.ts
git commit -m "test: cover Electron database path migration"
```

### Task 2: Wire Electron startup to the persistent path helper

**Files:**
- Modify: `src/electron/main.ts`
- Modify: `src/electron/main/storage-path.ts`

**Interfaces:**
- Consumes: `ensurePersistentDocumentDatabase(options)`
- Produces: `DocumentDatabase` initialization against the branded persistent file path

- [ ] **Step 1: Write the failing test**

```ts
it("moves the legacy database instead of copying it", async () => {
  const module = await import("@/electron/main/storage-path").catch(() => undefined);
  expect(module?.ensurePersistentDocumentDatabase).toBeTypeOf("function");
  if (!module) return;

  const appDataRoot = temporaryDirectory();
  const legacyDirectory = join(appDataRoot, "tanstack_start_ts");
  const legacyFile = join(legacyDirectory, "tda-car-rental.sqlite");
  writeFileSync(legacyFile, "legacy");

  const brandedFile = module.ensurePersistentDocumentDatabase({ appDataRoot });

  expect(existsSync(brandedFile)).toBe(true);
  expect(existsSync(legacyFile)).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/electron-storage/storage-path.test.ts`
Expected: FAIL because the helper currently copies instead of moving the legacy file.

- [ ] **Step 3: Write minimal implementation**

```ts
import { existsSync, mkdirSync, renameSync } from "node:fs";

if (!existsSync(brandedFile) && existsSync(legacyFile)) {
  renameSync(legacyFile, brandedFile);
}
```

Update `src/electron/main.ts`:

```ts
import { ensurePersistentDocumentDatabase } from "./main/storage-path.js";

app.whenReady().then(async () => {
  const databaseFile = ensurePersistentDocumentDatabase({
    appDataRoot: app.getPath("appData"),
  });
  const database = new DocumentDatabase(databaseFile);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/electron-storage/storage-path.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -- src/electron/main.ts src/electron/main/storage-path.ts tests/integration/electron-storage/storage-path.test.ts
git commit -m "fix: persist Electron database across reinstalls"
```

### Task 3: Verify database behavior and packaged Electron build

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: persistent storage helper integrated into startup
- Produces: verified test/build evidence and updated developer note about the branded app-data folder

- [ ] **Step 1: Write the failing documentation test surrogate**

```md
The packaged application stores documents in `%APPDATA%/TDA Car Rental/tda-car-rental.sqlite`
and migrates an existing `%APPDATA%/tanstack_start_ts/tda-car-rental.sqlite` once on startup.
```

- [ ] **Step 2: Run verification commands**

Run: `npm test -- tests/integration/electron-storage/storage-path.test.ts tests/integration/electron-database/document-database.test.ts`
Expected: PASS

Run: `npm run build:electron`
Expected: PASS

- [ ] **Step 3: Write minimal documentation update**

```md
The packaged application stores documents in `%APPDATA%/TDA Car Rental/tda-car-rental.sqlite`.
If an older desktop build used `%APPDATA%/tanstack_start_ts/tda-car-rental.sqlite`, the app
moves that database into the branded folder on first launch.
```

- [ ] **Step 4: Run final verification**

Run: `npm run dist:win`
Expected: PASS and produce `release/TDA Car Rental Setup 1.0.1.exe`

- [ ] **Step 5: Commit**

```bash
git add -- README.md
git commit -m "docs: note Electron database storage path"
```
