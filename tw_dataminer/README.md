# TW Data Miner (production)

Extracts Traditional Chinese (TW) game data from the FFXIV Taiwan client and writes **tw-*.json** into **tw_dataminer/output/**.

On deploy, the project compares these files with **teamcraft_git**’s `tw/` JSONs by modify date and uses the newer source per file.

## Quick run

From project root:

```bash
# Use pre-extracted CSVs from ffxiv-datamining-tw repo
node tw_dataminer/run-pipeline.js

# Extract from game client then build JSONs (needs DumpCSV)
node tw_dataminer/run-pipeline.js --extract

# Use existing DumpCSV output
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

## Env vars

- **DATAMINING_TW_DIR** — ffxiv-datamining-tw clone path
- **GAME_PATH** — FFXIV TW install (e.g. `D:\FINAL FANTASY XIV TC`)
- **DUMPCSV_DIR** — DumpCSV bin directory
- **DUMPCSV_OUTPUT_DIR** — DumpCSV rawexd output directory
- **DOTNET_ROOT** — .NET runtime (optional)
- **SKIP_EXPORT** — `1` = only copy CSVs, skip JSON generation

## Deploy behavior

Before build, the app runs **resolve-tw-json**: for each **tw-*.json**, it compares modify time of:

- **teamcraft_git/libs/data/src/lib/json/tw/** (theirs)
- **tw_dataminer/output/** (ours)

The newer file is used for that build. So after running `tw_dataminer/run-pipeline.js`, your next deploy will use your extracted data when it’s newer than teamcraft’s.

See project root **scripts/resolve-tw-json.js** and **package.json** (`resolve-tw-json`, `prebuild`).
