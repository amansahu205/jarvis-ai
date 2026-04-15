#!/usr/bin/env python3
"""
Bulk migration for PharmaGuard logistics datasets into Supabase Postgres/PostGIS.

Loads:
- world_airports.csv         -> airports
- UpdatedPub150.csv          -> seaports
- airlines.csv               -> airlines
- routes.csv                 -> routes (aviation edge attributes)
- Shipping_Lanes_v1.geojson  -> maritime_lanes

Requirements:
  pip install pandas geopandas sqlalchemy psycopg2-binary python-dotenv shapely

Usage:
  python backend/scripts/migrate_logistics_to_supabase.py \
    --database-url "$DATABASE_URL" \
    --data-dir "D:/MS/UMD/Courses/Spring-2026/Agentic-AI/jarvis-ai/data"

If --database-url is omitted, the script reads DATABASE_URL from backend/.env.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Iterable
from urllib.parse import quote_plus

import geopandas as gpd
import pandas as pd
from dotenv import load_dotenv
from shapely.geometry import LineString, MultiLineString
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


def _build_sync_sqlalchemy_url(raw_url: str) -> str:
    """
    Convert postgresql+asyncpg URL into a psycopg2 SQLAlchemy URL.

    This parser intentionally uses rsplit("@", 1) so passwords containing '@'
    are handled correctly.
    """
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


def _read_csv(path: Path) -> pd.DataFrame:
    # Keep all values as string initially to avoid accidental dtype coercion.
    return pd.read_csv(path, dtype=str, keep_default_na=False)


def _to_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def _normalize_airports(df: pd.DataFrame) -> pd.DataFrame:
    required = ["iata_code", "airport", "city", "state", "country", "latitude", "longitude"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"world_airports.csv missing columns: {missing}")

    out = df[required].copy()
    out["iata_code"] = out["iata_code"].str.strip().str.upper()
    out = out[(out["iata_code"] != "") & (out["iata_code"] != "\\N")]
    out = out[out["iata_code"].str.len() == 3]
    out["latitude"] = _to_numeric(out["latitude"])
    out["longitude"] = _to_numeric(out["longitude"])
    out = out.drop_duplicates(subset=["iata_code"], keep="first")
    return out


def _normalize_seaports(df: pd.DataFrame) -> pd.DataFrame:
    # UpdatedPub150.csv headers observed in the dataset.
    mapping = {
        "UN/LOCODE": "un_code",
        "Main Port Name": "port_name",
        "Country Code": "country",
        "Region Name": "area_global",
        "World Water Body": "area_local",
        "Latitude": "latitude",
        "Longitude": "longitude",
    }

    missing = [k for k in mapping if k not in df.columns]
    if missing:
        raise ValueError(f"UpdatedPub150.csv missing columns: {missing}")

    out = df[list(mapping.keys())].rename(columns=mapping)
    out["un_code"] = out["un_code"].str.strip().str.upper()
    out["port_name"] = out["port_name"].str.strip()
    out["country"] = out["country"].str.strip().str.upper()

    out = out[(out["un_code"] != "") & (out["un_code"] != "\\N")]
    out = out[out["port_name"] != ""]

    out["latitude"] = _to_numeric(out["latitude"])
    out["longitude"] = _to_numeric(out["longitude"])
    out = out.drop_duplicates(subset=["un_code"], keep="first")
    return out


def _normalize_airlines(df: pd.DataFrame) -> pd.DataFrame:
    expected = [
        "airline_id",
        "airline_name",
        "alias",
        "iata_code",
        "icao_code",
        "callsign",
        "country",
        "active",
    ]
    missing = [c for c in expected if c not in df.columns]
    if missing:
        raise ValueError(f"airlines.csv missing columns: {missing}")

    out = df[expected].copy()
    out = out.replace("\\N", None)
    out["airline_id"] = pd.to_numeric(out["airline_id"], errors="coerce")
    out["iata_code"] = out["iata_code"].str.strip().str.upper()
    out["icao_code"] = out["icao_code"].str.strip().str.upper()
    return out


def _normalize_routes(df: pd.DataFrame) -> pd.DataFrame:
    expected = [
        "airline_iata",
        "airline_name",
        "airline_country",
        "src_iata",
        "src_airport",
        "src_city",
        "src_country",
        "src_lat",
        "src_lon",
        "dst_iata",
        "dst_airport",
        "dst_city",
        "dst_country",
        "dst_lat",
        "dst_lon",
        "codeshare",
        "stops",
        "equipment",
        "distance_km",
    ]
    missing = [c for c in expected if c not in df.columns]
    if missing:
        raise ValueError(f"routes.csv missing columns: {missing}")

    out = df[expected].copy()
    out["src_iata"] = out["src_iata"].str.strip().str.upper()
    out["dst_iata"] = out["dst_iata"].str.strip().str.upper()
    out["airline_iata"] = out["airline_iata"].str.strip().str.upper()
    out["stops"] = pd.to_numeric(out["stops"], errors="coerce")
    out["distance_km"] = pd.to_numeric(out["distance_km"].str.strip(), errors="coerce")

    out = out[(out["src_iata"].str.len() == 3) & (out["dst_iata"].str.len() == 3)]
    out = out.drop_duplicates(subset=["airline_iata", "src_iata", "dst_iata", "equipment"], keep="first")
    return out


def _to_multilinestring(geom):
    if geom is None:
        return None
    if isinstance(geom, MultiLineString):
        return geom
    if isinstance(geom, LineString):
        return MultiLineString([geom])
    return None


def _normalize_maritime_lanes(path: Path) -> pd.DataFrame:
    gdf = gpd.read_file(path)
    if gdf.empty:
        raise ValueError("Shipping_Lanes_v1.geojson is empty")

    if gdf.crs is None:
        gdf = gdf.set_crs(epsg=4326)
    else:
        gdf = gdf.to_crs(epsg=4326)

    gdf["geometry"] = gdf["geometry"].apply(_to_multilinestring)
    gdf = gdf[gdf["geometry"].notna()].copy()

    def _lane_name(row) -> str:
        for key in ["name", "Name", "route_name", "Type", "type"]:
            if key in row and row[key] not in (None, ""):
                return str(row[key])
        return "maritime_lane"

    def _properties_json(row) -> str:
        payload = {}
        for col in gdf.columns:
            if col == "geometry":
                continue
            val = row.get(col)
            if pd.isna(val):
                continue
            payload[col] = val
        return json.dumps(payload)

    out = pd.DataFrame(
        {
            "lane_name": gdf.apply(_lane_name, axis=1),
            "properties": gdf.apply(_properties_json, axis=1),
            "wkt": gdf["geometry"].apply(lambda x: x.wkt),
        }
    )
    return out


def _execute_many(conn, statements: Iterable[str]) -> None:
    for stmt in statements:
        conn.execute(text(stmt))


def _ensure_base_schema(engine: Engine) -> None:
    ddl = [
        "CREATE EXTENSION IF NOT EXISTS postgis;",
        "ALTER TABLE public.airports ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(POINT, 4326);",
        "ALTER TABLE public.seaports ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(POINT, 4326);",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_iata TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_iata TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS airline_iata TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS airline_name TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS airline_country TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_airport TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_city TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_country TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_lat NUMERIC;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_lon NUMERIC;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_airport TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_city TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_country TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_lat NUMERIC;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_lon NUMERIC;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS codeshare TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS stops INT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS equipment TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS distance_km NUMERIC;",
        "CREATE TABLE IF NOT EXISTS public.airlines ("
        "airline_id BIGINT PRIMARY KEY,"
        "airline_name TEXT,"
        "alias TEXT,"
        "iata_code TEXT,"
        "icao_code TEXT,"
        "callsign TEXT,"
        "country TEXT,"
        "active TEXT"
        ");",
        "CREATE TABLE IF NOT EXISTS public.maritime_lanes ("
        "id BIGSERIAL PRIMARY KEY,"
        "lane_name TEXT,"
        "properties JSONB DEFAULT '{}'::jsonb,"
        "geom GEOGRAPHY(MULTILINESTRING, 4326),"
        "source TEXT DEFAULT 'Shipping_Lanes_v1.geojson',"
        "created_at TIMESTAMPTZ DEFAULT now()"
        ");",
    ]

    fk_src = """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'routes_src_iata_fkey'
        ) THEN
            ALTER TABLE public.routes
            ADD CONSTRAINT routes_src_iata_fkey
            FOREIGN KEY (src_iata)
            REFERENCES public.airports(iata_code)
            NOT VALID;
        END IF;
    END $$;
    """

    fk_dst = """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'routes_dst_iata_fkey'
        ) THEN
            ALTER TABLE public.routes
            ADD CONSTRAINT routes_dst_iata_fkey
            FOREIGN KEY (dst_iata)
            REFERENCES public.airports(iata_code)
            NOT VALID;
        END IF;
    END $$;
    """

    with engine.begin() as conn:
        _execute_many(conn, ddl)
        conn.execute(text(fk_src))
        conn.execute(text(fk_dst))


def _upsert_airports(engine: Engine, df: pd.DataFrame) -> None:
    df.to_sql("stg_airports", engine, schema="public", if_exists="replace", index=False, method="multi", chunksize=5000)

    sql = """
    INSERT INTO public.airports (iata_code, airport, city, state, country, latitude, longitude)
    SELECT iata_code, airport, city, state, country, latitude, longitude
    FROM public.stg_airports
    ON CONFLICT (iata_code) DO UPDATE
    SET airport = EXCLUDED.airport,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        country = EXCLUDED.country,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude;

    UPDATE public.airports
    SET geom = ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

    DROP TABLE IF EXISTS public.stg_airports;
    """

    with engine.begin() as conn:
        conn.execute(text(sql))


def _upsert_seaports(engine: Engine, df: pd.DataFrame) -> None:
    df.to_sql("stg_seaports", engine, schema="public", if_exists="replace", index=False, method="multi", chunksize=5000)

    sql = """
    INSERT INTO public.seaports (un_code, port_name, country, area_local, area_global)
    SELECT un_code, port_name, country, area_local, area_global
    FROM public.stg_seaports
    ON CONFLICT (un_code) DO UPDATE
    SET port_name = EXCLUDED.port_name,
        country = EXCLUDED.country,
        area_local = EXCLUDED.area_local,
        area_global = EXCLUDED.area_global;

    UPDATE public.seaports s
    SET geom = ST_SetSRID(ST_MakePoint(st.longitude::double precision, st.latitude::double precision), 4326)::geography
    FROM public.stg_seaports st
    WHERE s.un_code = st.un_code
      AND st.latitude IS NOT NULL
      AND st.longitude IS NOT NULL;

    DROP TABLE IF EXISTS public.stg_seaports;
    """

    with engine.begin() as conn:
        conn.execute(text(sql))


def _upsert_airlines(engine: Engine, df: pd.DataFrame) -> None:
    df.to_sql("stg_airlines", engine, schema="public", if_exists="replace", index=False, method="multi", chunksize=5000)

    sql = """
    INSERT INTO public.airlines (airline_id, airline_name, alias, iata_code, icao_code, callsign, country, active)
    SELECT airline_id::bigint, airline_name, alias, iata_code, icao_code, callsign, country, active
    FROM public.stg_airlines
    WHERE airline_id IS NOT NULL
    ON CONFLICT (airline_id) DO UPDATE
    SET airline_name = EXCLUDED.airline_name,
        alias = EXCLUDED.alias,
        iata_code = EXCLUDED.iata_code,
        icao_code = EXCLUDED.icao_code,
        callsign = EXCLUDED.callsign,
        country = EXCLUDED.country,
        active = EXCLUDED.active;

    DROP TABLE IF EXISTS public.stg_airlines;
    """

    with engine.begin() as conn:
        conn.execute(text(sql))


def _reload_aviation_routes(engine: Engine, df: pd.DataFrame) -> None:
    df.to_sql("stg_routes", engine, schema="public", if_exists="replace", index=False, method="multi", chunksize=5000)

    sql = """
    DELETE FROM public.routes
    WHERE src_iata IS NOT NULL OR dst_iata IS NOT NULL;

    INSERT INTO public.routes (
        origin,
        destination,
        transit_mode,
        cargo_type,
        waypoints,
        src_iata,
        dst_iata,
        airline_iata,
        airline_name,
        airline_country,
        src_airport,
        src_city,
        src_country,
        src_lat,
        src_lon,
        dst_airport,
        dst_city,
        dst_country,
        dst_lat,
        dst_lon,
        codeshare,
        stops,
        equipment,
        distance_km
    )
    SELECT
        sr.src_iata AS origin,
        sr.dst_iata AS destination,
        'air'::transit_mode AS transit_mode,
        NULL::text AS cargo_type,
        '[]'::jsonb AS waypoints,
        sr.src_iata,
        sr.dst_iata,
        sr.airline_iata,
        sr.airline_name,
        sr.airline_country,
        sr.src_airport,
        sr.src_city,
        sr.src_country,
        sr.src_lat::numeric,
        sr.src_lon::numeric,
        sr.dst_airport,
        sr.dst_city,
        sr.dst_country,
        sr.dst_lat::numeric,
        sr.dst_lon::numeric,
        sr.codeshare,
        sr.stops::int,
        sr.equipment,
        sr.distance_km::numeric
    FROM public.stg_routes sr
    JOIN public.airports a_src ON a_src.iata_code = sr.src_iata
    JOIN public.airports a_dst ON a_dst.iata_code = sr.dst_iata;

    DROP TABLE IF EXISTS public.stg_routes;

    ALTER TABLE public.routes VALIDATE CONSTRAINT routes_src_iata_fkey;
    ALTER TABLE public.routes VALIDATE CONSTRAINT routes_dst_iata_fkey;
    """

    with engine.begin() as conn:
        conn.execute(text(sql))


def _reload_maritime_lanes(engine: Engine, df: pd.DataFrame) -> None:
    df.to_sql("stg_maritime_lanes", engine, schema="public", if_exists="replace", index=False, method="multi", chunksize=2000)

    sql = """
    TRUNCATE TABLE public.maritime_lanes;

    INSERT INTO public.maritime_lanes (lane_name, properties, geom, source)
    SELECT
        lane_name,
        properties::jsonb,
        ST_SetSRID(ST_GeomFromText(wkt), 4326)::geography(MULTILINESTRING, 4326),
        'Shipping_Lanes_v1.geojson'
    FROM public.stg_maritime_lanes
    WHERE wkt IS NOT NULL;

    DROP TABLE IF EXISTS public.stg_maritime_lanes;
    """

    with engine.begin() as conn:
        conn.execute(text(sql))


def _create_indexes(engine: Engine) -> None:
    idx_sql = [
        "CREATE INDEX IF NOT EXISTS idx_airports_geom_gist ON public.airports USING GIST (geom);",
        "CREATE INDEX IF NOT EXISTS idx_seaports_geom_gist ON public.seaports USING GIST (geom);",
        "CREATE INDEX IF NOT EXISTS idx_maritime_lanes_geom_gist ON public.maritime_lanes USING GIST (geom);",
        "CREATE INDEX IF NOT EXISTS idx_routes_src_iata ON public.routes (src_iata);",
        "CREATE INDEX IF NOT EXISTS idx_routes_dst_iata ON public.routes (dst_iata);",
        "CREATE INDEX IF NOT EXISTS idx_routes_airline_iata ON public.routes (airline_iata);",
    ]
    with engine.begin() as conn:
        _execute_many(conn, idx_sql)


def run_migration(database_url: str, data_dir: Path) -> None:
    engine = create_engine(_build_sync_sqlalchemy_url(database_url), future=True)

    airports_df = _normalize_airports(_read_csv(data_dir / "world_airports.csv"))
    seaports_df = _normalize_seaports(_read_csv(data_dir / "UpdatedPub150.csv"))
    airlines_df = _normalize_airlines(_read_csv(data_dir / "airlines.csv"))
    routes_df = _normalize_routes(_read_csv(data_dir / "routes.csv"))
    lanes_df = _normalize_maritime_lanes(data_dir / "Shipping_Lanes_v1.geojson")

    _ensure_base_schema(engine)
    _upsert_airports(engine, airports_df)
    _upsert_seaports(engine, seaports_df)
    _upsert_airlines(engine, airlines_df)
    _reload_aviation_routes(engine, routes_df)
    _reload_maritime_lanes(engine, lanes_df)
    _create_indexes(engine)

    with engine.begin() as conn:
        counts = conn.execute(
            text(
                """
                SELECT
                    (SELECT COUNT(*) FROM public.airports) AS airports_count,
                    (SELECT COUNT(*) FROM public.seaports) AS seaports_count,
                    (SELECT COUNT(*) FROM public.airlines) AS airlines_count,
                    (SELECT COUNT(*) FROM public.routes WHERE src_iata IS NOT NULL AND dst_iata IS NOT NULL) AS aviation_routes_count,
                    (SELECT COUNT(*) FROM public.maritime_lanes) AS maritime_lanes_count
                """
            )
        ).mappings().one()

    print("Migration completed.")
    print(dict(counts))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate logistics data to Supabase/PostGIS")
    parser.add_argument("--database-url", default=None, help="Supabase Postgres connection URL")
    parser.add_argument("--data-dir", default=None, help="Path containing CSV/GeoJSON logistics files")
    return parser.parse_args()


def main() -> None:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")

    args = parse_args()
    database_url = args.database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not provided. Use --database-url or set it in backend/.env")

    default_data_dir = Path(__file__).resolve().parents[2] / "data"
    data_dir = Path(args.data_dir) if args.data_dir else default_data_dir
    if not data_dir.exists():
        raise FileNotFoundError(f"Data directory does not exist: {data_dir}")

    run_migration(database_url=database_url, data_dir=data_dir)


if __name__ == "__main__":
    main()
