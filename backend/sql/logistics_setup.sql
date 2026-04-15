-- Core SQL setup for PostGIS and spatial schema wiring.

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE public.airports
    ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(POINT, 4326);

ALTER TABLE public.seaports
    ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(POINT, 4326);

ALTER TABLE public.seaports
    ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.seaports
    ADD COLUMN IF NOT EXISTS un_locode TEXT;

ALTER TABLE public.seaports
    ADD COLUMN IF NOT EXISTS harbor_size TEXT;

ALTER TABLE public.seaports
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE public.seaports
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS src_iata TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS dst_iata TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(LINESTRING, 4326);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'routes_src_iata_fkey'
    ) THEN
        ALTER TABLE public.routes
            ADD CONSTRAINT routes_src_iata_fkey
            FOREIGN KEY (src_iata)
            REFERENCES public.airports(iata_code)
            NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'routes_dst_iata_fkey'
    ) THEN
        ALTER TABLE public.routes
            ADD CONSTRAINT routes_dst_iata_fkey
            FOREIGN KEY (dst_iata)
            REFERENCES public.airports(iata_code)
            NOT VALID;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.maritime_lanes (
    id BIGSERIAL PRIMARY KEY,
    lane_name TEXT,
    properties JSONB DEFAULT '{}'::jsonb,
    geom GEOGRAPHY(MULTILINESTRING, 4326),
    source TEXT DEFAULT 'Shipping_Lanes_v1.geojson',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Build geom from existing lat/lon attributes where present.
UPDATE public.airports
SET geom = ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

UPDATE public.seaports
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
