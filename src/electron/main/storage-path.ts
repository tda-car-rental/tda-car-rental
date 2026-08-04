import { copyFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

const APP_NAME = "TDA Car Rental";
const LEGACY_APP_NAME = "tanstack_start_ts";
const DATABASE_FILE_NAME = "tda-car-rental.sqlite";

type StorageOptions = {
  appDataRoot: string;
  appName?: string;
  legacyAppName?: string;
  databaseFileName?: string;
};

export function resolveDocumentDatabasePath(options: StorageOptions) {
  const appDataDirectory = resolveElectronUserDataPath(options);
  const databaseFileName = options.databaseFileName ?? DATABASE_FILE_NAME;
  return join(appDataDirectory, databaseFileName);
}

export function resolveElectronUserDataPath(options: StorageOptions) {
  const appName = options.appName ?? APP_NAME;
  return join(options.appDataRoot, appName);
}

export function ensurePersistentDocumentDatabase(options: StorageOptions) {
  const appName = options.appName ?? APP_NAME;
  const legacyAppName = options.legacyAppName ?? LEGACY_APP_NAME;
  const databaseFileName = options.databaseFileName ?? DATABASE_FILE_NAME;
  const brandedFile = resolveDocumentDatabasePath({
    appDataRoot: options.appDataRoot,
    appName,
    databaseFileName,
  });
  const legacyFile = join(options.appDataRoot, legacyAppName, databaseFileName);

  mkdirSync(dirname(brandedFile), { recursive: true });
  if (!existsSync(brandedFile) && existsSync(legacyFile)) {
    try {
      renameSync(legacyFile, brandedFile);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code !== "EXDEV") throw error;
      copyFileSync(legacyFile, brandedFile);
      unlinkSync(legacyFile);
    }
  }

  return brandedFile;
}
