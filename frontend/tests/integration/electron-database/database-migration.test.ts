// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DatabaseSync } from "node:sqlite";
import { MigrationRunner, type Migration } from "@/electron/main/database-migration";

const tempDirectories: string[] = [];

function temporaryDatabaseFile() {
  const directory = mkdtempSync(join(tmpdir(), "tda-electron-migration-"));
  tempDirectories.push(directory);
  return join(directory, "test.sqlite");
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("MigrationRunner", () => {
  function createRunner(file: string) {
    const database = new DatabaseSync(file);
    return { database, runner: new MigrationRunner(database) };
  }

  it("creates the schema_migrations table", () => {
    const file = temporaryDatabaseFile();
    const { runner, database } = createRunner(file);

    runner.run([]);

    const columns = database.prepare("PRAGMA table_info(schema_migrations)").all() as Array<{
      name: string;
    }>;
    expect(columns.map((column) => column.name)).toContain("version");
    expect(columns.map((column) => column.name)).toContain("name");
    expect(columns.map((column) => column.name)).toContain("applied_at");
    database.close();
  });

  it("applies pending migrations and records them", () => {
    const file = temporaryDatabaseFile();
    const { runner, database } = createRunner(file);

    const migrations: Migration[] = [
      {
        version: 1,
        name: "create-docs",
        up(db: DatabaseSync) {
          db.exec("CREATE TABLE docs (id INTEGER PRIMARY KEY)");
        },
      },
    ];

    runner.run(migrations);

    const docs = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='docs'")
      .get() as { name: string } | undefined;
    expect(docs).toBeTruthy();

    const applied = database.prepare("SELECT version, name FROM schema_migrations").all() as Array<{
      version: number;
      name: string;
    }>;
    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({ version: 1, name: "create-docs" });
    database.close();
  });

  it("skips already-applied migrations", () => {
    const file = temporaryDatabaseFile();
    const { runner, database } = createRunner(file);

    const migrations: Migration[] = [
      {
        version: 1,
        name: "create-docs",
        up(db: DatabaseSync) {
          db.exec("CREATE TABLE docs (id INTEGER PRIMARY KEY)");
        },
      },
      {
        version: 2,
        name: "add-name-column",
        up(db: DatabaseSync) {
          db.exec("ALTER TABLE docs ADD COLUMN name TEXT");
        },
      },
    ];

    runner.run(migrations);
    runner.run(migrations);

    const applied = database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{
      version: number;
    }>;
    expect(applied).toHaveLength(2);
    expect(applied.map((row) => row.version)).toEqual([1, 2]);
    database.close();
  });

  it("applies only newer migrations after a partial run", () => {
    const file = temporaryDatabaseFile();
    const { runner, database } = createRunner(file);

    const v1: Migration = {
      version: 1,
      name: "create-docs",
      up(db: DatabaseSync) {
        db.exec("CREATE TABLE docs (id INTEGER PRIMARY KEY)");
      },
    };

    const v2: Migration = {
      version: 2,
      name: "add-name-column",
      up(db: DatabaseSync) {
        db.exec("ALTER TABLE docs ADD COLUMN name TEXT");
      },
    };

    runner.run([v1]);
    runner.run([v1, v2]);

    const applied = database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{
      version: number;
    }>;
    expect(applied).toHaveLength(2);
    expect(applied.map((row) => row.version)).toEqual([1, 2]);
    database.close();
  });

  it("wraps all migrations in a single transaction", () => {
    const file = temporaryDatabaseFile();
    const { runner, database } = createRunner(file);

    const migrations: Migration[] = [
      {
        version: 1,
        name: "failing-migration",
        up(db: DatabaseSync) {
          db.exec("CREATE TABLE docs (id INTEGER PRIMARY KEY)");
          throw new Error("rollback me");
        },
      },
    ];

    expect(() => runner.run(migrations)).toThrow("rollback me");

    const applied = database.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as {
      count: number;
    };
    expect(applied.count).toBe(0);

    const docs = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='docs'")
      .get() as { name: string } | undefined;
    expect(docs).toBeUndefined();
    database.close();
  });
});
