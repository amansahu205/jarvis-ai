#!/usr/bin/env python3
"""
Production ETL for PharmaGuard logistics datasets into Supabase + PostGIS.

Key outcomes:
- PostGIS enabled.
- Airports and seaports loaded with geom GEOGRAPHY(POINT, 4326).
- Routes loaded with geom GEOGRAPHY(LINESTRING, 4326), joined to airport coordinates.
- Maritime lanes loaded from GeoJSON into maritime_lanes with geom GEOGRAPHY(MULTILINESTRING, 4326).
- FK constraint routes.src_iata -> airports.iata_code.
- Spatial indexes created using GIST.

Usage:
  python backend/scripts/etl_logistics_spatial_supabase.py --data-dir "D:/.../jarvis-ai/data"

The script reads DATABASE_URL from backend/.env unless --database-url is supplied.
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


def _sync_sqlalchemy_url(raw_url: str) -> str:
    if not raw_url:
        raise ValueError("DATABASE_URL is required")

    url = raw_url.strip()
    if url.startswith("postgresql+psycopg2://") or url.startswith("postgresql://"):
        return url

    if not url.startswith("postgresql+asyncpg://"):
        raise ValueError("Expected DATABASE_URL to use postgresql+asyncpg:// or postgresql://")

    without_scheme = url.split("://", 1)[1]
    userinfo, hostinfo = without_scheme.rsplit("@", 1)
    user, password = userinfo.split(":", 1)
    hostport, database = hostinfo.split("/", 1)
    host, port = hostport.rsplit(":", 1)

    return (
        f"postgresql+psycopg2://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host}:{port}/{database}"
    )


def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, dtype=str, keep_default_na=False)


def _num(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def _normalize_airports(df: pd.DataFrame) -> pd.DataFrame:
    cols = ["iata_code", "airport", "city", "state", "country", "latitude", "longitude"]
    out = df[cols].copy()
    out["iata_code"] = out["iata_code"].str.strip().str.upper()
    out["latitude"] = _num(out["latitude"]).astype("float64")
    out["longitude"] = _num(out["longitude"]).astype("float64")
    out = out[(out["iata_code"].str.len() == 3) & (out["iata_code"] != "\\N")]
    out = out.drop_duplicates(subset=["iata_code"], keep="first")
    return out


def _normalize_seaports(df: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(
        {
            "un_locode": df["UN/LOCODE"].astype(str).str.strip().str.upper(),
            "name": df["Main Port Name"].astype(str).str.strip(),
            "country": df["Country Code"].astype(str).str.strip().str.upper(),
            "area_global": df["Region Name"].astype(str).str.strip(),
            "area_local": df["World Water Body"].astype(str).str.strip(),
            "harbor_size": df.get("Harbor Size", "").astype(str).str.strip(),
            "latitude": _num(df["Latitude"]).astype("float64"),
            "longitude": _num(df["Longitude"]).astype("float64"),
        }
    )
    out = out[(out["un_locode"] != "") & (out["un_locode"] != "\\N") & (out["name"] != "")]
    out = out.drop_duplicates(subset=["un_locode"], keep="first")
    return out


def _normalize_airlines(df: pd.DataFrame) -> pd.DataFrame:
    out = df[
        ["airline_id", "airline_name", "alias", "iata_code", "icao_code", "callsign", "country", "active"]
    ].copy()
    out = out.replace("\\N", None)
    out["airline_id"] = pd.to_numeric(out["airline_id"], errors="coerce")
    out["iata_code"] = out["iata_code"].str.strip().str.upper()
    out["icao_code"] = out["icao_code"].str.strip().str.upper()
    return out


def _normalize_routes(df: pd.DataFrame) -> pd.DataFrame:
    cols = [
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
    out = df[cols].copy()
    out["src_iata"] = out["src_iata"].str.strip().str.upper()
    out["dst_iata"] = out["dst_iata"].str.strip().str.upper()
    out["airline_iata"] = out["airline_iata"].str.strip().str.upper()
    out["stops"] = pd.to_numeric(out["stops"], errors="coerce").astype("Int64")
    out["distance_km"] = pd.to_numeric(out["distance_km"].str.strip(), errors="coerce").astype("float64")
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


def _normalize_maritime_gdf(path: Path) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(path)
    if gdf.empty:
        raise ValueError("Shipping_Lanes_v1.geojson is empty")

    if gdf.crs is None:
        gdf = gdf.set_crs(epsg=4326)
    else:
        gdf = gdf.to_crs(epsg=4326)

    gdf["geometry"] = gdf["geometry"].apply(_to_multilinestring)
    gdf = gdf[gdf["geometry"].notna()].copy()

    def lane_name(row) -> str:
        for k in ["name", "Name", "route_name", "Type", "type"]:
            if k in row and row[k] not in (None, ""):
                return str(row[k])
        return "maritime_lane"

    def as_props(row) -> str:
        payload = {}
        for col in gdf.columns:
            if col == "geometry":
                continue
            val = row.get(col)
            if pd.isna(val):
                continue
            payload[col] = val
        return json.dumps(payload)

    out = gpd.GeoDataFrame(
        {
            "lane_name": gdf.apply(lane_name, axis=1),
            "properties": gdf.apply(as_props, axis=1),
        },
        geometry=gdf.geometry,
        crs="EPSG:4326",
    )
    return out


def _execute_many(conn, statements: Iterable[str]) -> None:
    for stmt in statements:
        conn.execute(text(stmt))


def _ensure_schema(engine: Engine) -> None:
    ddl = [
        "CREATE EXTENSION IF NOT EXISTS postgis;",
        "ALTER TABLE public.airports ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(POINT, 4326);",
        "ALTER TABLE public.airports ALTER COLUMN latitude TYPE DOUBLE PRECISION USING latitude::double precision;",
        "ALTER TABLE public.airports ALTER COLUMN longitude TYPE DOUBLE PRECISION USING longitude::double precision;",
        "ALTER TABLE public.seaports ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(POINT, 4326);",
        "ALTER TABLE public.seaports ADD COLUMN IF NOT EXISTS name TEXT;",
        "ALTER TABLE public.seaports ADD COLUMN IF NOT EXISTS un_locode TEXT;",
        "ALTER TABLE public.seaports ADD COLUMN IF NOT EXISTS harbor_size TEXT;",
        "ALTER TABLE public.seaports ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;",
        "ALTER TABLE public.seaports ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_iata TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_iata TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(LINESTRING, 4326);",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS airline_iata TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS airline_name TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS airline_country TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_airport TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_city TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_country TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_lat DOUBLE PRECISION;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_lon DOUBLE PRECISION;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_airport TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_city TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_country TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_lat DOUBLE PRECISION;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_lon DOUBLE PRECISION;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS codeshare TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS stops INTEGER;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS equipment TEXT;",
        "ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION;",
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
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'routes_src_iata_fkey') THEN
        ALTER TABLE public.routes
        ADD CONSTRAINT routes_src_iata_fkey
        FOREIGN KEY (src_iata)
        REFERENCES public.airports(iata_code)
        NOT VALID;
      END IF;
    END $$;
    """

    with engine.begin() as conn:
        _execute_many(conn, ddl)
        conn.execute(text(fk_src))


