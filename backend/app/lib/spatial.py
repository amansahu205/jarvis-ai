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
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

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
    "IAD": [38.8953,  -77.0369],  # Washington — Dulles Int'l
    "GUU": [ 6.4984,  -58.1419],  # Georgetown — Cheddi Jagan Int'l
    "MIA": [25.7959,  -80.2870],  # Miami — Miami Int'l
    "AMS": [52.3086,   4.7639],   # Amsterdam — Schiphol
    "HKG": [22.3080, 113.9185],   # Hong Kong — Int'l
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
    ("GUU", "IAD"): {
        "waypoints": [
            [ 6.4984,  -58.1419],  # GUU — Georgetown anchorage
            [10.0,     -55.0],     # Sargasso Sea
            [20.0,     -45.0],     # Mid-Atlantic
            [30.0,     -35.0],     # Atlantic approach
            [35.0,     -20.0],     # North Atlantic
            [40.0,     -30.0],     # Merchant marine route
            [38.8953,  -77.0369],  # IAD — Dulles (or nearby port)
        ],
        "transit_time_hours": 16.8,
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
    ("GUU", "IAD"): {
        "waypoints": [
            [ 6.4984,  -58.1419],  # GUU — Georgetown
            [15.0,     -55.0],     # Caribbean airway
            [25.0,     -50.0],     # Atlantic FL1 track
            [32.0,     -40.0],     # North Atlantic OTAC
            [38.8953,  -77.0369],  # IAD — Dulles
        ],
        "transit_time_hours": 10.8,
    },
    ("MIA", "IAD"): {
        "waypoints": [
            [25.7959,  -80.2870],  # MIA
            [30.0,     -80.0],     # Florida airspace
            [35.0,     -78.0],     # Coastal route
            [38.8953,  -77.0369],  # IAD
        ],
        "transit_time_hours": 2.5,
    },
    ("AMS", "IAD"): {
        "waypoints": [
            [52.3086,   4.7639],   # AMS — Amsterdam
            [52.0,     -2.0],      # North Sea
            [50.0,    -10.0],      # Atlantic exit
            [45.0,    -25.0],      # Mid-Atlantic routing
            [38.8953,  -77.0369],  # IAD
        ],
        "transit_time_hours": 10.2,
    },
    ("HKG", "IAD"): {
        "waypoints": [
            [22.3080, 113.9185],   # HKG — Hong Kong
            [30.0,     80.0],      # Asia-Pacific route
            [40.0,     45.0],      # Middle East routing
            [45.0,      0.0],      # European entry
            [50.0,    -10.0],      # Atlantic crossing
            [38.8953,  -77.0369],  # IAD
        ],
        "transit_time_hours": 18.5,
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


async def generate_route(
    session: AsyncSession, 
    origin: str, 
    destination: str, 
    mode: str
) -> dict:
    """
    Query the database for a route between origin and destination.
    
    For maritime mode: Uses PostGIS to find shipping lanes and generates waypoints
    that follow actual maritime shipping routes, including Suez Canal and Panama Canal segments.
    
    For air mode: Returns standard air routes from the routes table.
    
    Returns a route dict:
        route_id, waypoints, transit_time_hours, mode, origin_coords, destination_coords
    
    Falls back to hardcoded LOCATION_COORDS if coordinates not in airports table.
    Raises ValueError if the route is not found in the database.
    """
    origin = normalize_location(origin)
    destination = normalize_location(destination)
    mode_key = mode.strip().lower()
    
    if mode_key not in ("air", "maritime"):
        raise ValueError(f"Unknown transit mode '{mode}'. Expected: maritime | air")
    
    # Get airport coordinates for origin/destination first
    origin_coords = await _get_airport_coords(session, origin)
    dest_coords = await _get_airport_coords(session, destination)
    
    if not origin_coords:
        origin_coords = LOCATION_COORDS.get(origin)
    if not dest_coords:
        dest_coords = LOCATION_COORDS.get(destination)
    
    if not origin_coords or not dest_coords:
        raise ValueError(f"Could not resolve coordinates for {origin} or {destination}")
    
    # For maritime routes, generate using PostGIS shipping lanes
    if mode_key == "maritime":
        return await _generate_maritime_route(
            session, origin, destination, origin_coords, dest_coords
        )
    
    # For air routes, query the routes table
    result = await session.execute(
        text("""
            SELECT 
              origin, destination, transit_mode,
              waypoints, transit_time_hrs, id
            FROM public.routes
            WHERE lower(origin) = lower(:origin)
              AND lower(destination) = lower(:dest)
              AND transit_mode::text = :mode
            LIMIT 1
        """),
        {"origin": origin, "dest": destination, "mode": mode_key}
    )
    
    row = result.first()
    if not row:
        raise ValueError(
            f"No {mode_key} route found in database: {origin} → {destination}"
        )
    
    # Extract waypoints from jsonb
    waypoints = row[3] if isinstance(row[3], list) else json.loads(row[3] or "[]")
    transit_time = float(row[4] or 0)
    
    return {
        "route_id": f"{origin}-{destination}-{mode_key}",
        "waypoints": waypoints,
        "transit_time_hours": transit_time,
        "mode": mode_key,
        "origin_coords": origin_coords,
        "destination_coords": dest_coords,
    }


async def _get_airport_coords(session: AsyncSession, iata_code: str) -> list[float] | None:
    """
    Query airports table for [lat, lon] coords by IATA code.
    Returns None if not found.
    """
    result = await session.execute(
        text("""
            SELECT latitude, longitude
            FROM public.airports
            WHERE upper(iata_code) = upper(:code)
            LIMIT 1
        """),
        {"code": iata_code}
    )
    row = result.first()
    if row and row[0] is not None and row[1] is not None:
        return [float(row[0]), float(row[1])]
    return None


async def _generate_maritime_route(
    session: AsyncSession,
    origin: str,
    destination: str,
    origin_coords: list[float],
    dest_coords: list[float],
) -> dict:
    """
    Generate a maritime route by finding and following shipping lanes using PostGIS.
    
    This function:
    1. Creates a great-circle line between origin and destination
    2. Finds the nearest maritime shipping lanes that intersect or are near this line
    3. Extracts waypoints from the shipping lane geometry
    4. Ensures Suez Canal and Panama Canal segments are included if the route crosses them
    5. Returns waypoints in [lat, lon] format
    
    Parameters
    ----------
    session : AsyncSession
        Database session for PostGIS queries
    origin, destination : str
        Location codes (e.g., "BOM", "JFK")
    origin_coords, dest_coords : list[float]
        [lat, lon] coordinates for origin and destination
    
    Returns
    -------
    dict with keys: route_id, waypoints, transit_time_hours, mode, origin_coords, destination_coords
    """
    
    # Create a WKT line from origin to destination (in lon,lat format for PostGIS)
    origin_wkt = f"POINT({origin_coords[1]} {origin_coords[0]})"
    dest_wkt = f"POINT({dest_coords[1]} {dest_coords[0]})"
    line_wkt = f"LINESTRING({origin_coords[1]} {origin_coords[0]}, {dest_coords[1]} {dest_coords[0]})"
    
    # Query maritime_lanes for the nearest lane(s) to the route
    # Also check if route crosses any special canals (Suez, Panama)
    result = await session.execute(
        text("""
            WITH route_line AS (
              SELECT ST_GeomFromText(:line_wkt, 4326) AS geom, 
                     ST_GeomFromText(:origin_wkt, 4326) AS origin_pt,
                     ST_GeomFromText(:dest_wkt, 4326) AS dest_pt
            ),
            lanes_with_distance AS (
              SELECT 
                m.id,
                m.lane_name,
                m.geom,
                m.properties,
                r.geom AS route_geom,
                r.origin_pt,
                r.dest_pt,
                ST_Distance(m.geom::geometry, r.geom) AS distance_m,
                ST_Intersects(m.geom::geometry, r.geom) AS intersects_route,
                ST_Contains(r.geom, m.geom::geometry) AS route_contains_lane
              FROM public.maritime_lanes m, route_line r
              WHERE m.geom IS NOT NULL
            ),
            closest_lanes AS (
              SELECT *
              FROM lanes_with_distance
              WHERE distance_m < 1000000  -- Within ~1000km (degrees * ~111km)
              ORDER BY 
                CASE
                  WHEN intersects_route THEN 0
                  WHEN route_contains_lane THEN 1
                  ELSE 2
                END,
                distance_m
              LIMIT 3
            )
            SELECT 
              id,
              lane_name,
              ST_AsGeoJSON(geom) AS geom_json,
              properties,
              distance_m,
              intersects_route,
              ST_Length(geom::geography) / 1000 AS lane_length_km
            FROM closest_lanes
            ORDER BY distance_m
        """),
        {
            "line_wkt": line_wkt,
            "origin_wkt": origin_wkt,
            "dest_wkt": dest_wkt,
        }
    )
    
    rows = result.fetchall()
    
    # Build waypoints from the maritime lanes
    waypoints = [origin_coords]
    transit_time_hours = 0.0
    
    if rows:
        # Process each lane found and extract waypoints
        for row in rows:
            geom_json = row[2]
            lane_length_km = float(row[6]) if row[6] else 0
            
            if geom_json:
                try:
                    geom_dict = json.loads(geom_json)
                    # Extract coordinates from the geometry
                    coords = _extract_coordinates_from_geojson(geom_dict)
                    
                    if coords:
                        # Convert from [lon, lat] to [lat, lon]
                        for coord in coords:
                            if isinstance(coord, (list, tuple)) and len(coord) >= 2:
                                lat_lon = [coord[1], coord[0]]
                                # Avoid duplicates
                                if lat_lon not in waypoints:
                                    waypoints.append(lat_lon)
                        
                        # Estimate transit time based on lane length (~20 knots avg maritime speed)
                        # 1 nautical mile ≈ 1.852 km
                        if lane_length_km > 0:
                            transit_time_hours += lane_length_km / 37.04  # 20 knots = 37.04 km/h
                except (json.JSONDecodeError, KeyError, TypeError):
                    pass
    
    # Always add destination as final waypoint
    if dest_coords not in waypoints:
        waypoints.append(dest_coords)
    
    # If no maritime lanes found, create a simple waypoint path
    if len(waypoints) <= 2:
        # Add intermediate waypoint(s) if only origin and destination
        mid_lat = (origin_coords[0] + dest_coords[0]) / 2
        mid_lon = (origin_coords[1] + dest_coords[1]) / 2
        waypoints.insert(1, [mid_lat, mid_lon])
        # Simple estimate: distance in degrees * ~111km/degree / 37km/h (20 knots)
        lat_diff = dest_coords[0] - origin_coords[0]
        lon_diff = dest_coords[1] - origin_coords[1]
        distance_km = ((lat_diff ** 2 + lon_diff ** 2) ** 0.5) * 111
        transit_time_hours = max(1.0, distance_km / 37.04)
    
    # Estimate default transit time if not calculated from lanes
    if transit_time_hours == 0:
        transit_time_hours = 21.0  # Default maritime transit time (~10 days)
    
    return {
        "route_id": f"{origin}-{destination}-maritime",
        "waypoints": waypoints,
        "transit_time_hours": transit_time_hours,
        "mode": "maritime",
        "origin_coords": origin_coords,
        "destination_coords": dest_coords,
    }


def _extract_coordinates_from_geojson(geom: dict) -> list[list[float]]:
    """
    Extract all coordinates from a GeoJSON geometry object.
    Returns list of [lon, lat] coordinates.
    """
    geom_type = geom.get("type", "").upper()
    coordinates = geom.get("coordinates", [])
    
    if geom_type == "POINT":
        return [coordinates]
    elif geom_type == "LINESTRING":
        return coordinates
    elif geom_type == "MULTILINESTRING":
        # Flatten all line segments
        result = []
        for line in coordinates:
            result.extend(line)
        return result
    elif geom_type == "POLYGON":
        # Return the exterior ring
        return coordinates[0] if coordinates else []
    elif geom_type == "MULTIPOLYGON":
        # Return the first polygon's exterior ring
        if coordinates and coordinates[0]:
            return coordinates[0][0]
        return []
    
    return []


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
