#!/usr/bin/env python3
"""
Process World Bank geopolitical/customs datasets and upsert country risk profiles.

Inputs (after rename):
- data/Worldwide_Governance_Indicators/raw_political_stability.csv
- data/World_Development_Indicators/raw_customs_performance.csv

Rules:
- Political Stability source series: GOV_WGI_PV.SC
  Uses most recent available from 2024 then 2023.
  Converts score to risk: political_stability_risk = 100 - governance_score

- Customs Efficiency source series: LP.LPI.CUST.XQ
  Uses most recent available from 2023 then 2022.
  Converts 1-5 score to risk:
    customs_complexity_risk = (1 - (score - 1) / 4) * 100

- Merge on ISO Alpha-3 country code.
- Missing customs risk is filled with available average or neutral 50.
- Upsert target table: public.country_risk_profiles
"""

from __future__ import annotations

import argparse
import csv
import math
import os
from pathlib import Path
from urllib.parse import quote_plus

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _build_sync_sqlalchemy_url(raw_url: str) -> str:
    if not raw_url:
        raise ValueError("DATABASE_URL is required")

    url = raw_url.strip()
    if url.startswith("postgresql+psycopg2://"):
        return url
    if url.startswith("postgresql://"):
        return url

    if not url.startswith("postgresql+asyncpg://"):
        raise ValueError(
            "Unsupported DATABASE_URL scheme. Expected postgresql+asyncpg:// or postgresql://"
        )

    without_scheme = url.split("://", 1)[1]
    userinfo, hostinfo = without_scheme.rsplit("@", 1)
    user, password = userinfo.split(":", 1)
    hostport, database = hostinfo.split("/", 1)
    host, port = hostport.rsplit(":", 1)

    encoded_user = quote_plus(user)
    encoded_password = quote_plus(password)
    return f"postgresql+psycopg2://{encoded_user}:{encoded_password}@{host}:{port}/{database}"


def _to_float(value: str | None) -> float | None:
    if value is None:
        return None
    v = str(value).strip()
    if v in {"", "..", "NA", "N/A", "nan", "None"}:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _read_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        return [dict(row) for row in reader]


def _pick_recent(row: dict[str, str], year_columns: list[str]) -> float | None:
    for col in year_columns:
        parsed = _to_float(row.get(col))
        if parsed is not None:
            return parsed
    return None


def _prepare_political(rows: list[dict[str, str]]) -> dict[str, float]:
    out: dict[str, float] = {}
    for row in rows:
        if row.get("Series Code") != "GOV_WGI_PV.SC":
            continue
        code = (row.get("Country Code") or "").strip().upper()
        if len(code) != 3:
            continue

        governance_score = _pick_recent(row, ["2024 [YR2024]", "2023 [YR2023]"])
        if governance_score is None:
            continue

        risk = max(0.0, min(100.0, 100.0 - governance_score))
        if code not in out:
            out[code] = round(risk, 4)
    return out


def _prepare_customs(rows: list[dict[str, str]]) -> dict[str, float]:
    out: dict[str, float] = {}
    for row in rows:
        if row.get("Series Code") != "LP.LPI.CUST.XQ":
            continue
        code = (row.get("Country Code") or "").strip().upper()
        if len(code) != 3:
            continue

        score = _pick_recent(row, ["2023 [YR2023]", "2022 [YR2022]"])
        if score is None:
            continue

        risk = (1.0 - ((score - 1.0) / 4.0)) * 100.0
        risk = max(0.0, min(100.0, risk))
        if code not in out:
            out[code] = round(risk, 4)
    return out


