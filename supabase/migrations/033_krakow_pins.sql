-- =====================================================================
-- 033: Kraków — 27 lokali z różnych kuchni (OSM, 18 października 2026)
-- Link do menu jest tylko w kolumnie website. Opis nie trzyma adresu strony,
-- żeby po ręcznej poprawce przycisk szedł na nowy URL.
-- =====================================================================

update public.pins
set description = regexp_replace(description, 'Menu i ceny:\s*https?://\S+', 'Menu i ceny są na stronie lokalu.', 'i')
where description ~* 'Menu i ceny:\s*https?://';

insert into public.pins (title, description, cuisine, city, address, website, coords, status, is_official)
select
  v.title,
  'Menu i ceny są na stronie lokalu.' || case when v.phone <> '' then ' Tel. ' || v.phone else '' end,
  nullif(v.cuisine, ''),
  'Kraków',
  v.address,
  v.website,
  st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography,
  'published',
  false
from (values
  ('Cechowa'::text, 'polish'::text, 'Jagiellońska 11, 31-010 Kraków'::text, 'https://www.restauracjacechowa.pl/'::text, '+48 12 421 09 36'::text, 50.06195::float8, 19.93434::float8),
  ('Trattoria Soprano', 'italian', 'Świętej Anny 7, 31-008 Kraków', 'http://www.trattoriasoprano.pl/en/', '+48 12 422 51 95', 50.06182, 19.93446),
  ('Ramen Shop Kraków', 'japanese', 'Mogilska 65, Kraków', 'https://www.ramenshop.pl/krakow', '+48 789 420 680', 50.06623, 19.96996),
  ('Jinling Dumpling', 'chinese', 'Józefa Dietla 39, 31-062 Kraków', 'https://www.foodjinling.com/', '', 50.05127, 19.94150),
  ('IMA', 'asian', 'Skałeczna 5, 31-065 Kraków', 'https://imakrk.pl', '+48 733 339 857', 50.04939, 19.94224),
  ('India Masala', 'indian', 'Mały Rynek 2, Kraków', 'https://www.indiamasala.pl/', '+48 12 421 47 56', 50.06128, 19.94069),
  ('Molam Thai Canteen & Bar', 'thai', 'Rajska 3/4, 31-124 Kraków', 'https://molam.pl/', '', 50.06485, 19.92767),
  ('myVietNam', 'vietnamese', 'Bolesława Orlińskiego 1/LU2, 31-878 Kraków', 'https://www.myvietnam.pl/', '+48 730 919 699', 50.08151, 19.99965),
  ('Ka Vegan Udon & Sushi', 'korean', 'Rakowicka 14A, 31-510 Kraków', 'https://www.kavegan.pl/', '+48 790 237 779', 50.06760, 19.95200),
  ('Taco Mexicano', 'mexican', 'Poselska 22, 31-002 Kraków', 'https://tacomexicano.pl/', '+48 12 421 54 41', 50.05823, 19.93895),
  ('Hard Rock Cafe', 'american', 'Rynek Główny 4, Kraków', 'https://www.hardrockcafe.com/location/krakow/', '+48 12 429 11 55', 50.06141, 19.93877),
  ('Tasty Beast', 'burger', 'Rynek Dębnicki 12, Kraków', 'https://tastybeast.pl/', '+48 534 630 686', 50.05146, 19.92719),
  ('Olio', 'pizza', 'Nadwiślańska 7, 30-527 Kraków', 'https://olio-pizzanapoletana.pl/krakow', '+48 570 900 044', 50.04657, 19.95013),
  ('TATA Sushi', 'sushi', 'Dworska 2c, 30-312 Kraków', 'https://tatasushi.pl/', '+48 576 279 222', 50.04520, 19.92921),
  ('Przed stole', 'seafood', 'Obrońców Tobruku 29A, 30-396 Kraków', 'https://przy-stole.pl', '+48 793 714 374', 50.01055, 19.88171),
  ('Pimiento', 'steakhouse', 'Józefa 26, Kraków', 'https://www.pimiento.pl/', '', 50.05108, 19.94626),
  ('Kebab pod 13', 'turkish', 'Plac Wolnica 13, 31-060 Kraków', 'https://kebabpod13.pl/', '', 50.04829, 19.94401),
  ('Grecka Taverna Minoas', 'greek', 'Miodowa 9, Kraków', 'https://minoas-greek-tavern.business.site/', '+48 536 705 706', 50.05175, 19.94289),
  ('Zazie Bistro', 'french', 'Józefa 34, 31-056 Kraków', 'http://www.zaziebistro.pl', '+48 500 410 829', 50.05124, 19.94699),
  ('Euskadi', 'spanish', 'Kazimierza Brodzińskiego 4, Kraków', 'https://www.facebook.com/EuskadiKrakow/', '+48 535 484 056', 50.04502, 19.94838),
  ('Chinkalnia', 'georgian', 'Mostowa 14, Kraków', 'https://www.facebook.com/chinkalniakrakowmostowa', '+48 12 430 68 23', 50.04734, 19.94694),
  ('Mazaya', 'middle_east', 'Krupnicza 22, 31-123 Kraków', 'https://mazaya-falafel.com', '+48 731 337 887', 50.06340, 19.92898),
  ('Veganic', 'vegan', 'Karmelicka 34, Kraków', 'https://veganic.restaurant/', '', 50.06607, 19.92967),
  ('Kawiarnia Jama Michalika', 'cafe', 'Floriańska 45, 31-019 Kraków', 'https://jamamichalika.pl/', '', 50.06408, 19.94093),
  ('Lodove', 'dessert', 'Dobrego Pasterza 95, 31-416 Kraków', 'https://lodove.com.pl/', '+48 790 665 665', 50.08844, 19.96669),
  ('Lesu Wine & Dine', 'wine', 'Miodowa 33, 31-052 Kraków', 'https://www.restauracjalesu.pl/', '+48 601 457 134', 50.05307, 19.94638),
  ('Pino', 'international', 'Szczepańska 4, Kraków', 'https://www.restauracjapino.pl/', '+48 609 015 016', 50.06314, 19.93575)
) as v(title, cuisine, address, website, phone, lat, lng)
where not exists (
  select 1 from public.pins p
  where p.status = 'published'
    and p.title = v.title
    and st_dwithin(p.coords, st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography, 80)
);

notify pgrst, 'reload schema';
