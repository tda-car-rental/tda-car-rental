export function electronApi() {
  if (!window.tda) {
    const runningInElectron = /Electron/i.test(window.navigator.userAgent);
    throw new Error(
      runningInElectron
        ? "TDA Car Rental is running in Electron, but the desktop bridge is unavailable. Restart the desktop app so the preload script can attach."
        : "TDA Car Rental must be opened through the Electron desktop app.",
    );
  }
  return window.tda;
}
