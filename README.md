# Motorcycle records

A local motorcycle expense tracker for recording fuel, part, and maintenance or repair work. Records are persisted in a browser SQLite database on the device; no product-wide currency is assumed.

## Using the app

Use the responsive record form to select fuel, a part, or workshop work; the form then shows only the relevant fields and provides examples for quick entry. Cost is optional and defaults to EUR when entered. Validation explains missing or invalid fields and moves focus to the first problem.

The history is displayed newest first with a clear category badge, readable date and odometer, and a prominent cost (or an explicit no-cost status). Records can be edited or deleted after confirmation. The UI is designed for phone use as well as desktop.

## Install on iPhone

Open the deployed app in Safari, tap **Share**, then choose **Add to Home Screen**. The installed app opens in its own window. It needs an internet connection to load and stores records in that browser's on-device storage; records are not synced or backed up.

## Monthly expenses

Select **Monthly expenses** to view a responsive stacked chart of priced records by calendar month. Fuel, parts, maintenance, and repair have distinct colors, and each stack shows its monthly total. If you have priced records in more than one currency, select a currency to keep totals meaningful; EUR is selected by default when available. A companion data table is available below the chart for accessible, precise values.

## Commands

- `npm run dev` — start the Vite development server
- `npm run build` — type-check and create a production build
- `npm test` — run domain and persistence tests
- `npm run lint` — lint the source

## Microsoft Clarity

Clarity is initialized when a project ID is configured. Copy [`.env.example`](./.env.example)
to `.env.local`, replace the placeholder with the project ID from Clarity **Settings >
Overview**, and restart the Vite server:

```sh
VITE_CLARITY_PROJECT_ID=your-clarity-project-id
```

The project ID is a public client-side identifier, not a secret. When it is not configured,
the app does not load Clarity. The Azure Static Web Apps deployment supplies the configured
project ID during its production build. Configure Clarity's consent settings in the Clarity
dashboard if your deployment requires consent before analytics collection.

## Azure Static Web Apps

The repository contains a Free-tier Azure Static Web App definition in [`infra/main.bicep`](./infra/main.bicep).
The `Deploy Azure infrastructure` workflow creates the resource group and Static Web App; the
`Deploy app to Azure Static Web Apps` workflow builds the Vite app and publishes `dist/` on every push to
`main`.

Configure these GitHub repository secrets before running the workflows:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` for the OIDC identity used by
  `azure/login`.
- `AZURE_STATIC_WEB_APPS_API_TOKEN`, obtained from the Static Web App's **Manage deployment token**
  page in the Azure portal or with `az staticwebapp secrets list`.

The OIDC identity needs permission to deploy at subscription scope (for the infrastructure workflow)
and the Static Web App resource. The infrastructure workflow's manual inputs default to the current
project's suggested names and `westeurope`; Static Web App names are globally unique.

## Data layer

- `src/domain/record.ts` defines the discriminated record types.
- `src/domain/validateRecord.ts` validates and normalizes data before storage.
- `src/persistence/recordRepository.ts` provides the browser SQLite repository and the legacy localStorage reader used only for migration.
- `src/persistence/sqliteOpfsWorker.ts` loads SQLite WebAssembly in a worker and persists records with OPFS.

## Browser database

SQLite runs in a dedicated browser worker using the maintained [`@sqlite.org/sqlite-wasm`](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) package. Its database is persisted in the browser origin's private file system (OPFS), so no database file is created in this repository and no HTTP persistence service is used.

OPFS SQLite requires a browser that supports OPFS and cross-origin isolation. Vite development and preview set the required `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers; production hosting must set them too. If initialization fails, the UI clearly reports the storage error and does not fall back to another store.

For Azure Static Web Apps, `public/staticwebapp.config.json` supplies these headers in the production build and configures the fallback to `index.html` for client-side navigation.

On its first successful OPFS connection, the app imports valid records from the existing `motorcycle-records` localStorage key. The import is idempotent: records with IDs already in SQLite are left unchanged, and a browser migration marker prevents repeat imports after success. Existing localStorage data is not deleted.
