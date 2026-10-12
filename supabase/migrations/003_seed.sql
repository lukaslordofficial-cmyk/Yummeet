-- =====================================================================
-- YUMMEET — 003_seed.sql  (demo content; safe to re-run)
-- Content is data, not code: add specializations, missions, cards by inserting rows.
-- =====================================================================
insert into public.specialization_definitions (code, name, description, color, icon, card_affinity, sort) values
 ('critic',   'Krytyk Gastronomiczny', 'Odkrywa restauracje, testuje dania i pomaga społeczności znaleźć najlepsze miejsca.', '#2C2520', 'silverware-fork-knife', '{explorer,taster,strategy}', 1),
 ('chef',     'Mistrz Kuchni', 'Gotuje, eksperymentuje i dzieli się jedzeniem.', '#A27E5D', 'chef-hat', '{culinary,tasting}', 2),
 ('rescuer',  'Ratownik Żywności', 'Ogranicza marnowanie żywności i pomaga potrzebującym.', '#38A342', 'leaf', '{solidarity,logistics}', 3),
 ('connector','Łącznik Stołu', 'Organizuje spotkania i poznaje nowych ludzi.', '#F4A261', 'account-group', '{hospitality,integration}', 4),
 ('romantic', 'Romantyk Kulinarnej Przygody', 'Wykorzystuje jedzenie do poznawania potencjalnych partnerów.', '#A0153E', 'heart', '{tasting,courage,creativity}', 5),
 ('explorer', 'Odkrywca Kulinarnego Świata', 'Podróżuje, planuje trasy i odkrywa nowe kuchnie.', '#E05F36', 'compass', '{travel,exploration,collector}', 6)
on conflict (code) do update set name = excluded.name, description = excluded.description, color = excluded.color, icon = excluded.icon;

insert into public.level_definitions (level, name, min_xp) values
 (1, 'Nowicjusz', 0), (2, 'Smakosz', 100), (3, 'Odkrywca', 300), (4, 'Łącznik', 700), (5, 'Mistrz Stołu', 1500)
on conflict (level) do update set name = excluded.name, min_xp = excluded.min_xp;

insert into public.badge_definitions (code, name, description, icon, metric, threshold) values
 ('first_mission', 'Pierwsza misja', 'Ukończ pierwszą misję', 'flag-checkered', 'missions_completed', 1),
 ('mission_5', 'Poszukiwacz przygód', 'Ukończ 5 misji', 'sword', 'missions_completed', 5),
 ('collector_10', 'Kolekcjoner', 'Posiadaj 10 kart', 'cards', 'cards_owned', 10),
 ('duelist', 'Pojedynkowicz', 'Wygraj pierwszy pojedynek', 'sword-cross', 'duels_won', 1),
 ('table_guest', 'Gość przy stole', 'Potwierdź obecność na wydarzeniu', 'table-chair', 'events_attended', 1),
 ('pin_master', 'Kartograf smaku', 'Dodaj 3 piny', 'map-marker-star', 'pins_created', 3)
on conflict (code) do nothing;

