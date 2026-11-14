# Database and guideline catalog

Vitanaut uses SQLite at runtime. The database file is created at `data/vitanaut.db` unless `VITANAUT_DB_PATH` is set.

This folder contains the **guideline source data**, not the runtime database.

## Files

| File | Purpose |
|---|---|
| `source/habit-domain-parameters.csv` | Human-editable NASA habit-domain guideline source (41 rows) |
| `reference-parameters.json` | Generated catalog loaded into `ref_parameters` (42 entries) |

The catalog adds one app screening rule for **resting heart rate** to the 41 source parameters. The heart-rate band is an app default, not a NASA numeric limit; the catalog's `bandLabel` states this explicitly.

## Rebuild the catalog

After editing the CSV:

```bash
python3 scripts/build-reference-catalog.py
```

The script writes `database/reference-parameters.json`. The server upserts that catalog into `ref_parameters` on startup.

You can also import parameters through:

```http
POST /api/parameters/import
Content-Type: application/json

{ "parameters": [ ... ] }
```

## Live metrics

Five catalog entries currently have numeric bands and a live data source:

| Parameter | Metric | Aggregation |
|---|---|---|
| Resting heart rate | `heart_rate` | latest reading |
| Total sleep time | `sleep_hours` | latest reading |
| Stress | `stress_index` | latest reading |
| Exercise dose | `active_minutes` | 7-day average |
| Mood | `mood` | 7-day check-in average |

Latest readings older than 48 hours are ignored. Mood needs at least two check-ins in the last seven days.

All other parameters remain reference-only until a matching data source is added.

## Safety note

Bands marked as app defaults are screening ranges, not medical limits. Review them with a flight surgeon before operational use.
