"""Build compact browser data from the committed workshop datasets.

Run from the repository root: python3 interactives/causal-assets/build_data.py
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "data.json"


def rows(path):
    with (ROOT / path).open(newline="") as handle:
        return list(csv.DictReader(handle))


truth = json.loads((ROOT / "data/synthetic/truth.json").read_text())
email = rows("data/synthetic/email_experiment.csv")
arms = {}
for arm in (0, 1):
    values = [float(r["spend"]) for r in email if int(r["treatment"]) == arm]
    mean = sum(values) / len(values)
    sd = (sum((x - mean) ** 2 for x in values) / (len(values) - 1)) ** 0.5
    arms[str(arm)] = {"n": len(values), "mean": mean, "sd": sd}

prop = rows("data/real/prop99.csv")
by_year = defaultdict(dict)
for row in prop:
    by_year[int(row["year"])][row["state"]] = float(row["cigsale"])
states = ["California", "Nevada", "Utah", "Colorado", "Idaho"]
prop_series = {
    state: [by_year[y].get(state) for y in range(1970, 2001)] for state in states
}

mmm = rows("data/synthetic/mmm_weekly.csv")
conf = rows("data/synthetic/mmm_confounded_weekly.csv")
channels = ["tv", "search", "social", "display"]
payload = {
    "experiment": {"arms": arms, "truth": truth["email_experiment"]},
    "prop99": {"years": list(range(1970, 2001)), "series": prop_series},
    "mmm": {
        "weeks": [r["date_week"] for r in mmm],
        "sales": [float(r["y"]) for r in mmm],
        "spend": {c: [float(r[c]) for r in mmm] for c in channels},
        "channels": truth["mmm"]["channels"],
        "allocation": truth["mmm"]["true_optimal_allocation"],
        "value": truth["channel_value"],
    },
    "confounded": {
        "weeks": [r["date_week"] for r in conf],
        "sales": [float(r["y"]) for r in conf],
        "spend": {c: [float(r[c]) for r in conf] for c in channels},
        "channels": truth["mmm_confounded"]["channels"],
        "tests": rows("data/synthetic/mmm_confounded_lift_tests.csv"),
    },
}
OUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
print(OUT.relative_to(ROOT))
