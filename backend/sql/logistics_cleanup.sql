-- Cleanup / rollback script for logistics migration artifacts.
-- Use in non-production first.

DROP INDEX IF EXISTS public.idx_routes_airline_iata;
DROP INDEX IF EXISTS public.idx_routes_dst_iata;
DROP INDEX IF EXISTS public.idx_routes_src_iata;
DROP INDEX IF EXISTS public.idx_routes_geom_gist;
DROP INDEX IF EXISTS public.idx_maritime_lanes_geom_gist;
DROP INDEX IF EXISTS public.idx_seaports_geom_gist;
DROP INDEX IF EXISTS public.idx_airports_geom_gist;

ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS routes_src_iata_fkey;
ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS routes_dst_iata_fkey;

ALTER TABLE public.routes DROP COLUMN IF EXISTS src_iata;
ALTER TABLE public.routes DROP COLUMN IF EXISTS dst_iata;
ALTER TABLE public.routes DROP COLUMN IF EXISTS geom;
ALTER TABLE public.routes DROP COLUMN IF EXISTS airline_iata;
ALTER TABLE public.routes DROP COLUMN IF EXISTS airline_name;
ALTER TABLE public.routes DROP COLUMN IF EXISTS airline_country;
ALTER TABLE public.routes DROP COLUMN IF EXISTS src_airport;
ALTER TABLE public.routes DROP COLUMN IF EXISTS src_city;
ALTER TABLE public.routes DROP COLUMN IF EXISTS src_country;
ALTER TABLE public.routes DROP COLUMN IF EXISTS src_lat;
ALTER TABLE public.routes DROP COLUMN IF EXISTS src_lon;
ALTER TABLE public.routes DROP COLUMN IF EXISTS dst_airport;
ALTER TABLE public.routes DROP COLUMN IF EXISTS dst_city;
ALTER TABLE public.routes DROP COLUMN IF EXISTS dst_country;
ALTER TABLE public.routes DROP COLUMN IF EXISTS dst_lat;
ALTER TABLE public.routes DROP COLUMN IF EXISTS dst_lon;
ALTER TABLE public.routes DROP COLUMN IF EXISTS codeshare;
ALTER TABLE public.routes DROP COLUMN IF EXISTS stops;
ALTER TABLE public.routes DROP COLUMN IF EXISTS equipment;
ALTER TABLE public.routes DROP COLUMN IF EXISTS distance_km;

ALTER TABLE public.airports DROP COLUMN IF EXISTS geom;
ALTER TABLE public.seaports DROP COLUMN IF EXISTS geom;
ALTER TABLE public.seaports DROP COLUMN IF EXISTS name;
ALTER TABLE public.seaports DROP COLUMN IF EXISTS un_locode;
ALTER TABLE public.seaports DROP COLUMN IF EXISTS harbor_size;
ALTER TABLE public.seaports DROP COLUMN IF EXISTS latitude;
ALTER TABLE public.seaports DROP COLUMN IF EXISTS longitude;

DROP TABLE IF EXISTS public.maritime_lanes;

-- Optional: keep airlines if used by application logic.
-- DROP TABLE IF EXISTS public.airlines;

-- Optional: remove PostGIS extension only if no other geospatial objects exist.
-- DROP EXTENSION IF EXISTS postgis;
