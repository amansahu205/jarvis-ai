"""
Spatial data and route generation for JarvisAI ReguMap.

Coordinate convention (throughout this file): [lat, lon].
Shapely uses (lon, lat) — all conversions happen at the Shapely boundary.
"""

from __future__ import annotations

import json
from pathlib import Path
from functools import lru_cache
from typing import TYPE_CHECKING

from shapely.geometry import shape, LineString, Point, MultiPolygon
from shapely.geometry.base import BaseGeometry

if TYPE_CHECKING:
    pass

# ─── Paths ────────────────────────────────────────────────────────────────────

_DATA_DIR = Path(__file__).parent.parent.parent / "data" / "boundaries"
_COUNTRIES_PATH = _DATA_DIR / "global_countries.json"
_SUEZ_PATH      = _DATA_DIR / "suez_canal.geojson"

# ─── Location registry ────────────────────────────────────────────────────────

LOCATION_COORDS: dict[str, list[float]] = {
    "BOM": [19.0887,  72.8679],   # Mumbai — Chhatrapati Shivaji Int'l
    "JFK": [40.6413, -73.7781],   # New York — John F. Kennedy
    "FRA": [50.0379,   8.5622],   # Frankfurt
    "SIN": [ 1.3644, 103.9915],   # Singapore — Changi
    "LHR": [51.4700,  -0.4543],   # London — Heathrow
    "JNB": [-26.1392,  28.2460],  # Johannesburg — O.R. Tambo
    "ORD": [41.9742,  -87.9073],  # Chicago — O'Hare
    "NRT": [35.7720,  140.3929],  # Tokyo — Narita
    "PORT_SAID": [31.2565, 32.2841],
    "SUEZ_CITY": [29.9668, 32.5498],
}

# ─── Route tables ─────────────────────────────────────────────────────────────

MARITIME_ROUTES: dict[tuple[str, str], dict] = {
    ("BOM", "JFK"): {
        "waypoints": [
            [19.0887,  72.8679],   # BOM  — Mumbai anchorage
            [14.50,    65.00],     # Arabian Sea (mid)
            [12.00,    48.00],     # Gulf of Aden
            [15.00,    40.00],     # Red Sea (northbound)
            [29.97,    32.55],     # Suez Canal — southern entrance
            [32.35,    30.00],     # Suez Canal — Great Bitter Lake transit
            [35.50,    18.00],     # Central Mediterranean
            [35.90,    -5.60],     # Strait of Gibraltar
            [40.6413, -73.7781],   # JFK  — New York
        ],
        "transit_time_hours": 22.4,
    },
}

AIR_ROUTES: dict[tuple[str, str], dict] = {
    ("BOM", "JFK"): {
        "waypoints": [
            [19.0887,  72.8679],   # BOM
            [35.00,    55.00],     # Middle East overfly
            [45.00,    20.00],     # Central Europe overfly
            [50.00,   -10.00],     # North Atlantic track
            [40.6413, -73.7781],   # JFK
        ],
        "transit_time_hours": 14.5,
    },
    ("PORT_SAID", "JFK"): {
        "waypoints": [
            [31.2565,  32.2841],   # Port Said
            [42.00,    15.00],     # Central Mediterranean overfly
            [48.00,   -15.00],     # North Atlantic track
            [40.6413, -73.7781],   # JFK
        ],
        "transit_time_hours": 14.5,
    },
}

# ─── Lookup maps ──────────────────────────────────────────────────────────────

FLAG_MAP: dict[str, str] = {
    "IND": "🇮🇳",
    "EGY": "🇪🇬",
    "EGY_SUEZ": "🇪🇬",
    "USA": "🇺🇸",
    "DEU": "🇩🇪",
    "GBR": "🇬🇧",
    "SGP": "🇸🇬",
    "ZAF": "🇿🇦",
}
_FLAG_DEFAULT = "🏳"

REGULATORY_CLASS_MAP: dict[str, str] = {
    "IND":      "IND",
    "USA":      "USA",
    "EGY_SUEZ": "EGYPT_SUEZ",
    "DEU":      "EU",
    "GBR":      "EU",
    "FRA":      "EU",
    "NLD":      "EU",
    "BEL":      "EU",
    "ITA":      "EU",
    "ESP":      "EU",
}

