CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE public.routes
    ADD COLUMN IF NOT EXISTS src_iata TEXT;

ALTER TABLE public.routes
    ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(LINESTRING, 4326);

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

ALTER TABLE public.routes VALIDATE CONSTRAINT routes_src_iata_fkey;

CREATE INDEX IF NOT EXISTS idx_airports_geom_gist
    ON public.airports USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_seaports_geom_gist
    ON public.seaports USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_routes_geom_gist
    ON public.routes USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_maritime_lanes_geom_gist
    ON public.maritime_lanes USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_routes_src_iata
    ON public.routes (src_iata);
