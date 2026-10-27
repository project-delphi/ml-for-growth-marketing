"""Build compact, aggregate inputs for the customer interactive pages.

Requires the checksum-verified CDNOW cache populated by mktstats.data.load_cdnow.
The checked-in JSON is an aggregate teaching extract; no raw CDNOW rows are shipped.
"""

from __future__ import annotations

import csv
import hashlib
import json
from collections import defaultdict
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CDNOW = Path.home() / ".cache/mktstats/cdnow_transactions.csv"
CDNOW_SHA256 = "7311ae0fb676e9f454bba310b10bc769b1a6838aeec09bd00175eb49481dddac"
OUT = Path(__file__).with_name("customer-data.json")
CUTOFF = date(1997, 9, 30)
END = date(1998, 6, 30)
CAL = date(2024, 12, 29)
HOLD = date(2025, 3, 30)

assert hashlib.sha256(CDNOW.read_bytes()).hexdigest() == CDNOW_SHA256, "CDNOW cache checksum differs from the pinned source"


def read_csv(path):
    with path.open(newline="") as file:
        yield from csv.DictReader(file)


by_customer = defaultdict(list)
for row in read_csv(CDNOW):
    when = date.fromisoformat(f"{row['date'][:4]}-{row['date'][4:6]}-{row['date'][6:8]}")
    by_customer[row["id"]].append((when, float(row["spent"])))

fbins = [0, 1, 2, 4, 8]
sbins = [0, 4, 12, 24, 40]
cells = defaultdict(lambda: [0, 0, 0, 0.0, 0.0, 0.0])
total_no_repeat = 0
for purchases in by_customer.values():
    purchases.sort()
    cal_days = sorted({day for day, _ in purchases if day <= CUTOFF})
    if not cal_days:
        continue
    x = len(cal_days) - 1
    silence = (CUTOFF - cal_days[-1]).days / 7
    holdout = sum(1 for day in {day for day, _ in purchases} if CUTOFF < day <= END)
    fi = max(i for i, edge in enumerate(fbins) if x >= edge)
    si = max(i for i, edge in enumerate(sbins) if silence >= edge)
    cell = cells[(fi, si)]
    cell[0] += 1
    cell[1] += holdout
    cell[2] += int(x == 0)
    cell[3] += x
    cell[4] += (CUTOFF - cal_days[0]).days / 7
    cell[5] += (cal_days[-1] - cal_days[0]).days / 7
    total_no_repeat += int(x == 0)

customer_rows = list(read_csv(ROOT / "data/synthetic/retailer_customers.csv"))
tx_rows = list(read_csv(ROOT / "data/synthetic/retailer_transactions.csv"))
future = defaultdict(int)
for row in tx_rows:
    when = date.fromisoformat(row["date"])
    if CAL < when <= HOLD:
        future[row["customer_id"]] += 1

channels = defaultdict(lambda: [0, 0, 0, 0, 0, 0])
for row in customer_rows:
    group = channels[row["acquisition_channel"]]
    group[0] += 1
    group[1] += float(row["true_lambda"])
    group[2] += float(row["true_mu"])
    group[3] += float(row["true_mean_spend"])
    group[4] += future[row["customer_id"]]
    group[5] += int(row["true_alive_at_cal_end"])

payload = {
    "provenance": {
        "cdnow": "PyMC-Marketing 1.2.0 checksum-verified CDNOW transaction cache; grouped by distinct purchase days through 1997-09-30, holdout through 1998-06-30. Source and SHA-256: data/README.md.",
        "retailer": "Seeded workshop synthetic retailer, data/synthetic/retailer_customers.csv and retailer_transactions.csv; known generator rates are used only to explain mechanisms.",
    },
    "cdnow": {
        "customers": sum(v[0] for v in cells.values()),
        "noRepeat": total_no_repeat,
        "frequencyLabels": ["0", "1", "2–3", "4–7", "8+"],
        "silenceLabels": ["0–4", "4–12", "12–24", "24–40", "40+"],
        "cells": [
            {"f": f, "s": s, "n": v[0], "holdout": v[1],
             "x": v[3] / v[0], "T": v[4] / v[0], "tx": v[5] / v[0]}
            for (f, s), v in sorted(cells.items())
        ],
    },
    "retailer": {
        channel: {
            "n": values[0],
            "lambda": values[1] / values[0],
            "mu": values[2] / values[0],
            "spend": values[3] / values[0],
            "holdout13": values[4] / values[0],
            "alive": values[5],
        }
        for channel, values in sorted(channels.items())
    },
}
OUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
print(f"Wrote {OUT}")
