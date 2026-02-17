using DumpCsv;
using SaintCoinach;
using SaintCoinach.Ex;

if (args.Length < 3)
{
    Console.WriteLine("usage: dumpcsv path-to-game lang rawedx|allrawexd <out-path>");
    return 0;
}

var dataPath = args[0];
var inputLang = args[1];
var type = args[2];
var outPath = args.Length > 3 ? args[3] : null;

Console.WriteLine("Loading game data ...");

var realm = new ARealmReversed(
    dataPath,
    @"SaintCoinach.History.zip",
    inputLang == "ja" ? SaintCoinach.Ex.Language.Japanese :
        inputLang == "en" ? SaintCoinach.Ex.Language.English :
        inputLang == "chs" ? SaintCoinach.Ex.Language.ChineseSimplified :
        inputLang == "cht" ? SaintCoinach.Ex.Language.ChineseTraditional :
        SaintCoinach.Ex.Language.English,
    @"app_data.sqlite"
);
realm.Packs.GetPack(
    new SaintCoinach.IO.PackIdentifier("exd", SaintCoinach.IO.PackIdentifier.DefaultExpansion, 0)
).KeepInMemory = true;

Console.WriteLine("Game version: {0}", realm.GameVersion);
Console.WriteLine("Definition version: {0}", realm.DefinitionVersion);

if (string.IsNullOrEmpty(outPath))
{
    outPath = realm.GameVersion;
}

if (type == "allrawexd")
{
    const string CsvFileFormat = "raw-exd-all/{0}{1}.csv";

    var filesToExport = realm.GameData.AvailableSheets;

    // Action counts
    var successCount = 0;
    var failCount = 0;
    var currentCount = 0;
    var total = filesToExport.Count();

    // Process game files.
    foreach (var name in filesToExport)
    {
        currentCount++;
        var sheet = realm.GameData.GetSheet(name);

        // Loop through all available languages
        foreach (var lang in sheet.Header.AvailableLanguages)
        {
            var code = lang.GetCode();
            if (code.Length > 0)
                code = "." + code;

            var target = new FileInfo(Path.Combine(outPath, string.Format(CsvFileFormat, name, code)));

            try
            {
                if (!target.Directory.Exists)
                    target.Directory.Create();

                // Save
                if (currentCount % 100 == 1)
                    Console.WriteLine($"[{currentCount}/{total}] Processing: {name} - Language: {lang.GetSuffix()}");
                sheet.Collection.ActiveLanguage = lang;
                ExdHelper.SaveAsCsv(sheet, lang, target.FullName, true);
                ++successCount;
            }
            catch (Exception e)
            {
                Console.WriteLine($"Export of {name} failed: {e.Message}");
                try { if (target.Exists) { target.Delete(); } } catch { }
                ++failCount;
            }
        }
    }

    Console.WriteLine($"{successCount} files exported, {failCount} failed");
}
else if (type == "rawexd")
{
    const string CsvFileFormat = "rawexd/{0}.csv";
    // Export language for CSV (realm is already cht; MultiSheet now resolves cht/tc so Item etc. export)
    var exportLang = inputLang == "ja" ? SaintCoinach.Ex.Language.Japanese :
        inputLang == "en" ? SaintCoinach.Ex.Language.English :
        inputLang == "chs" ? SaintCoinach.Ex.Language.ChineseSimplified :
        inputLang == "cht" ? SaintCoinach.Ex.Language.ChineseTraditional :
        inputLang == "ko" ? SaintCoinach.Ex.Language.Korean :
        SaintCoinach.Ex.Language.None;

    // Skip sheets SaintCoinach can't export ("Specified method is not supported": raid/*, *Guide*, etc.)
    var filesToExport = realm.GameData.AvailableSheets
        .Where(name => !name.StartsWith("raid/", StringComparison.OrdinalIgnoreCase)
            && !name.Contains("Guide", StringComparison.OrdinalIgnoreCase))
        .ToList();

    var successCount = 0;
    var failCount = 0;
    var total = filesToExport.Count;
    // Sheets we need for tw-*.json — print when exported so user sees item extraction is OK
    var keySheets = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { "Item", "Recipe", "ItemSearchCategory", "ItemUICategory", "Achievement", "Action", "BNpcName", "ENpcResident", "Quest", "Status" };

    foreach (var name in filesToExport)
    {
        var target = new FileInfo(Path.Combine(outPath, string.Format(CsvFileFormat, name)));
        try
        {
            var sheet = realm.GameData.GetSheet(name);

            if (!target.Directory.Exists)
                target.Directory.Create();

            ExdHelper.SaveAsCsv(sheet, exportLang, target.FullName, true);

            ++successCount;
            if (keySheets.Contains(name))
                Console.WriteLine($"  [OK] {name}.csv");
        }
        catch (Exception ex)
        {
            try { if (target.Exists) { target.Delete(); } } catch { }
            ++failCount;
            if (keySheets.Contains(name))
                Console.WriteLine($"  [FAIL] {name}.csv: {ex.Message}");
        }
    }
    Console.WriteLine($"{successCount} exported, {failCount} skipped (unsupported — not used for tw-*.json).");
}
return 0;
