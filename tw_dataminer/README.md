# TW Data Miner (production)

Extracts Traditional Chinese (TW) game data from the FFXIV Taiwan client and writes **tw-*.json** into **tw_dataminer/output/**.

On deploy, the project compares these files with **teamcraft_git**’s `tw/` JSONs by modify date and uses the newer source per file.

## One command: game → web (recommended)

From project root:

```bash
npm run datamine
```

This **builds DumpCSV** (if needed), **runs setup** (SaintCoinach + DumpCSV) when missing, **extracts** from your game folder (`D:\FINAL FANTASY XIV TC`), writes tw-*.json, resolves them, and builds items data. One command handles everything. Then run **`npm run build`** — the app will use the newest data from your game.

---

## Other pipeline modes

From project root:

```bash
# Use pre-extracted CSVs from ffxiv-datamining-tw repo (no game path)
node tw_dataminer/run-pipeline.js

# Use existing DumpCSV output only
node tw_dataminer/run-pipeline.js --dumpcsv
```

Output: **tw_dataminer/output/tw-*.json**

## Modes

| Mode | Command | Source |
|------|---------|--------|
| repo (default) | `node tw_dataminer/run-pipeline.js` | ffxiv-datamining-tw clone |
| repo + pull | `node tw_dataminer/run-pipeline.js --pull` | git pull then copy |
| extract | `node tw_dataminer/run-pipeline.js --extract` | DumpCSV from game → library → JSON |
| dumpcsv | `node tw_dataminer/run-pipeline.js --dumpcsv` | Existing DumpCSV rawexd → library → JSON |
| local | `node tw_dataminer/run-pipeline.js --local` | tw_dataminer/csv/cht/ (Oxidizer format) |

**Authoritative data:** Repo mode uses the **ffxiv-datamining-tw** community repo; that data can be older or contain typos (e.g. wrong character in a name). For strings that match your installed game client, use **extract** (or **dumpcsv** with output from a recent DumpCSV run). That reads from your actual game files, so you get the same text as in-game.

## Paths (all under tw_dataminer by default)

All tw_dataminer-related folders live inside **tw_dataminer/** so nothing is scattered in the project root:

| Path | Default (inside tw_dataminer) | Env override |
|------|-------------------------------|--------------|
| ffxiv-datamining-tw clone | `tw_dataminer/ffxiv-datamining-tw` | **DATAMINING_TW_DIR** |
| DumpCSV rawexd output | `tw_dataminer/dumpcsv-output/rawexd` | **DUMPCSV_OUTPUT_DIR** |
| DumpCSV build (bin) | `tw_dataminer/dumpcsv/bin/Release/net8.0` | **DUMPCSV_DIR** |
| CSVs (library) | `tw_dataminer/library/` | — |
| JSON output | `tw_dataminer/output/` | — |

Clone **ffxiv-datamining-tw** and/or build **DumpCSV** inside **tw_dataminer** to use these defaults.

### Building DumpCSV (for `--extract`)

DumpCSV depends on [xivapi/SaintCoinach](https://github.com/xivapi/SaintCoinach). **`npm run datamine`** runs **`tw_dataminer/setup-dumpcsv.ps1`** automatically when DumpCSV is not built (clone SaintCoinach, build it and DumpCSV, wire DLLs; includes **cht** / Traditional Chinese support).

**Requires:** **.NET 8 SDK** only. All dependencies (SaintCoinach, NuGet config) are under **tw_dataminer/**.

To run setup manually (e.g. after setup failed during datamine):

```powershell
.\tw_dataminer\setup-dumpcsv.ps1
```


Game path is hardcoded in **run-pipeline.js** as `D:\FINAL FANTASY XIV TC`. If DumpCSV is already built elsewhere (with SaintCoinach at runtime), set **DUMPCSV_DIR** to its `bin/Release/net8.0` folder.

## Env vars

- **DATAMINING_TW_DIR** — ffxiv-datamining-tw clone path (default: `tw_dataminer/ffxiv-datamining-tw`)
- Game path — hardcoded in `run-pipeline.js` as `D:\FINAL FANTASY XIV TC`
- **DUMPCSV_DIR** — DumpCSV bin directory (default: `tw_dataminer/dumpcsv/bin/Release/net8.0`)
- **DUMPCSV_OUTPUT_DIR** — DumpCSV rawexd output (default: `tw_dataminer/dumpcsv-output/rawexd`)
- **GAME_PATH / FFXIV_GAME_PATH** — FFXIV game install root (default: `D:\FINAL FANTASY XIV TC`)
- **DOTNET_ROOT** — .NET runtime (optional)
- **SKIP_EXPORT** — `1` = only copy CSVs, skip JSON generation

## How the web app gets TW data

Before build, **resolve-tw-json** runs and picks sources in this order: (1) tw_dataminer/output, (2) test-extract/output, (3) teamcraft. So after `node tw_dataminer/run-pipeline.js --extract`, run `npm run resolve-tw-json` and `node scripts/build-items-data.js` so the app loads your data.

See **scripts/resolve-tw-json.js** and **package.json** (`resolve-tw-json`, `prebuild`).