-- CARDS (placeholder art: art_key -> generated illustration in the app)
insert into public.card_definitions (code, name, lore, category, kind, rarity, art_key, effect, challenge_text, challenge_hours, specialization_code) values
 ('szef_kuchni_wzywa', 'Szef Kuchni Wzywa', 'Głos z kuchni niesie się po mieście…', 'culinary', 'offensive', 'rare', 'chef', 'Wyzwanie kulinarne.', 'Przygotuj potrawę i zostaw ją dla przeciwnika w umówionym, publicznym miejscu.', 72, 'chef'),
 ('tajemnicza_degustacja', 'Tajemnicza Degustacja', 'Mała próbka, wielka tajemnica.', 'tasting', 'offensive', 'common', 'mystery', 'Wyzwanie degustacyjne.', 'Przygotuj małą próbkę potrawy do odbioru w uzgodnionym, bezpiecznym miejscu.', 48, 'chef'),
 ('mistrz_wymiany', 'Mistrz Wymiany', 'Danie za danie, uśmiech za uśmiech.', 'exchange', 'offensive', 'common', 'exchange', 'Wymiana posiłków.', 'Zaproponuj dobrowolną wymianę posiłków z przeciwnikiem.', 72, null),
 ('kulinarna_ekspedycja', 'Kulinarna Ekspedycja', 'Mapa prowadzi tam, gdzie pachnie.', 'travel', 'offensive', 'common', 'expedition', 'Odwiedzenie lokalu.', 'Odwiedź lokal wskazany przez przeciwnika i podziel się wrażeniami.', 72, 'explorer'),
 ('otwarty_stol', 'Otwarty Stół', 'Krzesło zawsze się znajdzie.', 'social', 'offensive', 'common', 'table', 'Spotkanie grupowe.', 'Dołącz do dowolnego otwartego stołu w ciągu 7 dni.', 168, 'connector'),
 ('ratownik_smaku', 'Ratownik Smaku', 'Żaden kęs nie zostanie w tyle.', 'solidarity', 'offensive', 'common', 'rescue', 'Uratuj posiłek.', 'Uratuj pełnowartościowy posiłek przed zmarnowaniem (np. jadłodzielnia).', 72, 'rescuer'),
 ('recenzent_z_misja', 'Recenzent z Misją', 'Słowo krytyka waży więcej niż złoto.', 'review', 'offensive', 'common', 'review', 'Recenzja lokalu.', 'Opublikuj uzasadnioną recenzję lokalu w Yummeet.', 48, 'critic'),
 ('pojedynek_smakow', 'Pojedynek Smaków', 'Dwie wersje, jeden zwycięzca.', 'culinary', 'offensive', 'epic', 'versus', 'Podwójne gotowanie.', 'Przygotuj dwie wersje potrawy i zorganizuj wspólną degustację w publicznym miejscu.', 96, 'chef'),
 ('podroz_za_smakiem', 'Podróż za Smakiem', 'Kompas wskazuje na głód.', 'travel', 'offensive', 'common', 'travel', 'Nowe miejsce.', 'Odkryj nowe miejsce kulinarne i dodaj pin z opisem.', 72, 'explorer'),
 ('goscinny_gospodarz', 'Gościnny Gospodarz', 'Drzwi otwarte, stół nakryty.', 'hospitality', 'offensive', 'rare', 'host', 'Organizacja spotkania.', 'Zorganizuj otwarte spotkanie przy jedzeniu w lokalu.', 168, 'connector'),
 ('mala_probka', 'Mała Próbka', 'Czasem mniej znaczy więcej.', 'defense', 'defensive', 'common', 'sample', 'Zamień rozbudowane gotowanie na małą degustację albo wręczenie cukierka.', null, 48, null),
 ('zmiana_menu', 'Zmiana Menu', 'Karta dań się zmienia.', 'defense', 'defensive', 'common', 'menu', 'Zastąp wyzwanie inną, dowolnie wybraną aktywnością kulinarną.', null, 48, null),
 ('tryb_wegetarianski', 'Tryb Wegetariański', 'Zielono mi.', 'defense', 'defensive', 'common', 'veggie', 'Wariant wegetariański (jeśli obie strony akceptują).', null, 48, null),
 ('lagodniejszy_przepis', 'Łagodniejszy Przepis', 'Szczypta mniej ognia.', 'defense', 'defensive', 'common', 'mild', 'Obniżenie trudności wyzwania.', null, 48, null),
 ('przeniesienie_spotkania', 'Przeniesienie Spotkania', 'Zegar tyka inaczej.', 'defense', 'defensive', 'common', 'calendar', 'Uzgodnienie innego terminu.', null, 48, null),
 ('degustacja_bez_gotowania', 'Degustacja Bez Gotowania', 'Gotowe też smakuje.', 'defense', 'defensive', 'common', 'ready', 'Zamiana gotowania na degustację gotowego produktu.', null, 48, null),
 ('bezpieczna_lokalizacja', 'Bezpieczna Lokalizacja', 'Spotkajmy się na rynku.', 'defense', 'defensive', 'rare', 'shield', 'Przeniesienie spotkania do miejsca publicznego.', null, 48, null),
 ('wspolny_wariant', 'Wspólny Wariant', 'Razem raźniej.', 'defense', 'defensive', 'common', 'together', 'Zamiana wyzwania indywidualnego na wspólną aktywność.', null, 48, null),
 ('odmowa_bez_kary', 'Odmowa bez Kary', 'Twoje granice, Twoje zasady.', 'defense', 'defensive', 'epic', 'stop', 'Rezygnacja z wyzwania bez utraty karty i bez konsekwencji.', null, 48, null),
 ('podwojna_nagroda', 'Podwójna Nagroda', 'Fortuna sprzyja smakoszom.', 'bonus', 'special', 'legendary', 'star', 'Placeholder: podwaja XP za następną misję (mechanika w przygotowaniu).', null, 48, null)
