import { spawn } from "node:child_process";
import { get } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { DocumentDatabase } from "./main/document-database.js";
import { registerIpcHandlers } from "./main/ipc.js";
import { scanChromiumProfiles } from "./main/legacy-migration.js";
import { ensurePersistentDocumentDatabase, resolveElectronUserDataPath } from "./main/storage-path.js";
import { StartupController } from "./main/startup-controller.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const startupPort = 43_017;

app.setPath("userData", resolveElectronUserDataPath({ appDataRoot: app.getPath("appData") }));

function staticPath(name: string) {
  return app.isPackaged
    ? join(process.resourcesPath, "electron-static", name)
    : join(currentDir, "../src/electron/static", name);
}

function serverUrl() {
  return process.env.TDA_ELECTRON_DEV_URL ?? `http://127.0.0.1:${startupPort}`;
}

function serverEntryPath() {
  return app.isPackaged
    ? join(process.resourcesPath, "app-server", "server", "index.mjs")
    : join(currentDir, "../.output/server/index.mjs");
}

function startServer() {
  if (process.env.TDA_ELECTRON_DEV_URL) return { kill: () => undefined };
  const server = spawn(process.execPath, [serverEntryPath()], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NITRO_HOST: "127.0.0.1",
      NITRO_PORT: String(startupPort),
    },
    stdio: "ignore",
    windowsHide: true,
  });
  server.once("error", () => undefined);
  return server;
}

function isReachable(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = get(url, (response) => {
      response.resume();
      resolve(true);
    });
    request.once("error", () => resolve(false));
    request.setTimeout(1_000, () => request.destroy());
  });
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    webPreferences: {
      preload: join(currentDir, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());
  await window.loadFile(staticPath("loading.html"));
  return window;
}

async function createMigrationWindow(parent: BrowserWindow) {
  const window = new BrowserWindow({
    width: 680,
    height: 520,
    parent,
    webPreferences: {
      preload: join(currentDir, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  await window.loadFile(staticPath("migration.html"));
}

app.whenReady().then(async () => {
  const database = new DocumentDatabase(ensurePersistentDocumentDatabase({ appDataRoot: app.getPath("appData") }));
  registerIpcHandlers({
    database,
    dialog,
    ipcMain,
    localAppData: process.env.LOCALAPPDATA ?? app.getPath("userData"),
    scanChromiumProfiles,
  });
  const mainWindow = await createWindow();
  const startupController = new StartupController({
    startServer,
    isReachable: () => isReachable(serverUrl()),
    loadApplication: () => mainWindow.loadURL(serverUrl()),
    showLoading: () => mainWindow.loadFile(staticPath("loading.html")),
    showTimeout: () => mainWindow.loadFile(staticPath("startup-error.html")),
  });
  ipcMain.on("startup:retry", () => void startupController.retry());
  ipcMain.on("startup:quit", () => app.quit());
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Data",
      submenu: [{ label: "Migrate legacy data…", click: () => void createMigrationWindow(mainWindow) }],
    },
  ]));
  app.once("before-quit", () => {
    startupController.dispose();
    database.close();
  });
  await startupController.start();
});

app.on("window-all-closed", () => app.quit());