_INTL_WATERS_TEMPLATE = {
    "id": "intl_waters",
    "name": "International Waters",
    "flag": "🌊",
    "type": "INTERNATIONAL WATERS",
    "coordinates": [65.0, 18.0],
    "regulatory_class": "INTL_WATERS",
}

# ─── GeoJSON loading (module-level cache) ─────────────────────────────────────

@lru_cache(maxsize=1)
def _load_geodata() -> tuple[list[dict], list[dict]]:
    """
    Return (country_features, suez_features).
    Each feature dict has keys: props (dict), geom (Shapely geometry).
    Cached after first load — safe for long-running uvicorn workers.
    """
    def _load(path: Path) -> list[dict]:
        with open(path, encoding="utf-8") as fh:
            fc = json.load(fh)
        out = []
        for feat in fc["features"]:
            geom = shape(feat["geometry"])
            out.append({"props": feat["properties"], "geom": geom})
        return out

    return _load(_COUNTRIES_PATH), _load(_SUEZ_PATH)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def normalize_location(raw: str) -> str:
    """Return canonical uppercase location code, resolving common aliases."""
    _ALIASES: dict[str, str] = {
        "MUMBAI":       "BOM",
        "NEW YORK":     "JFK",
        "FRANKFURT":    "FRA",
        "SINGAPORE":    "SIN",
        "LONDON":       "LHR",
        "JOHANNESBURG": "JNB",
        "CHICAGO":      "ORD",
        "TOKYO":        "NRT",
        "PORT SAID":    "PORT_SAID",
        "SUEZ":         "SUEZ_CITY",
    }
    upper = raw.strip().upper()
    return _ALIASES.get(upper, upper)


def generate_route(origin: str, destination: str, mode: str) -> dict:
    """
    Return a route dict for the given origin/destination/mode.

    Keys: route_id, waypoints, transit_time_hours, mode,
          origin_coords, destination_coords.

    Raises ValueError if the route is not in the route tables.
    """
    origin = normalize_location(origin)
    destination = normalize_location(destination)
    mode_key = mode.strip().lower()

    if mode_key == "maritime":
        table = MARITIME_ROUTES
    elif mode_key in ("air", "aviation", "aerial"):
        table = AIR_ROUTES
    else:
        raise ValueError(f"Unknown transit mode '{mode}'. Expected: maritime | air")

    key = (origin, destination)
    if key not in table:
        raise ValueError(
            f"No {mode_key} route defined for {origin} → {destination}"
        )

    data = table[key]
    waypoints = data["waypoints"]

    return {
        "route_id": f"{origin}-{destination}-{mode_key}",
        "waypoints": waypoints,
        "transit_time_hours": data["transit_time_hours"],
        "mode": mode_key,
        "origin_coords": LOCATION_COORDS.get(origin, waypoints[0]),
        "destination_coords": LOCATION_COORDS.get(destination, waypoints[-1]),
    }


def _wp_to_shapely(lat: float, lon: float) -> Point:
    """Convert [lat, lon] → Shapely Point(lon, lat)."""
    return Point(lon, lat)


def _waypoints_to_linestring(waypoints: list[list[float]]) -> LineString:
    """Convert [[lat,lon], ...] → Shapely LineString((lon,lat), ...)."""
    return LineString([(wp[1], wp[0]) for wp in waypoints])