on conflict (code) do update set name = excluded.name, effect = excluded.effect, challenge_text = excluded.challenge_text;

-- MISSIONS (demo)
insert into public.mission_definitions (code, name, description, category, specialization_code, participation, difficulty, confirmation_method, duration_hours, reward_xp, repeat_reward_xp, repeat_limit, cooldown_hours, steps, safety_rules) values
 ('starter_hello', 'Pierwszy kęs', 'Przedstaw się społeczności: napisz, jakie danie najlepiej Cię opisuje.', 'social', null, 'solo', 1, 'self', 24, 40, 0, 1, 0, '["Pomyśl o ulubionym daniu","Opisz je w 1-2 zdaniach","Wyślij"]', null),
 ('critic_three_pins', 'Trzy ulubione miejsca', 'Dodaj trzy piny z recenzjami swoich ulubionych restauracji.', 'review', 'critic', 'solo', 2, 'self', 168, 80, 20, 3, 24, '["Dodaj 3 piny","Oceń każde miejsce","Opisz najlepsze danie"]', 'Recenzuj uczciwie – bez obraźliwych treści.'),
 ('critic_best_dish', 'Najlepsze danie w mieście', 'Poleć najlepsze danie, jakie zjadłeś w swoim mieście.', 'restaurant', 'critic', 'solo', 1, 'self', 72, 50, 10, 0, 24, '["Wybierz danie","Opisz dlaczego"]', null),
 ('rescuer_foodshare', 'Jadłodzielnia', 'Oddaj pełnowartościowy posiłek do jadłodzielni.', 'food_rescue', 'rescuer', 'solo', 2, 'code', 72, 100, 30, 0, 24, '["Przygotuj zapakowany posiłek z opisem alergenów","Zanieś do jadłodzielni","Wpisz kod z jadłodzielni"]', 'Opisz alergeny i datę przygotowania. Nie oddawaj jedzenia po terminie.'),
 ('chef_signature', 'Popisowe danie', 'Ugotuj popisowe danie i podziel się nim z inną osobą, która dobrowolnie przyjęła zaproszenie.', 'cooking', 'chef', 'pair', 3, 'peer', 120, 120, 30, 0, 48, '["Ugotuj danie","Podaj skład i alergeny","Przekaż w publicznym miejscu","Poproś odbiorcę o potwierdzenie"]', 'Odbiorca zawsze może odmówić. Spotkanie tylko w miejscu publicznym.'),
 ('connector_open_table', 'Trzy nowe twarze', 'Dołącz do otwartego stołu i poznaj trzy nowe osoby.', 'social', 'connector', 'group', 2, 'peer', 168, 90, 20, 0, 48, '["Dołącz do stołu","Porozmawiaj z 3 osobami","Poproś organizatora o potwierdzenie"]', 'Możesz wyjść w każdej chwili.'),
 ('explorer_three_recommended', 'Szlakiem poleceń', 'Odwiedź trzy restauracje polecone przez innych Yummiteerów.', 'travel', 'explorer', 'solo', 2, 'self', 336, 100, 20, 0, 72, '["Wybierz 3 polecane lokale","Odwiedź je","Oznacz wizyty na mapie"]', null),
 ('romantic_tasting', 'Wspólna degustacja', 'Zaproś osobę, która wyraziła zainteresowanie, na degustację w lokalu.', 'dating', 'romantic', 'pair', 3, 'peer', 168, 120, 30, 0, 72, '["Zaproponuj lokal publiczny","Uzgodnij termin","Poproś o potwierdzenie spotkania"]', 'Pierwsze spotkanie tylko w miejscu publicznym. Brak zgody = brak misji.')
