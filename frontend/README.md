# TDA Car Rental

TDA Car Rental is a TanStack Start application for managing vehicle rental operations.

## Development

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

## Quality checks

```sh
npm run test
npm run lint
npm run build
```

## Electron development

```sh
npm run electron:dev
```

## Windows installer

```sh
npm run dist:win
```

The packaged application stores documents in its Electron user-data SQLite
database at `%APPDATA%/TDA Car Rental/tda-car-rental.sqlite`. If an older
desktop build stored data at `%APPDATA%/tanstack_start_ts/tda-car-rental.sqlite`,
the app moves that database into the branded folder on first launch. To bring
forward documents from a previous browser-based version, use the desktop
app's **Data > Migrate legacy data...** action and either search browser data
or select a SQLite backup file.
