# Test Scripts

This directory contains test scripts for manual testing and verification of various features.

## Available Test Scripts

### `test_advanced_search_queries.js`
**Purpose**: Tests advanced search functionality with various query combinations  
**Usage**: 
```bash
cd test_scripts
node test_advanced_search_queries.js
```

**What it tests**:
- Single job selection (e.g., PLD)
- Multiple job selection
- Level range filtering
- Equipment slot filtering
- Combined filters with joins

**Note**: Uses game data from local msgpack/JSON (`../src/services/gameData.js`). No remote DB required.

---

### `test_obtain_methods.js`
**Purpose**: Test plan and checklist for ObtainMethods component Supabase integration  
**Usage**: 
```bash
cd test_scripts
node test_obtain_methods.js
```

**What it provides**:
- Test plan structure
- Manual testing checklist
- Expected data structure verification
- List of functions to test

**Note**: This is primarily a reference/test plan. Actual testing should be done in the browser. ObtainMethods uses obtainableDataService (msgpack), not a remote DB.

---

## Running Tests

All test scripts should be run from the project root directory:

```bash
# From project root
node test_scripts/test_advanced_search_queries.js
node test_scripts/test_obtain_methods.js
```

Or from within the `test_scripts` directory:

```bash
cd test_scripts
node test_advanced_search_queries.js
node test_obtain_methods.js
```

---

## Notes

- These are **manual test scripts** for development/debugging purposes
- They are not part of the automated test suite
- App data is local (msgpack/JSON); no Supabase required for the main app
- Update import paths if moving files around