on conflict (code) do update set name = excluded.name, description = excluded.description, steps = excluded.steps;

insert into public.mission_secrets (mission_id, confirmation_code)
select id, 'YUMMI1' from public.mission_definitions where code = 'rescuer_foodshare'
on conflict (mission_id) do nothing;

delete from public.card_rewards where mission_id in (select id from public.mission_definitions where code in
  ('starter_hello','critic_three_pins','critic_best_dish','rescuer_foodshare','chef_signature','connector_open_table','explorer_three_recommended','romantic_tasting'));
insert into public.card_rewards (mission_id, kind, rarity, count, first_time_only)
select id, 'offensive', 'common', 1, true from public.mission_definitions where code = 'starter_hello'
union all select id, 'defensive', 'common', 1, true from public.mission_definitions where code = 'starter_hello'
union all select id, 'offensive', 'common', 1, true from public.mission_definitions where code in ('critic_three_pins','critic_best_dish','explorer_three_recommended')
union all select id, 'offensive', 'rare', 1, true from public.mission_definitions where code in ('chef_signature','connector_open_table')
union all select id, 'defensive', 'rare', 1, true from public.mission_definitions where code = 'rescuer_foodshare'
union all select id, 'offensive', 'epic', 1, true from public.mission_definitions where code = 'romantic_tasting';
insert into public.card_rewards (mission_id, card_id, kind, rarity, count, first_time_only)
select m.id, c.id, null, 'epic', 1, true from public.mission_definitions m, public.card_definitions c where m.code = 'chef_signature' and c.code = 'odmowa_bez_kary';

-- DEMO PINS (Warszawa)
insert into public.pins (title, description, cuisine, city, price_level, coords)
select title, description, cuisine, city, price_level, coords::extensions.geography from (values
 ('Bar Mleczny Pod Barbakanem', 'Klasyka PRL: pierogi i naleśniki.', 'polish', 'Warszawa', 1::smallint, 'SRID=4326;POINT(21.0105 52.2502)'),
 ('Pierogarnia na Bednarskiej', 'Ręcznie lepione pierogi.', 'polish', 'Warszawa', 2::smallint, 'SRID=4326;POINT(21.0135 52.2455)'),
 ('Ramen Station', 'Bulion gotowany 12 godzin.', 'japanese', 'Warszawa', 2::smallint, 'SRID=4326;POINT(21.0180 52.2297)'),
 ('Trattoria Nonna', 'Domowe makarony i tiramisu.', 'italian', 'Warszawa', 3::smallint, 'SRID=4326;POINT(21.0059 52.2319)'),
 ('Vege Miasto', 'Roślinne bowle i burgery.', 'vegan', 'Warszawa', 2::smallint, 'SRID=4326;POINT(21.0003 52.2390)'),
 ('Hala Koszyki', 'Food hall z kilkunastoma kuchniami.', 'international', 'Warszawa', 3::smallint, 'SRID=4326;POINT(21.0130 52.2223)'),
 ('Taqueria Mexicana', 'Tacos al pastor i salsy.', 'mexican', 'Warszawa', 2::smallint, 'SRID=4326;POINT(21.0230 52.2340)'),
 ('Kebab u Ahmeda', 'Najlepszy kebab na Pradze.', 'turkish', 'Warszawa', 1::smallint, 'SRID=4326;POINT(21.0340 52.2520)'),
 ('Zajazd pod Łodzią', 'Przystanek na trasie A2.', 'polish', 'Łowicz', 2::smallint, 'SRID=4326;POINT(19.9400 52.1060)'),
 ('Manufaktura Food', 'Kuchnie świata w Łodzi.', 'international', 'Łódź', 2::smallint, 'SRID=4326;POINT(19.4560 51.7790)'),
 ('Pizzeria Napoli Łódź', 'Neapolitańska pizza z pieca opalanego drewnem.', 'italian', 'Łódź', 2::smallint, 'SRID=4326;POINT(19.4570 51.7700)'),
 ('Kawiarnia Ogród', 'Kawa speciality i ciasta.', 'cafe', 'Warszawa', 2::smallint, 'SRID=4326;POINT(21.0200 52.2400)')
) as v(title, description, cuisine, city, price_level, coords)
where not exists (select 1 from public.pins p where p.title = v.title);

