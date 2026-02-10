# Test TW data extractor

This folder runs the same CSV → `tw-*.json` logic as Teamcraft’s data-exporter, but reads CSVs from `library/` and writes JSON into `output/` inside this folder.

## One command: game → CSV → JSON (recommended)

From **project root**, run:

```bash
node test-extract/run-pipeline.js --extract
```

This will:

1. **Datamine** your FFXIV TW client (DumpCSV) → CSVs to `DUMPCSV_OUTPUT_DIR` (default `d:\ji_project\dumpcsv-output\rawexd`).
2. **Copy** those CSVs into `test-extract/library/`.
3. **Generate** `tw-*.json` into **`test-extract/output/`**.

**Requirements:**

- **DumpCSV** built with **cht** (Traditional Chinese). See **`scripts/README-DumpCSV-cht.md`** and **`scripts/README-SaintCoinach-or-DumpCSV.md`**.
- **.NET** (for DumpCSV): `dotnet` must be on your PATH, or set **`DOTNET_ROOT`** (e.g. `C:\Program Files\dotnet`).
- **Game path:** default `D:\FINAL FANTASY XIV TC`; override with **`GAME_PATH`** if needed.

**Other pipeline modes:**

```bash
node test-extract/run-pipeline.js              # use CSVs from ffxiv-datamining-tw repo
node test-extract/run-pipeline.js --dumpcsv   # use existing DumpCSV output (skip extract step)
node test-extract/run-pipeline.js --local     # use test-extract/csv/cht/ (Oxidizer format)
```

## Alternative: Oxidizer (CSV only, then run exporter)

To pull raw data from your FFXIV client into `csv/` with [XIVData Oxidizer](https://github.com/skyborn-industries/xiv-data-oxidizer):

1. **Prereqs:** Rust, then clone Oxidizer:  
   `git clone --recurse-submodules https://github.com/skyborn-industries/xiv-data-oxidizer`
2. **Run the data-miner** (from project root):  
   `node test-extract/run-data-miner.js "C:\path\to\xiv-data-oxidizer"`  
   Default game path is `D:\FINAL FANTASY XIV TC`; override with `GAME_PATH`.
3. **Output:** CSVs in **`test-extract/csv/`**. Then run **`node test-extract/run-pipeline.js --local`** to convert to `library/` and build `output/tw-*.json`.

See **`scripts/README-XIVData-Oxidizer.md`** for details.

**If Oxidizer fails on a sheet**, use **DumpCSV** and **`run-pipeline.js --extract`** (or **`--dumpcsv`**) as above.

## Verify the pipeline (no game files needed)

Minimal test CSVs are included in `library/` so you can confirm the exporter works:

```bash
node test-extract/run-test.js
```

This runs the exporter on the sample CSVs and checks that `tw-items.json`, `tw-item-descriptions.json`, `tw-item-search-categories.json`, and `tw-item-ui-categories.json` are non-empty. You should see “All outputs non-empty. Extractor test passed.”

## Real data: supply your own CSVs

For real TW names, **replace** the files in `library/` with CSVs from the game client (e.g. [Saint Coinach](https://github.com/xivapi/SaintCoinach)) — see `documents/EXTRACTING_TW_CLIENT_DATA.md`. File names must match sheet names (no language suffix), e.g. `Item.csv`, `ItemSearchCategory.csv`, `ItemUICategory.csv`.

## Layout

- **`csv/`** — Filled by the **data-miner** (`run-data-miner.js`) when extracting from your game client (XIVData Oxidizer). Use this as the source of extracted CSVs.
- **`library/`** — CSVs used by the **exporter**. Sample test CSVs are included; for real TW data, replace with Saint Coinach/DumpCSV output or (if format matches) copy from `csv/`.
- **`output/`** — Generated `tw-*.json` files are written here.
- **`exporter/`** — Node script that reads `library/*.csv` and writes `output/tw-*.json`.
- **`run-data-miner.js`** — Runs XIVData Oxidizer with your game path and copies its output into `csv/`.

## Run

From the **project root** (`FFXIV_market`):

```bash
node test-extract/exporter/index-tw.js
```

Or from **inside** `test-extract`:

```bash
node exporter/index-tw.js
```

To generate only item-related JSON (fewer CSVs needed):

```bash
node test-extract/exporter/index-tw.js items,item-descriptions,item-search-categories,item-ui-categories
```

That needs at least: `Item.csv`, `ItemSearchCategory.csv`, `ItemUICategory.csv` in `library/`. If a CSV is missing, that output file is written as `{}`.

## After testing

If the `output/` JSON looks correct, you can:

1. Copy `output/tw-*.json` into your app’s data path, or
2. Point your app at `test-extract/output/` for TW lazy data, or
3. Reuse this exporter in your project (e.g. run it when you have new CSVs and copy results into the main data folder).
