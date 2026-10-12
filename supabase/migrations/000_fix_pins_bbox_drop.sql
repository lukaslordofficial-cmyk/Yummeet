-- Wklej SAMO to w SQL Editor i Run, jeśli widzisz:
-- "cannot change return type of existing function" / pins_in_bbox
-- Potem uruchom 006, potem 007 (NIE uruchamiaj ponownie całego yummeet_all).

drop function if exists public.pins_in_bbox(double precision, double precision, double precision, double precision, text, integer);
drop function if exists public.pins_in_bbox(float8, float8, float8, float8, text, int);
drop function if exists public.pins_along_route(jsonb, integer, integer, text);
drop function if exists public.pins_along_route(jsonb, int, int, text);
drop function if exists public.pins_along_route(jsonb, integer, integer);
drop function if exists public.pins_along_route(jsonb, int, int);