def _merge_profiles(
    political: dict[str, float], customs: dict[str, float]
) -> tuple[list[dict[str, float | str]], dict[str, int | float]]:
    customs_values = list(customs.values())
    customs_avg = sum(customs_values) / len(customs_values) if customs_values else 50.0
    if math.isnan(customs_avg):
        customs_avg = 50.0

    merged: list[dict[str, float | str]] = []
    missing_customs_filled = 0

    for code, political_risk in political.items():
        customs_risk = customs.get(code)
        if customs_risk is None:
            missing_customs_filled += 1
            customs_risk = customs_avg

        merged.append(
            {
                "country_code": code,
                "political_stability": round(float(political_risk), 4),
                "customs_complexity": round(float(customs_risk), 4),
            }
        )

    stats: dict[str, int | float] = {
        "political_rows": len(political),
        "customs_rows": len(customs),
        "merged_rows": len(merged),
        "missing_customs_filled": missing_customs_filled,
        "customs_fallback_value": round(customs_avg, 4),
    }
    return merged, stats


def _ensure_target_table(engine: Engine) -> None:
    ddl = """
    CREATE TABLE IF NOT EXISTS public.country_risk_profiles (
        country_code TEXT PRIMARY KEY,
        political_stability DOUBLE PRECISION NOT NULL,
        customs_complexity DOUBLE PRECISION NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """
    with engine.begin() as conn:
        conn.execute(text(ddl))


def _upsert_profiles(engine: Engine, merged_profiles: list[dict[str, float | str]]) -> int:
    if not merged_profiles:
        return 0

    upsert = text(
        """
        INSERT INTO public.country_risk_profiles (
            country_code,
            political_stability,
            customs_complexity,
            updated_at
        ) VALUES (
            :country_code,
            :political_stability,
            :customs_complexity,
            now()
        )
        ON CONFLICT (country_code) DO UPDATE
        SET political_stability = EXCLUDED.political_stability,
            customs_complexity = EXCLUDED.customs_complexity,
            updated_at = now();
        """
    )

    with engine.begin() as conn:
        conn.execute(upsert, merged_profiles)

    return len(merged_profiles)


def _default_data_dir(repo_root: Path) -> Path:
    return repo_root / "data"


def main() -> None:
    parser = argparse.ArgumentParser(description="Build and upsert country risk profiles from World Bank datasets")
    parser.add_argument("--data-dir", type=str, default="", help="Path to repo data directory")
    parser.add_argument("--database-url", type=str, default="", help="Override DATABASE_URL")
    parser.add_argument("--dry-run", action="store_true", help="Process and print summary without DB upsert")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    backend_dir = script_dir.parent
    repo_root = backend_dir.parent

    _load_env_file(backend_dir / ".env")

    data_dir = Path(args.data_dir) if args.data_dir else _default_data_dir(repo_root)

    political_path = data_dir / "Worldwide_Governance_Indicators" / "raw_political_stability.csv"
    customs_path = data_dir / "World_Development_Indicators" / "raw_customs_performance.csv"

    if not political_path.exists():
        raise FileNotFoundError(f"Political dataset not found: {political_path}")
    if not customs_path.exists():
        raise FileNotFoundError(f"Customs dataset not found: {customs_path}")

    political_rows = _read_rows(political_path)
    customs_rows = _read_rows(customs_path)

    political = _prepare_political(political_rows)
    customs = _prepare_customs(customs_rows)
    profiles, stats = _merge_profiles(political, customs)

    migrated = 0
    if not args.dry_run:
        database_url = args.database_url or os.getenv("DATABASE_URL", "")
        sync_url = _build_sync_sqlalchemy_url(database_url)
        engine = create_engine(sync_url)

        _ensure_target_table(engine)
        migrated = _upsert_profiles(engine, profiles)

    print("Country Risk Profile Migration Summary")
    print("-------------------------------------")
    print(f"Political rows prepared: {stats['political_rows']}")
    print(f"Customs rows prepared: {stats['customs_rows']}")
    print(f"Merged profiles: {stats['merged_rows']}")
    print(f"Missing customs filled: {stats['missing_customs_filled']}")
    print(f"Customs fallback value used: {stats['customs_fallback_value']}")
    if args.dry_run:
        print("Dry run enabled: no database write performed.")
    else:
        print(f"Countries successfully migrated: {migrated}")


if __name__ == "__main__":
    main()
