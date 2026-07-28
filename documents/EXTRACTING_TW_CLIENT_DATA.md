# Extracting TW Client Data for Teamcraft (tw-item.json etc.)

This document describes how **ffxiv-teamcraft** obtained and updated the Taiwan (TW) client data used for `tw-items.json`, `tw-item-descriptions.json`, and other `tw-*.json` files.

**Important:** Only **read** game files. Do **not** modify, patch, or write anything inside the game installation directory (e.g. `D:\FINAL FANTASY XIV TC`) to avoid any risk of bans or client integrity issues.

---

## Goal: Extract from your game and use it on the web

**Single path in this project:**

1. **Extract** from your FFXIV TW install: run **`npm run datamine`** (or `node tw_dataminer/run-pipeline.js --extract`). Game path is hardcoded as `D:\FINAL FANTASY XIV TC`. If DumpCSV is not built, the pipeline runs **`tw_dataminer/setup-dumpcsv.ps1`** automatically.
2. **Resolve** so the build uses that output:  
   `npm run resolve-tw-json`  
   (Uses **tw_dataminer/output/** first, then test-extract/output, then teamcraft.)
3. **Build** items data and run your app:  
   `node scripts/build-items-data.js` then your normal build/dev.

All extractor dependencies live under **tw_dataminer/** (SaintCoinach, DumpCSV, ffxiv-datamining-tw clone). The **test-extract** folder is legacy; it defaults to the same paths under **tw_dataminer/** (ffxiv-datamining-tw, dumpcsv, dumpcsv-output). No paths outside this repo are used.

See **tw_dataminer/README.md** for pipeline modes and env vars.

---

---

## How the TW pipeline works elsewhere (ffxiv-datamining-worker)

The repo [harukaxxxx/ffxiv-datamining-worker](https://github.com/harukaxxxx/ffxiv-datamining-worker) automates **Step 2 only**. It does **not** extract from the game itself.

1. **Source of CSVs:** [harukaxxxx/ffxiv-datamining-tw](https://github.com/harukaxxxx/ffxiv-datamining-tw) is a separate repo that holds **rawexd** CSVs extracted from the FFXIV Traditional Chinese client. Those CSVs are produced by someone running Saint Coinach (or similar) on the TW client and pushing the `rawexd/` output to that repo, tagged by game version (e.g. `patch-7.00`).

2. **What the worker does:** On manual trigger with a version (e.g. `7.00`), the workflow:
   - Clones `ffxiv-datamining-tw` at tag `patch-{version}`.
   - Copies `rawexd/*` into a `library/` folder.
   - Clones ffxiv-teamcraft, then runs `node teamcraft/data-extraction/data-exporter/index-tw.js` (so Teamcraft’s `library/` is the copied CSVs).
   - Opens a PR to a Teamcraft fork with the new `tw-*.json` files.

So **extraction from the game** is done outside the worker (into ffxiv-datamining-tw). The worker only turns existing CSVs into Teamcraft JSON and creates the PR.

The step named **"Run data generator"** in the [workflow job](https://github.com/harukaxxxx/ffxiv-datamining-worker/actions/runs/20253073457/job/58149229870) is only:

```bash
node --max-old-space-size=4096 teamcraft/data-extraction/data-exporter/index-tw.js
```

There is **no** step that reads from the game client. The CSVs are already in `library/` from the previous step (clone ffxiv-datamining-tw and copy its `rawexd/`). To extract from **your own** client (e.g. `D:\FINAL FANTASY XIV TC`), use the local extraction flow below.

---

## Local extraction from your game client

To get TW data from your own installation (e.g. `D:\FINAL FANTASY XIV TC`), you can use the **data-miner** in the test folder (XIVData Oxidizer) or other tools:

- **Data-miner (test folder):** [xivapi/ffxiv-datamining](https://github.com/xivapi/ffxiv-datamining) use [XIVData Oxidizer](https://github.com/skyborn-industries/xiv-data-oxidizer) to extract CSVs. We run the same approach: from project root, set `OXIDIZER_DIR` to your Oxidizer clone and run `node test-extract/run-data-miner.js`. CSVs are written to **`test-extract/csv/`**. See `test-extract/scripts/README-XIVData-Oxidizer.md`.

If you used the data-miner, CSVs are in `test-extract/csv/`. Copy the ones you need into `test-extract/library/` (the exporter reads from `library/`). If the exporter expects a different CSV format (e.g. Saint Coinach’s 3-line header), use one of the options below or add a conversion step.

1. **Step 1 – Extract EXD → CSV** from your game (read-only). Use either:
   - **DumpCSV** (recommended, non-interactive): [thewakingsands/dumpcsv](https://github.com/thewakingsands/dumpcsv). Build it, add **cht** support (see `test-extract/scripts/README-DumpCSV-cht.md`), then run e.g.  
     `DumpCSV.exe "D:\FINAL FANTASY XIV TC" cht rawexd path\to\output`  
     This creates `path\to\output\rawexd\*.csv`.
   - **Saint Coinach**: Run SaintCoinach.Cmd with your game path and enter `rawexd` in the console; copy the `{GameVersion}/rawexd/*.csv` output somewhere.
2. **Step 2 – Copy CSVs** from the extractor’s `rawexd/` folder into `test-extract/library/` (overwrite existing files).
3. **Step 3 – Generate TW JSON**:  
   `node test-extract/exporter/index-tw.js`  
   Output is written to `test-extract/output/tw-*.json`.

You can automate Step 1–3 with the script below if you have DumpCSV (with cht) built.

---

## Overview: Two Steps

1. **Step 1 – Extract game data to CSV**  
   Use a tool that reads the game’s `.exd` / sqpack data and exports it to CSV. The reference tool is **Saint Coinach** (or an alternative that outputs the same CSV shape).

2. **Step 2 – Build TW JSON from CSV**  
   Use Teamcraft’s **data-exporter** (TW config) to read those CSVs and generate the `tw-*.json` files (e.g. `tw-items.json`).

The Teamcraft repo does **not** ship the CSV files or the extraction binary; it only contains the exporter that turns CSVs into `tw-*.json`. When the game updates, you need to re-extract from the **Taiwan client** and then re-run the exporter.

---

## Step 1: Extract EXD Data to CSV

### Tool: Saint Coinach

- **Repository:** [xivapi/SaintCoinach](https://github.com/xivapi/SaintCoinach)  
- **Purpose:** .NET (C#) library and CLI that read FFXIV’s sqpack (e.g. `game\sqpack\`) and export game data (e.g. EXD sheets) to CSV.
- **Language support:** The library supports `ChineseTraditional` (code `cht`) and `TraditionalChinese` (code `tc`). The Taiwan client’s data is typically in Traditional Chinese.

### Game Path (Taiwan Client)

Use the **root** of the Taiwan client installation, not the `game` folder:

- Example: `D:\FINAL FANTASY XIV TC`

That folder should contain:

- `boot\` (e.g. `FfxivLauncherTC.exe`)
- `game\` (contains `ffxivgame.ver`, `sqpack\`, etc.)

Do **not** point the tool at `D:\FINAL FANTASY XIV TC\game` unless the tool’s documentation explicitly expects the `game` subfolder. Most tools expect the root that contains `game`.

### Running Saint Coinach.Cmd

1. **Build or download** SaintCoinach (e.g. build the solution or use a release from [xivapi/SaintCoinach](https://github.com/xivapi/SaintCoinach)).
2. **Set the game path** (either in config or as first argument), e.g.  
   `"D:\FINAL FANTASY XIV TC"`.
3. **Export EXD to CSV:**
   - **All sheets, single language (recommended for TW):**  
     In the Cmd prompt:  
     `rawexd`  
     This writes CSVs under `{GameVersion}/rawexd/`, e.g.  
     `2026.01.22.0000.0000/rawexd/Item.csv`.  
     When using the **Taiwan client**, the exported text will be in Traditional Chinese.
   - **All sheets, all languages:**  
     `allrawexd`  
     This writes files like `raw-exd-all/Item.cht.csv`. For the Teamcraft TW exporter you would then copy or rename the Traditional Chinese file to `Item.csv` (see “Library folder” below).
4. **Do not** write or change anything inside `D:\FINAL FANTASY XIV TC`; the tool should only read.

### Output Location

- **rawexd:** `{GameVersion}/rawexd/{SheetName}.csv`  
  Example: `2026.01.22.0000.0000/rawexd/Item.csv`  
  (The version string comes from the game, e.g. from `game\ffxivgame.ver`.)
- **allrawexd:** `{GameVersion}/raw-exd-all/{SheetName}.{lang}.csv`  
  Example: `2026.01.22.0000.0000/raw-exd-all/Item.cht.csv`

You will copy the needed CSVs from here into the Teamcraft **library** folder (Step 2).

### If Saint Coinach Does Not Support TW Language in the GUI

The C# enum includes `ChineseTraditional` / `TraditionalChinese`. If the prebuilt Cmd only exposes English/Japanese/etc., you can:

- Build from source and change the `ARealmReversed(..., Ex.Language.English, ...)` (or equivalent) to `Ex.Language.ChineseTraditional` (or the correct enum value for TW), then run `rawexd`; or  
- Use `allrawexd` and then use the `*.cht.csv` (or `*.tc.csv`) files as described above.

### Alternative: DumpCSV / Other Extractors

Tools like [thewakingsands/dumpcsv](https://github.com/thewakingsands/dumpcsv) can produce CSV from sqpack without SaintCoinach.Cmd. If you use another extractor, ensure:

- Output is CSV with the same general structure (header row, then data rows).
- Sheet names match what Teamcraft expects (e.g. `Item`, `ItemSearchCategory`, `ItemUICategory`).
- You use the **Taiwan client** path so names/descriptions are in Traditional Chinese.

---

## Step 2: Build TW JSON from CSV (Teamcraft Data-Exporter)

### Library Folder (CSV Input)

The TW exporter reads CSVs from the **library** folder at the **root** of the Teamcraft repo:

- Path (from repo root): `library/`
- Full path example: `<repo>/teamcraft_git/library/`

For TW, the config uses **no language suffix** in the CSV file name:

- Put: `Item.csv`, `ItemSearchCategory.csv`, `ItemUICategory.csv`, etc.
- Not: `Item.cht.csv` or `Item.en.csv`

So after Step 1:

- If you used **rawexd** on the TW client: copy (or symlink) the contents of `{GameVersion}/rawexd/*.csv` into `teamcraft_git/library/`.
- If you used **allrawexd**: copy `Item.cht.csv` → `library/Item.csv`, and similarly for every sheet name you need.

### Required CSV Sheets for TW Item-Related JSON

At minimum, for the item-related lazy data:

| CSV file              | Used to build              |
|-----------------------|----------------------------|
| `Item.csv`            | `tw-items.json`, `tw-item-descriptions.json` |
| `ItemSearchCategory.csv` | `tw-item-search-categories.json` |
| `ItemUICategory.csv`  | `tw-item-ui-categories.json` |

For a **full** TW export (achievements, actions, fates, recipes, etc.), the exporter uses many more sheets. They are listed in `data-extraction/data-exporter/task/index.js` as the first argument to `db('...')`, for example:

- `Achievement`, `Action`, `ActionCategory`, `ActionTransient`, `BaseParam`, `BeastReputationRank`, `ContentType`, `CraftAction`, `EventItem`, `ExVersion`, `Fate`, `GatheringPointBonus`, `GatheringPointBonusType`, `GatheringCondition`, `GatheringType`, `ContentFinderCondition`, `ContentFinderConditionTransient`, `ItemSearchCategory`, `ItemUICategory`, `Item`, `ClassJob`, `ClassJobCategory`, `JournalGenre`, `Leve`, `Map`, `PlaceName`, `BNpcName`, `NotebookDivision`, `NotebookDivisionCategory`, `ENpcResident`, `Quest`, `Race`, `Recipe`, `RecipeLevelTable`, `GilShop`, `SpecialShop`, `Status`, `TraitTransient`, `Trait`, `Tribe`, `TripleTriadRule`, `RetainerTask`, `RetainerTaskRandom`, `RetainerTaskNormal`, `Weather`, `AirshipExplorationPoint`, `SubmarineExploration`, `MJICraftworksObjectTheme`, and quest-related sheets.

So for a full run, copy (or export) all corresponding CSVs into `library/` with the exact names expected by the exporter (e.g. `Item.csv`, not `Item.cht.csv`).

### Running the TW Exporter

From the **Teamcraft repo root** (e.g. `teamcraft_git/`):

```bash
node data-extraction/data-exporter/index-tw.js
```

- **Input:** CSVs in `library/` (see above).
- **Output:**  
  `libs/data/src/lib/json/tw/tw-{name}.json`  
  e.g. `tw-items.json`, `tw-item-descriptions.json`, `tw-item-search-categories.json`, `tw-item-ui-categories.json`.

Config is in:

- `data-extraction/data-exporter/config/tw.js`

It defines:

- `dbPath`: `library/{name}.csv`
- `outputPath`: `libs/data/src/lib/json/tw/tw-{name}.json`
- `languages`: `[{ output: 'tw', file: '' }]` (so no suffix in CSV names).

### Optional: Export Only Some Files

You can limit which JSON files are built by passing a comma-separated list:

```bash
node data-extraction/data-exporter/index-tw.js items,item-descriptions,item-search-categories,item-ui-categories
```

This only generates the listed `tw-*.json` outputs (and only needs the corresponding CSVs in `library/`).

---

## Verifying Your Game Client (Read-Only)

You can confirm that your Taiwan client layout matches what extractors expect:

- **Root:** e.g. `D:\FINAL FANTASY XIV TC`
  - `boot\` (launcher)
  - `game\` (game data)
- **Game version:** `game\ffxivgame.ver` (e.g. `2026.01.22.0000.0000`)
- **Sqpack (data):** `game\sqpack\` with subfolders such as `ffxiv`, `ex1`, `ex2`, `ex3`, `ex4`, `ex5` and `.win32.dat0`, `.win32.index`, `.win32.index2` files.

Do **not** modify any of these files or folders; only reading is needed for extraction.

---

## Summary Checklist

1. **Extract (read-only from game):**
   - Use Saint Coinach (or equivalent) with game path = `D:\FINAL FANTASY XIV TC`.
   - Run `rawexd` (or `allrawexd` and then rename/copy `*.cht.csv` → `*.csv`).
2. **Copy CSVs** from the tool’s output folder into `teamcraft_git/library/` with names like `Item.csv`, `ItemSearchCategory.csv`, `ItemUICategory.csv`, etc.
3. **Run exporter:**  
   `node data-extraction/data-exporter/index-tw.js`  
   (optionally with a comma-separated list of outputs).
4. **Use generated files** under `libs/data/src/lib/json/tw/` (e.g. `tw-items.json`) in your app or copy them where your project expects them.

This process is how TW client data was extracted for Teamcraft (e.g. in PR #3098). Repeating it after each game update keeps `tw-*.json` in sync with the Taiwan client.
