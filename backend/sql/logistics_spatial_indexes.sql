-- Spatial and lookup indexes for logistics search performance
-- Run after migration script has populated geometry/geography columns.

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

CREATE INDEX IF NOT EXISTS idx_routes_dst_iata
    ON public.routes (dst_iata);

CREATE INDEX IF NOT EXISTS idx_routes_airline_iata
    ON public.routes (airline_iata);
