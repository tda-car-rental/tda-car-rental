const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tda", {
  documents: {
    save: (input: unknown) => ipcRenderer.invoke("documents:save", input),
    get: (id: number) => ipcRenderer.invoke("documents:get", id),
    update: (id: number, input: unknown) => ipcRenderer.invoke("documents:update", id, input),
    list: () => ipcRenderer.invoke("documents:list"),
    delete: (id: number) => ipcRenderer.invoke("documents:delete", id),
  },
  files: {
    savePdf: (input: unknown) => ipcRenderer.invoke("files:save-pdf", input),
  },
  migration: {
    scanChromium: () => ipcRenderer.invoke("migration:scan"),
    importFile: () => ipcRenderer.invoke("migration:import-file"),
  },
  startup: {
    retry: () => ipcRenderer.send("startup:retry"),
    quit: () => ipcRenderer.send("startup:quit"),
  },
});
