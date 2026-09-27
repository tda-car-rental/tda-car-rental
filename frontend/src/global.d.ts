import type { TdaElectronApi } from "./lib/electron-api";

declare global {
  interface Window {
    tda: TdaElectronApi;
  }
}

export {};