def _load_airports(engine: Engine, airports: pd.DataFrame) -> None:
    airports.to_sql("stg_airports", engine, schema="public", if_exists="replace", index=False, method="multi", chunksize=5000)

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
    SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

    DROP TABLE IF EXISTS public.stg_airports;
    """
    with engine.begin() as conn:
        conn.execute(text(sql))


def _load_seaports(engine: Engine, seaports: pd.DataFrame) -> None:
    seaports.to_sql("stg_seaports", engine, schema="public", if_exists="replace", index=False, method="multi", chunksize=5000)

    sql = """
    INSERT INTO public.seaports (un_code, un_locode, port_name, name, country, area_local, area_global, harbor_size, latitude, longitude)
    SELECT un_locode, un_locode, name, name, country, area_local, area_global, harbor_size, latitude, longitude
    FROM public.stg_seaports
    ON CONFLICT (un_code) DO UPDATE
    SET un_locode = EXCLUDED.un_locode,
        port_name = EXCLUDED.port_name,
        name = EXCLUDED.name,
        country = EXCLUDED.country,
        area_local = EXCLUDED.area_local,
        area_global = EXCLUDED.area_global,
        harbor_size = EXCLUDED.harbor_size,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude;

    UPDATE public.seaports
    SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

    DROP TABLE IF EXISTS public.stg_seaports;
    """
    with engine.begin() as conn:
        conn.execute(text(sql))


def _load_airlines(engine: Engine, airlines: pd.DataFrame) -> None:
    airlines.to_sql("stg_airlines", engine, schema="public", if_exists="replace", index=False, method="multi", chunksize=5000)

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


def _load_routes(engine: Engine, routes: pd.DataFrame) -> None:
    routes.to_sql("stg_routes", engine, schema="public", if_exists="replace", index=False, method="multi", chunksize=5000)

    sql = """
    DELETE FROM public.routes WHERE src_iata IS NOT NULL;

    INSERT INTO public.routes (
        origin, destination, transit_mode, cargo_type, waypoints,
        src_iata, dst_iata, geom,
        airline_iata, airline_name, airline_country,
        src_airport, src_city, src_country, src_lat, src_lon,
        dst_airport, dst_city, dst_country, dst_lat, dst_lon,
        codeshare, stops, equipment, distance_km
    )
    SELECT
        sr.src_iata,
        sr.dst_iata,
        'air'::transit_mode,
        NULL::text,
        '[]'::jsonb,
        sr.src_iata,
        sr.dst_iata,
        ST_SetSRID(
            ST_MakeLine(
                ST_MakePoint(a_src.longitude, a_src.latitude),
                ST_MakePoint(a_dst.longitude, a_dst.latitude)
            ),
            4326
        )::geography,
        sr.airline_iata,
        sr.airline_name,
        sr.airline_country,
        sr.src_airport,
        sr.src_city,
        sr.src_country,
        sr.src_lat::double precision,
        sr.src_lon::double precision,
        sr.dst_airport,
        sr.dst_city,
        sr.dst_country,
        sr.dst_lat::double precision,
        sr.dst_lon::double precision,
        sr.codeshare,
        sr.stops::int,
        sr.equipment,
        sr.distance_km::double precision
    FROM public.stg_routes sr
    JOIN public.airports a_src ON a_src.iata_code = sr.src_iata
    JOIN public.airports a_dst ON a_dst.iata_code = sr.dst_iata;

    ALTER TABLE public.routes VALIDATE CONSTRAINT routes_src_iata_fkey;
    DROP TABLE IF EXISTS public.stg_routes;
    """

    with engine.begin() as conn:
        conn.execute(text(sql))


def _load_maritime_lanes(engine: Engine, lanes_gdf: gpd.GeoDataFrame) -> None:
    # Requires geoalchemy2 available in environment for to_postgis.
    lanes_gdf.to_postgis(
        "stg_maritime_lanes",
        engine,
        schema="public",
        if_exists="replace",
        index=False,
    )

    sql = """
    TRUNCATE TABLE public.maritime_lanes;

    INSERT INTO public.maritime_lanes (lane_name, properties, geom, source)
    SELECT
        lane_name,
        properties::jsonb,
        ST_SetSRID(geometry, 4326)::geography(MULTILINESTRING, 4326),
        'Shipping_Lanes_v1.geojson'
    FROM public.stg_maritime_lanes;

    DROP TABLE IF EXISTS public.stg_maritime_lanes;
    """

    with engine.begin() as conn:
        conn.execute(text(sql))


def _create_indexes(engine: Engine) -> None:
    sql = [
        "CREATE INDEX IF NOT EXISTS idx_airports_geom_gist ON public.airports USING GIST (geom);",
        "CREATE INDEX IF NOT EXISTS idx_seaports_geom_gist ON public.seaports USING GIST (geom);",
        "CREATE INDEX IF NOT EXISTS idx_routes_geom_gist ON public.routes USING GIST (geom);",
        "CREATE INDEX IF NOT EXISTS idx_maritime_lanes_geom_gist ON public.maritime_lanes USING GIST (geom);",
        "CREATE INDEX IF NOT EXISTS idx_routes_src_iata ON public.routes (src_iata);",
        "CREATE INDEX IF NOT EXISTS idx_routes_dst_iata ON public.routes (dst_iata);",
    ]
    with engine.begin() as conn:
        _execute_many(conn, sql)


def run(database_url: str, data_dir: Path) -> None:
    engine = create_engine(_sync_sqlalchemy_url(database_url), future=True)

    airports = _normalize_airports(_read_csv(data_dir / "world_airports.csv"))
    seaports = _normalize_seaports(_read_csv(data_dir / "UpdatedPub150.csv"))
    airlines = _normalize_airlines(_read_csv(data_dir / "airlines.csv"))
    routes = _normalize_routes(_read_csv(data_dir / "routes.csv"))
    lanes_gdf = _normalize_maritime_gdf(data_dir / "Shipping_Lanes_v1.geojson")

    _ensure_schema(engine)
    _load_airports(engine, airports)
    _load_seaports(engine, seaports)
    _load_airlines(engine, airlines)
    _load_routes(engine, routes)
    _load_maritime_lanes(engine, lanes_gdf)
    _create_indexes(engine)

    with engine.begin() as conn:
        counts = conn.execute(
            text(
                """
                SELECT
                    (SELECT COUNT(*) FROM public.airports) AS airports_count,
                    (SELECT COUNT(*) FROM public.seaports) AS seaports_count,
                    (SELECT COUNT(*) FROM public.airlines) AS airlines_count,
                    (SELECT COUNT(*) FROM public.routes WHERE src_iata IS NOT NULL) AS routes_count,
                    (SELECT COUNT(*) FROM public.maritime_lanes) AS maritime_lanes_count
                """
            )
        ).mappings().one()

    print("ETL completed")
    print(dict(counts))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="ETL logistics data into Supabase/PostGIS")
    parser.add_argument("--database-url", default=None, help="Supabase Postgres URL")
    parser.add_argument("--data-dir", default=None, help="Path to data directory")
    return parser.parse_args()


def main() -> None:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")

    args = parse_args()
    database_url = args.database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL missing. Provide --database-url or set backend/.env")

    default_data_dir = Path(__file__).resolve().parents[2] / "data"
    data_dir = Path(args.data_dir) if args.data_dir else default_data_dir
    if not data_dir.exists():
        raise FileNotFoundError(f"Data directory does not exist: {data_dir}")

    run(database_url=database_url, data_dir=data_dir)


if __name__ == "__main__":
    main()
