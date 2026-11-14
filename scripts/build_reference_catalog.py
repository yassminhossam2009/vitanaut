#!/usr/bin/env python3
"""Turn the habit-domain guideline CSV into the structured reference catalog.

Every row from the source file is preserved. Numeric bands are only attached
where the app has a live metric and a defensible basis; the band label always
states whether it is a NASA limit, ISS practice, or an app screening default.

Usage:
    python3 scripts/build_reference_catalog.py db/source/habit_domain_parameters.csv
"""
import csv
import json
import re
import sys
from pathlib import Path

DOMAIN_MAP = {
    "Sleep": "sleep",
    "Exercise": "exercise",
    "Nutrition": "nutrition",
    "Hydration": "hydration",
    "Mental health": "mental_health",
    "Symptoms": "symptoms",
}

# Only parameters the app can measure right now get a live band. Each label is
# explicit about the basis so an app default is never mistaken for NASA policy.
CURATED = {
    "Total sleep time": {
        "metric_key": "sleep_hours",
        "aggregation": "latest",
        "status": "monitored",
        "bands": {"greenMin": 7, "greenMax": 9, "yellowMin": 6, "yellowMax": 10, "redBelow": 6, "redAbove": 10},
        "band_label": "App operational band. NASA-STD-3001 recommends an 8.5-hour sleep opportunity and sets no minimum total sleep time.",
        "unit": "h",
    },
    "Stress": {
        "metric_key": "stress_index",
        "aggregation": "latest",
        "status": "monitored",
        "bands": {"greenMin": 0, "greenMax": 40, "yellowMin": 0, "yellowMax": 70, "redBelow": 0, "redAbove": 70},
        "band_label": "App screening band. NASA tracks stress as a trend with no numeric limit; this band is an app default for early warning.",
        "unit": "index",
    },
    "Exercise dose": {
        "metric_key": "active_minutes",
        "aggregation": "avg_7d",
        "status": "monitored",
        "bands": {"greenMin": 90, "greenMax": 240, "yellowMin": 60, "yellowMax": 240, "redBelow": 60, "redAbove": 240},
        "band_label": "ISS practice is about 1.5 hours per day, 6-7 days per week. Band applied to the 7-day average of watch active minutes.",
        "unit": "min/day",
    },
    "Mood": {
        "metric_key": "mood",
        "aggregation": "avg_7d_mood",
        "status": "monitored",
        "bands": {"greenMin": 3.5, "greenMax": 5, "yellowMin": 2.5, "yellowMax": 5, "redBelow": 2.5, "redAbove": 5},
        "band_label": "App screening band for sustained low mood over the last 7 days on the 1-5 check-in scale. NASA sets no numeric limit; compare with the personal baseline.",
        "unit": "1-5",
    },
}

# Numeric standards that exist in the file but have no live data source yet.
STANDARD_KEYS = {
    "Light exposure at the eye",
    "Aerobic capacity (VO2max)",
    "Muscle strength",
    "Bone mineral density",
    "Fluid intake",
    "Work/rest schedule",
    "Water availability and quality",
}


def slugify(text: str) -> str:
    text = re.sub(r"\(.*?\)", "", text)
    text = re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_").lower()
    return re.sub(r"_+", "_", text)


def main(path: str) -> None:
    src = Path(path)
    rows = list(csv.DictReader(src.open(encoding="utf-8-sig")))
    if len(rows) < 40:
        raise SystemExit(f"Expected the full guideline file, found {len(rows)} rows")

    out = []
    seen = set()
    for r in rows:
        name = r["Parameter"].strip()
        domain_label = r["Habit domain"].strip()
        pid = slugify(name)
        if pid in seen:
            pid = f"{slugify(domain_label)}_{pid}"
        seen.add(pid)

        curated = CURATED.get(name, {})
        status = curated.get("status")
        if not status:
            status = "standard" if name in STANDARD_KEYS else "trend"
        if domain_label == "Symptoms":
            status = "report"

        out.append(
            {
                "parameterId": pid,
                "domain": DOMAIN_MAP.get(domain_label, slugify(domain_label)),
                "domainLabel": domain_label,
                "name": name,
                "whatToTrack": r["What to track"].strip(),
                "targetText": r["Target / threshold"].strip(),
                "thresholdBasis": r["Threshold basis"].strip(),
                "monitoringSource": r["Monitoring source"].strip(),
                "cadence": r["Cadence"].strip(),
                "relatedRisks": r["Related risk(s)"].strip(),
                "countermeasures": r["Related countermeasure(s)"].strip(),
                "consequence": r["Issue / consequence if out of range"].strip(),
                "operationalImpact": r["Operational impact"].strip(),
                "notes": r["Notes"].strip(),
                "dateRetrieved": r["Date retrieved"].strip(),
                "status": status,
                "metricKey": curated.get("metric_key"),
                "aggregation": curated.get("aggregation"),
                "bandLabel": curated.get("band_label"),
                "unit": curated.get("unit"),
                "bands": curated.get("bands"),
            }
        )

    target = Path("db/reference_parameters.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({"version": 1, "source": src.name, "parameters": out}, indent=2) + "\n")
    monitored = sum(1 for p in out if p["status"] == "monitored")
    print(f"wrote {len(out)} parameters to {target} ({monitored} live-monitored)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "db/source/habit_domain_parameters.csv")