-- OFFICIAL DEMO EVENT (system organizer)
insert into public.events (kind, title, description, place_name, starts_at, capacity, seats_taken, theme, rules, discount_text, is_official, pin_id)
select 'official', 'Wieczór pierogów z szefem kuchni', 'Degustacja 6 rodzajów pierogów i rozmowa z szefem kuchni.', 'Pierogarnia na Bednarskiej',
       now() + interval '7 days', 12, 0, 'Kuchnia polska', 'Miejsce publiczne. Obecność potwierdzana kodem.', '-20% dla Yummiteerów', true,
       (select id from public.pins where title = 'Pierogarnia na Bednarskiej' limit 1)
where not exists (select 1 from public.events where title = 'Wieczór pierogów z szefem kuchni');
insert into public.event_secrets (event_id, checkin_code)
select id, 'PIEROG' from public.events where title = 'Wieczór pierogów z szefem kuchni' on conflict do nothing;
insert into public.conversations (kind, ref_id, title)
select 'event', id, title from public.events where title = 'Wieczór pierogów z szefem kuchni'
on conflict (kind, ref_id) where ref_id is not null do nothing;

-- TABLE GAMES & QUESTION BANK (placeholders; real content to be added later)
insert into public.question_categories (code, name, depth, sort) values
 ('warmup','Na rozgrzewkę',1,1),('humor','Humor',1,2),('food','Jedzenie',1,3),('travel','Podróże',2,4),('childhood','Dzieciństwo',2,5),
 ('relations','Relacje',3,6),('character','Charakter',3,7),('ambitions','Ambicje',3,8),('lifestyle','Styl życia',2,9),
 ('worldview','Światopogląd',4,10),('dreams','Marzenia',4,11),('surprise','Pytania niespodziewane',2,12)
on conflict (code) do nothing;
insert into public.scenario_questions (category_code, text, depth)
select code, '[Placeholder] Pytanie z kategorii: ' || name, depth from public.question_categories c
where not exists (select 1 from public.scenario_questions q where q.category_code = c.code);
insert into public.table_games (code, name, description, rules, min_players, max_players) values
 ('two_truths','Dwie prawdy i kłamstwo','Każdy mówi trzy zdania o sobie — reszta zgaduje, które jest kłamstwem.','Kolejka zgodnie z ruchem wskazówek zegara.',3,10),
 ('guess_prefs','Zgadnij preferencje','Zgadujcie nawzajem ulubione smaki.','Punkt za trafienie.',2,8),
 ('this_or_that','To czy to?','Wybór pomiędzy dwiema opcjami.','Bez długiego zastanawiania się!',2,10),
 ('story60','Historia w 60 sekund','Opowiedz historię związaną z jedzeniem w minutę.','Stoper w telefonie.',2,10),
 ('dream_restaurant','Idealna restauracja','Wspólnie wymyślcie idealną restaurację.','Każdy dokłada jeden element.',2,8),
 ('tasting_challenge','Wyzwanie degustacyjne','Zgadnij składnik z zamkniętymi oczami.','Tylko za zgodą i bez alergenów uczestników.',2,6)
on conflict (code) do nothing;
insert into public.date_scenarios (level, name, description, question_categories)
select * from (values
 (1::smallint,'Pierwsza kolacja','Spotkanie w restauracji, pytania na rozgrzewkę.', array['warmup','food','humor']),
 (2::smallint,'Piknik z wymianą','Wymiana przygotowanych posiłków w parku.', array['travel','childhood','lifestyle']),
 (3::smallint,'Wspólne gotowanie','Wspólne przygotowanie potrawy (np. warsztaty kulinarne lub dom – tylko za obopólną zgodą).', array['dreams','ambitions','relations'])
) v(level, name, description, cats)
where not exists (select 1 from public.date_scenarios);
