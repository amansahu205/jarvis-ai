#!/usr/bin/env python3
"""
EDA validation for PharmaGuard logistics source datasets.

Checks:
1) Null coordinates in world_airports.csv and UpdatedPub150.csv.
2) Coordinate range validity: lat in [-90, 90], lon in [-180, 180].
3) Orphaned aviation routes in routes.csv where src/dst IATA is not in airports.

Usage:
  python backend/scripts/eda_logistics_datasets.py --data-dir "D:/.../jarvis-ai/data"
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, dtype=str, keep_default_na=False)


def _to_num(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def _range_violations(df: pd.DataFrame, lat_col: str, lon_col: str) -> pd.DataFrame:
    work = df.copy()
    work[lat_col] = _to_num(work[lat_col])
    work[lon_col] = _to_num(work[lon_col])

    bad = work[
        (work[lat_col].notna() & ((work[lat_col] < -90) | (work[lat_col] > 90)))
        | (work[lon_col].notna() & ((work[lon_col] < -180) | (work[lon_col] > 180)))
    ].copy()
    return bad


def run_eda(data_dir: Path) -> dict:
    airports = _read_csv(data_dir / "world_airports.csv")
    seaports = _read_csv(data_dir / "UpdatedPub150.csv")
    routes = _read_csv(data_dir / "routes.csv")

    airports["iata_code"] = airports["iata_code"].str.strip().str.upper()
    routes["src_iata"] = routes["src_iata"].str.strip().str.upper()
    routes["dst_iata"] = routes["dst_iata"].str.strip().str.upper()

    airports_null_coords = airports[
        (_to_num(airports["latitude"]).isna()) | (_to_num(airports["longitude"]).isna())
    ]

    seaports_null_coords = seaports[
        (_to_num(seaports["Latitude"]).isna()) | (_to_num(seaports["Longitude"]).isna())
    ]

    airports_bad_ranges = _range_violations(airports, "latitude", "longitude")
    seaports_bad_ranges = _range_violations(seaports, "Latitude", "Longitude")

    airport_iata_set = set(airports["iata_code"][airports["iata_code"].str.len() == 3])
    orphan_src = ~routes["src_iata"].isin(airport_iata_set)
    orphan_dst = ~routes["dst_iata"].isin(airport_iata_set)
    orphaned_routes = routes[orphan_src | orphan_dst].copy()

    summary = {
        "rows": {
            "world_airports": int(len(airports)),
            "updatedpub150": int(len(seaports)),
            "routes": int(len(routes)),
        },
        "null_coordinates": {
            "world_airports": int(len(airports_null_coords)),
            "updatedpub150": int(len(seaports_null_coords)),
        },
        "invalid_coordinate_ranges": {
            "world_airports": int(len(airports_bad_ranges)),
            "updatedpub150": int(len(seaports_bad_ranges)),
        },
        "orphaned_routes": {
            "count": int(len(orphaned_routes)),
            "src_orphans": int(orphan_src.sum()),
            "dst_orphans": int(orphan_dst.sum()),
        },
    }

    out_dir = data_dir / "eda_reports"
    out_dir.mkdir(parents=True, exist_ok=True)

    airports_null_coords.to_csv(out_dir / "airports_null_coordinates.csv", index=False)
    seaports_null_coords.to_csv(out_dir / "seaports_null_coordinates.csv", index=False)
    airports_bad_ranges.to_csv(out_dir / "airports_invalid_coordinate_ranges.csv", index=False)
    seaports_bad_ranges.to_csv(out_dir / "seaports_invalid_coordinate_ranges.csv", index=False)
    orphaned_routes.to_csv(out_dir / "routes_orphaned_iata.csv", index=False)

    with (out_dir / "eda_summary.json").open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run EDA validation on logistics source files")
    parser.add_argument("--data-dir", default=None, help="Path containing logistics source files")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    default_data_dir = Path(__file__).resolve().parents[2] / "data"
    data_dir = Path(args.data_dir) if args.data_dir else default_data_dir
    if not data_dir.exists():
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    summary = run_eda(data_dir)
    print(json.dumps(summary, indent=2))
    print(f"EDA reports written to: {data_dir / 'eda_reports'}")


if __name__ == "__main__":
    main()
