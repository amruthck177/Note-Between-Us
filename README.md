# Notes Between Us

Notes Between Us is a space where juniors can ask questions and share messages with seniors, while seniors can offer advice, experiences, and guidance to juniors.

**Ask a little. Share a little. Learn together.**

## Features

- Student-only submission form with batch-specific questions for seniors and advice for juniors.
- Server-side USN validation and automatic batch/semester detection.
- Admin sign-in and protected records, statistics, imports, and exports.
- Search, batch/semester filters, sorting, pagination, record editing, and deletion.
- Excel/CSV import preview, duplicate detection, private file storage, and download.
- Excel and CSV exports from saved records.
- Responsive light and dark themes.
- Server-side Google Sheets sync and admin-only export, pinned to the configured INUGURATION spreadsheet.

## Requirements

- Node.js 22.13 or newer
- npm

The backend uses Node's built-in SQLite module, so a separate database server is not required.

## Set up the first administrator

Install dependencies and create a local environment file:

```powershell
npm install
Copy-Item .env.example .env
```

Choose an administrator email and password. Put the email in `ADMIN_EMAIL` in `.env`. Generate a password hash in PowerShell:

```powershell
$AdminPassword = Read-Host "Choose an admin password"
$AdminHash = $AdminPassword | node server/create-admin-hash.js
$AdminHash
```

Copy the displayed `salt:hash` into `ADMIN_PASSWORD_HASH` in `.env`. The password itself is not stored by the app. Restart the server after changing `.env`.

### Configured local administrator

- Email: `admin@inuguration.local`
- Password: `uf1ZWWqiGcIdK6QvF3-V6kkC-nzbf_ik`

Keep this local credential private and out of public commits.

## Run the app

For a local single-server run, build the frontend and start the API plus static dashboard:

```powershell
npm run start:local
```

Open the student form at `http://127.0.0.1:4174/` or the admin sign-in page at `http://127.0.0.1:4174/admin/login`.

For frontend hot reload during development, run:

```powershell
npm run dev
```

The Vite frontend runs at `http://localhost:5173`; its `/api` requests proxy to Express on port 4174.

## Google Sheets

The SQLite database is the application's primary source of truth. Google Sheets access is optional and uses server-side credentials only.

1. Create a Google service account and enable the Google Sheets API for its project.
2. Share spreadsheet `1qmC2UCeR_bFcLc9rsLpneTaEKR7ym4c1nKWHVulw2XQ` with the service account email.
3. Put the service account JSON in `GOOGLE_SERVICE_ACCOUNT_JSON` in the server's private `.env` or deployment environment.
4. Restart the server and check **Admin → Settings**. The app uses only the `Enter Student Data` tab in that fixed spreadsheet.

The server checks the tab's header row for recognizable Name and USN columns. New submissions are appended; dashboard edits update the matching sheet row by USN, and dashboard deletions clear that row's contents. Use **Admin → Export data → Export to Google Sheet** to add records missing from the sheet and apply pending dashboard edits to existing rows. Administrators can also import existing sheet rows into SQLite and retry pending new submissions from Settings. These updates run when a dashboard action is saved, so valid service-account credentials must be configured and the spreadsheet shared with that account. Without credentials, edits and deletes affect the app database only and the dashboard reports Sheets as unconfigured; the export action can apply pending edits after connection is set up.

Never put service-account JSON in frontend code or commit it to source control.

## Data and access

- Student submission endpoints accept only validated submissions. Students have no endpoint to list records or download exports.
- Admin APIs require a server-managed session cookie.
- USNs are normalized and unique. Batch and semester are derived server-side: 2023 → 7th, 2024 → 5th, 2025 → 3rd semester.
- Admin records default to complete USN ascending order. Serial numbers follow the sorted result across pages.
- Excel/CSV imports are previewed; invalid and duplicate rows are skipped, and existing records are not overwritten.
- Uploaded source files and SQLite data are stored locally under `data/` by default. Use `DB_PATH` to change the database location.
- Keep `.env`, `data/`, and credentials out of source control.

## Verification

```powershell
npm test
npm run build
```

The API integration test uses an isolated temporary database and test-only records. It does not modify the real Google Sheet.
