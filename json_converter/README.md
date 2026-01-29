# JSON to CSV Converter for Supabase Migration

This directory contains tools to convert JSON data files to CSV format for importing into Supabase.

## Files

- `json_list.txt` - List of JSON files to convert with their metadata
- `json_to_csv.js` - Node.js script that converts JSON files to CSV
- `csv_output/` - Output directory for generated CSV files (created automatically)

## Usage

### 1. Run the converter

```bash
node json_to_csv.js
```

Or if you made it executable:

```bash
./json_to_csv.js
```

### 2. Review the output

All CSV files will be generated in the `csv_output/` directory.

### 3. Import to Supabase

1. Go to your Supabase project dashboard
2. Navigate to Table Editor
3. Create tables matching the CSV structure (or use SQL to create tables)
4. Use the Import CSV feature to import each CSV file

## JSON List Format

The `json_list.txt` file uses the following format:

```
relative_path|table_name|structure_type|description
```

### Structure Types

- `array` - Simple array of values (e.g., `[1, 2, 3]`)
- `object_simple` - Simple key-value pairs (e.g., `{ "id": value }`)
- `object_nested` - Object with nested objects (e.g., `{ "id": { "tw": "name" } }`)
- `object_complex` - Complex nested objects with arrays (e.g., equipment.json)
- `array_of_objects` - Array of objects (e.g., `[{ "id": 1, "name": "..." }]`)

## CSV Output Format

### Array
```csv
id
1
2
3
```

### Object Simple
```csv
id,value
1,100
2,200
```

### Object Nested
```csv
id,tw
1,Item Name
2,Another Item
```

### Object Complex / Array of Objects
Complex structures (arrays, nested objects) are stored as JSON strings in CSV, which can be imported as JSONB columns in Supabase.

## Supabase Table Creation

After importing CSV files, you may need to:

1. **Set primary keys**: Most tables should have `id` as primary key
2. **Create indexes**: Create indexes on `id` columns for performance
3. **Set column types**: 
   - `id` columns: INTEGER or BIGINT
   - JSON arrays/objects: JSONB type
   - Text fields: TEXT or VARCHAR

### Example SQL for creating tables:

```sql
-- Example: tw_items table
CREATE TABLE tw_items (
  id INTEGER PRIMARY KEY,
  tw TEXT NOT NULL
);

CREATE INDEX idx_tw_items_id ON tw_items(id);

-- Example: equipment table (with JSONB for arrays)
CREATE TABLE equipment (
  id INTEGER PRIMARY KEY,
  equipSlotCategory INTEGER,
  level INTEGER,
  unique INTEGER,
  jobs JSONB,  -- Array stored as JSONB
  pDmg INTEGER,
  mDmg INTEGER,
  pDef INTEGER,
  mDef INTEGER,
  delay INTEGER
);

CREATE INDEX idx_equipment_id ON equipment(id);
```

## Notes

- Large files (like `tw-recipes.json` at 11MB) may take a while to process
- CSV files will be created in the `csv_output/` directory
- The script handles CSV escaping automatically (commas, quotes, newlines)
- Arrays and nested objects are stored as JSON strings for JSONB import

## Troubleshooting

If a file fails to convert:
1. Check that the JSON file exists at the specified path
2. Verify the JSON is valid (use a JSON validator)
3. Check the structure type matches the actual JSON structure
4. Review the error message in the console output