def get_jurisdictions_for_route(waypoints: list[list[float]]) -> list[dict]:
    """
    Derive the ordered list of jurisdictions a route passes through.

    Parameters
    ----------
    waypoints : list of [lat, lon] pairs (in route order)

    Returns
    -------
    list of dicts with keys matching JurisdictionResult schema:
        id, name, flag, type, coordinates, regulatory_class
    sorted by position along the route (ORIGIN first, DESTINATION last).
    """
    countries, suez_zones = _load_geodata()
    route_line = _waypoints_to_linestring(waypoints)

    matched: list[dict] = []          # {iso, name, geom, first_idx, centroid}
    suez_matched = False

    # ── 1. Suez Canal zone (always checked first — overrides EGY country poly) ─
    for feat in suez_zones:
        if route_line.intersects(feat["geom"]):
            suez_matched = True
            iso = feat["props"]["ADM0_A3"]
            c = feat["geom"].centroid
            # Find the earliest waypoint inside the zone to determine position
            first_idx = _first_intersection_index(waypoints, feat["geom"])
            matched.append({
                "iso": iso,
                "name": feat["props"]["ADMIN"],
                "geom": feat["geom"],
                "first_idx": first_idx,
                "centroid": [c.y, c.x],   # back to [lat, lon]
            })

    # ── 2. Country polygons ────────────────────────────────────────────────────
    for feat in countries:
        iso = feat["props"]["ADM0_A3"]

        # Skip base Egypt polygon if Suez special zone already matched
        if suez_matched and iso == "EGY":
            continue

        if route_line.intersects(feat["geom"]):
            first_idx = _first_intersection_index(waypoints, feat["geom"])
            c = feat["geom"].centroid
            matched.append({
                "iso": iso,
                "name": feat["props"]["ADMIN"],
                "geom": feat["geom"],
                "first_idx": first_idx,
                "centroid": [c.y, c.x],
            })

    # ── 3. International waters — any waypoint not inside any country ──────────
    all_land_geoms = [m["geom"] for m in matched]
    has_ocean_wp = _has_ocean_waypoint(waypoints, countries, suez_zones)
    if has_ocean_wp:
        # Place intl waters after the first country and before the last
        first_land_idx = matched[0]["first_idx"] if matched else 0
        ocean_idx = first_land_idx + 0.5   # fractional → sorts between origin and transit
        matched.append({
            "iso": "INTL_WATERS",
            "name": "International Waters",
            "geom": None,
            "first_idx": ocean_idx,
            "centroid": _INTL_WATERS_TEMPLATE["coordinates"],
        })

    # ── 4. Sort by position along route ───────────────────────────────────────
    matched.sort(key=lambda m: m["first_idx"])

    # ── 5. Assign ORIGIN / TRANSIT / DESTINATION types ────────────────────────
    n = len(matched)
    results = []
    for i, m in enumerate(matched):
        iso = m["iso"]
        if iso == "INTL_WATERS":
            jx_type = "INTERNATIONAL WATERS"
            flag_emoji = "🌊"
            reg_class = "INTL_WATERS"
        else:
            if i == 0:
                jx_type = "ORIGIN"
            elif i == n - 1:
                jx_type = "DESTINATION"
            else:
                jx_type = "TRANSIT"
            flag_emoji = FLAG_MAP.get(iso, _FLAG_DEFAULT)
            reg_class = REGULATORY_CLASS_MAP.get(iso, iso)

        results.append({
            "id": iso,
            "name": m["name"],
            "flag": flag_emoji,
            "type": jx_type,
            "coordinates": m["centroid"],
            "regulatory_class": reg_class,
        })

    return results


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _first_intersection_index(
    waypoints: list[list[float]], geom: BaseGeometry
) -> int:
    """Return the index of the first waypoint that falls inside or on `geom`."""
    for i, wp in enumerate(waypoints):
        pt = Point(wp[1], wp[0])   # (lon, lat)
        if geom.contains(pt) or geom.intersects(pt):
            return i
    # Fallback: find segment of the linestring that intersects
    for i in range(len(waypoints) - 1):
        seg = LineString([
            (waypoints[i][1],   waypoints[i][0]),
            (waypoints[i+1][1], waypoints[i+1][0]),
        ])
        if seg.intersects(geom):
            return i
    return len(waypoints)   # shouldn't reach here if route_line.intersects() was True


def _has_ocean_waypoint(
    waypoints: list[list[float]],
    countries: list[dict],
    suez_zones: list[dict],
) -> bool:
    """Return True if at least one waypoint is outside every land/zone polygon."""
    all_geoms = [f["geom"] for f in countries] + [f["geom"] for f in suez_zones]
    for wp in waypoints:
        pt = Point(wp[1], wp[0])
        if not any(g.contains(pt) for g in all_geoms):
            return True
    return False
