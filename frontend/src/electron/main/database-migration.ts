import { DatabaseSync } from "node:sqlite";

export type Migration = {
  version: number;
  name: string;
  up(database: DatabaseSync): void;
};

export class MigrationRunner {
  constructor(private readonly database: DatabaseSync) {}

  run(migrations: Migration[]): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const currentVersion = this.currentVersion();
    const pending = migrations.filter((migration) => migration.version > currentVersion);

    if (!pending.length) return;

    this.database.exec("BEGIN IMMEDIATE");
    try {
      for (const migration of pending) {
        migration.up(this.database);
        this.database
          .prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)")
          .run(migration.version, migration.name);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private currentVersion(): number {
    const row = this.database
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number } | undefined;
    return row?.version ?? 0;
  }
}
