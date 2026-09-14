# AAXAL Office

A lightweight, database-backed quotation and invoicing application for AAXAL Offshore Services Limited. It was built from the five supplied PDFs and runs without third-party runtime dependencies.

## Start the application

Requirements: Node.js 22.5 or newer.

```bash
npm start
```

Open [http://localhost:4173](http://localhost:4173).

The SQLite database is created automatically at `data/aaxal.sqlite`. To use another location, set `AAXAL_DB_PATH`. To use another port, set `PORT`.

## Run with Docker

Requirements: Docker Desktop, Docker Engine with the Compose plugin, or another compatible Docker installation.

From this folder, run:

```bash
docker compose up --build -d
```

Then open [http://localhost:4173](http://localhost:4173). The database is kept in the named `aaxal-data` volume, so documents remain available when the container is recreated or upgraded.

Useful commands:

```bash
# View logs
docker compose logs -f

# Stop the application without deleting its data
docker compose down

# Start it again
docker compose up -d
```

Do not add `--volumes` to `docker compose down` unless you intentionally want to delete the saved database.

To use Docker without Compose:

```bash
docker build -t aaxal-office .
docker run -d --name aaxal-office -p 4173:4173 -v aaxal-data:/app/data --restart unless-stopped aaxal-office
```

## Included workflow

- Create, edit and finalise quotations and invoices.
- Convert a finalised quotation into a pre-filled invoice.
- Search customers by company name or telephone number. Telephone punctuation and spaces are ignored during searches.
- Use any of the 10 controlled personnel rates imported from `AAXAL OS Price List 2026.pdf`.
- Add equipment or lump-sum lines as custom rates with a mandatory commercial reason.
- Recheck linked prices against the current price book during finalisation.
- Block rate mismatches and unjustified custom lines.
- Lock finalised documents against further editing.
- Preview and print/save A4 documents in a layout based on the supplied AAXAL PDFs.
- Store company, customer, catalogue, document and line-item data in SQLite.

The two supplied quotations and two supplied invoices are imported as finalised historical records on first start. Hydrodive and UIML are imported as customers. Their telephone fields are blank because customer telephone numbers were not present in the supplied documents.

## Price handling

The supplied price list contains eight ACFM operator rates at US$315/day and two NDT inspection assistant rates at US$250/day. Those are authoritative catalogue entries. Equipment and lump-sum prices shown in the sample documents do not appear in the supplied price list, so they are imported as explicitly justified custom rates rather than being misrepresented as price-book rates.

## Tests

```bash
npm test
```

The automated workflow tests cover price-list import, customer telephone/name search, custom-rate validation, catalogue mismatch blocking, successful finalisation and final-document locking.

## Source-document note

The supplied UIML invoice displays an issue date of 9 April 2025 while its quotation/PO narrative refers to 2026. The imported record preserves the displayed invoice date exactly; confirm this date before using the historical record operationally.
