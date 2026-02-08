# JSON to CSV Converter

This directory contains tools to convert JSON data files to CSV format. The main app uses **local msgpack/JSON only**; it does not use Supabase. The previous "sync to Supabase" workflow and `sync_smart.js` have been removed.

## Quick Start

### Convert JSON to CSV

```bash
cd json_converter
node json_to_csv.js
```

## Files

### Core Scripts
- `json_list.txt` - List of JSON files to convert
- `json_to_csv.js` - Converts JSON files to CSV

### SQL Files (in `sql/` directory)

Legacy SQL for Supabase; kept for reference only. App does not use Supabase.

- `sql/create_helper_function.sql`, `create_tables.sql`, etc.

### Output

- `csv_output/` - Generated CSV files (gitignored, auto-generated)

## Adding New JSON Files

1. Add entry to `json_list.txt`:
   ```
   path/to/file.json|table_name|structure_type|description
   ```
2. Run `node json_to_csv.js` to regenerate CSV.

## Structure Types

- `array` - Simple array `[1, 2, 3]`
- `object_simple` - Key-value `{ "id": value }`
- `object_nested` - Nested `{ "id": { "tw": "name" } }`
- `object_complex` - Complex with arrays
- `array_of_objects` - Array of objects

## Troubleshooting

**CSV parsing errors:** Check CSV files for malformed data; verify JSON structure matches structure_type.

## Notes

- CSV files are regenerated when you run `node json_to_csv.js`.
