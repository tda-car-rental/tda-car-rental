# Electron Export Icon Design

## Goal

Ensure the exported Windows Electron application uses the existing `logo.png` as its installer, executable, and application-window icon.

## Context

The repository currently contains identical `public/icon.png` and `src/electron/static/logo.png` files. The Windows export is configured through `electron-builder.yml`, while Electron windows configure their icon in `src/electron/main.ts`. The packaged application already copies `src/electron/static` to the `electron-static` resources directory.

## Design

Use `src/electron/static/logo.png` as the canonical icon source:

- Configure electron-builder to read its icon from `src/electron/static/logo.png`.
- Add one icon-path helper in the Electron main process that resolves to `process.resourcesPath/electron-static/logo.png` when packaged and `src/electron/static/logo.png` during development.
- Use that helper for the main and migration `BrowserWindow` icons.
- Leave the web favicon reference unchanged; it serves the browser-rendered application and is not part of Windows packaging.

This keeps the exported app icon and the packaged runtime window icon on the same asset, without introducing image conversion or another generated file.

## Verification

Add a focused architecture test that checks the builder configuration references `src/electron/static/logo.png` and the Electron main process resolves the packaged/source icon paths. Run that test, the full test suite, lint, and the Electron build.

## Acceptance criteria

- `npm run dist:win` uses `src/electron/static/logo.png` as the Windows app icon source.
- Packaged windows resolve the icon from the packaged `electron-static` resource directory.
- Development windows resolve the same source asset from the repository.
- Existing web favicon behavior is unchanged.
