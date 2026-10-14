-- =====================================================================
-- 011: mission catalog for 4 specializations (self-evidence MVP)
-- Uses existing reward_xp patterns (40–120). Does not invent new currencies.
-- =====================================================================

-- Deactivate legacy demo missions that conflict with new catalog names (keep completions via code FK)
update public.mission_definitions set is_active = false
where code in ('critic_three_pins','critic_best_dish','rescuer_foodshare','chef_signature','connector_open_table','explorer_three_recommended','romantic_tasting');

-- Helper: upsert mission
-- Detective
insert into public.mission_definitions (code, name, description, category, specialization_code, participation, difficulty, confirmation_method, duration_hours, reward_xp, repeat_reward_xp, repeat_limit, cooldown_hours, steps, safety_rules) values
('det_ghost_venue', 'Lokal Widmo', 'Znajdź knajpę, której nie ma jeszcze na mapie. Dodaj pinezkę z nazwą, lokalizacją, kategorią i podstawowymi informacjami.', 'restaurant', 'detective', 'solo', 1, 'self', 72, 60, 15, 0, 12, '["Znajdź lokal","Dodaj pin z GPS","Uzupełnij kategorię i opis","Dodaj dowód (opis lub zdjęcie)"]', null),
('det_unknown_cuisine', 'Operacja: Nieznana Kuchnia', 'Znajdź lokal z rzadką kuchnią (np. gruzińska, koreańska, wietnamska, etiopska). Jeśli go nie ma — dodaj pin.', 'restaurant', 'detective', 'solo', 2, 'self', 96, 70, 15, 0, 24, '["Wybierz rzadką kuchnię","Znajdź lokal","Dodaj lub zaktualizuj pin"]', null),
('det_two_tens', 'Obiad za Dwie Dychy', 'Znajdź lokal z obiadem do 20 zł. Podaj danie, cenę i źródło. Tag: Tanie.', 'restaurant', 'detective', 'solo', 2, 'self', 72, 70, 15, 0, 24, '["Znajdź ofertę ≤20 zł","Dodaj pin/tag Tanie","Opisz danie i cenę"]', null),
('det_off_radar', 'Lokal Poza Radarem', 'Odkryj miejsce łatwe do przeoczenia: podwórko, boczna uliczka, piętro, poza głównym szlakiem.', 'restaurant', 'detective', 'solo', 2, 'self', 96, 80, 20, 0, 24, '["Znajdź ukryty lokal","Dodaj pin","Opisz jak go znaleźć"]', null),
('det_blank_spot', 'Biała Plama na Mapie', 'Wybierz obszar z małą liczbą pinezek i znajdź tam nowy lokal.', 'travel', 'detective', 'solo', 2, 'self', 120, 80, 20, 0, 48, '["Znajdź rzadko zmapowany obszar","Dodaj nowy pin"]', null),
('det_tgtg', 'Misja: Ocalony Posiłek', 'Znajdź lokal z Too Good To Go lub podobną usługą. Tag: Paczki TGTG.', 'food_rescue', 'detective', 'solo', 2, 'self', 72, 70, 15, 0, 24, '["Znajdź ofertę TGTG","Dodaj/zaktualizuj pin","Dodaj tag Paczki TGTG"]', null),
('det_happy_hour', 'Godzina Słabości Cenowej', 'Znajdź knajpę z happy hours / lunch dnia. Tag: Happy-Hour.', 'restaurant', 'detective', 'solo', 2, 'self', 72, 70, 15, 0, 24, '["Znajdź promocję czasową","Zaktualizuj pin","Tag Happy-Hour"]', null),
('det_full_belly', 'Król Pełnego Brzucha', 'Sycący posiłek w budżecie do 25–30 zł. Tag: Duże porcje.', 'restaurant', 'detective', 'solo', 2, 'self', 72, 70, 15, 0, 24, '["Znajdź sycącą ofertę","Opisz danie","Tag Duże porcje"]', null),
('det_green_trail', 'Zielony Trop', 'Lokal z sensowną ofertą wege/wegańską. Tag: wegetariańskie lub wegańskie.', 'restaurant', 'detective', 'solo', 2, 'self', 72, 70, 15, 0, 24, '["Sprawdź menu","Dodaj pin z tagiem"]', null),
('det_no_traps', 'Menu Bez Pułapek', 'Lokal z oznaczonymi opcjami bezglutenowymi lub inną dietą. Potwierdź menu/obsługę.', 'restaurant', 'detective', 'solo', 2, 'self', 72, 70, 15, 0, 24, '["Zweryfikuj oznaczenia","Dodaj tag (np. bezglutenowe)"]', null),
('det_after_hours', 'Głód po Godzinach', 'Lokal z jedzeniem po 22:00. Zweryfikuj godziny. Tag: nocne.', 'restaurant', 'detective', 'solo', 2, 'self', 72, 70, 15, 0, 24, '["Sprawdź godziny","Tag nocne","Opisz ofertę"]', null),
('det_group_table', 'Stół dla Ekipy', 'Miejsce dobre dla grupy. Tag: grupowe.', 'social', 'detective', 'solo', 2, 'self', 72, 70, 15, 0, 24, '["Oceń pod kątem grupy","Tag grupowe"]', null),
('det_breakfast', 'Śniadaniowy Alarm', 'Śniadanie przed wyznaczoną godziną w rozsądnym budżecie. Tag: śniadania.', 'restaurant', 'detective', 'solo', 1, 'self', 48, 60, 15, 0, 12, '["Znajdź śniadanie","Tag śniadania"]', null),
('det_receipt', 'Operacja: Aktualny Paragon', 'Uzupełnij brakujące ceny, kategorie lub menu w istniejącym pinie (raz na pin za nagrodę — potwierdź w dowodzie).', 'review', 'detective', 'solo', 2, 'self', 72, 80, 10, 0, 24, '["Wybierz niepełny pin","Uzupełnij dane","Opisz co dodałeś"]', null),
('det_field_report', 'Raport z Miejsca Zdarzenia', 'Odwiedź lokal i oceń go kwestionariuszem Yummeet. Dodaj krótką opinię.', 'review', 'detective', 'solo', 2, 'self', 72, 80, 20, 0, 24, '["Odwiedź lokal","Wystaw ocenę","Napisz opinię"]', null),
('det_best_dessert', 'Najlepszy deser', 'Dodaj pin lokalu z najlepszym deserem. Opisz nazwę i cenę.', 'restaurant', 'detective', 'solo', 1, 'self', 48, 60, 15, 0, 12, '["Znajdź deser","Dodaj pin","Opisz i podaj cenę"]', null),
('det_baker', 'Pan Piekarz', 'Dodaj pin z kategorią Piekarnia.', 'restaurant', 'detective', 'solo', 1, 'self', 48, 50, 10, 0, 12, '["Znajdź piekarnię","Dodaj pin z kategorią"]', null)
on conflict (code) do update set
  name = excluded.name, description = excluded.description, specialization_code = excluded.specialization_code,
  reward_xp = excluded.reward_xp, steps = excluded.steps, is_active = true, confirmation_method = excluded.confirmation_method;

-- Host
insert into public.mission_definitions (code, name, description, category, specialization_code, participation, difficulty, confirmation_method, duration_hours, reward_xp, repeat_reward_xp, repeat_limit, cooldown_hours, steps, safety_rules) values
('host_empty_table', 'Pusty Stół Czeka', 'Zorganizuj pierwsze otwarte spotkanie: miejsce, termin, temat.', 'social', 'host', 'group', 1, 'self', 168, 80, 20, 0, 48, '["Utwórz stół w aplikacji","Opublikuj","Po spotkaniu dodaj dowód"]', 'Określ jasno miejsce i zasady. Zgłaszaj niewłaściwe zachowania.'),
('host_singles', 'Dla singli', 'Kameralne spotkanie dla singli chcących się poznać.', 'dating', 'host', 'group', 2, 'self', 168, 90, 20, 0, 48, '["Utwórz stół","Opisz zasady","Zrealizuj i opisz przebieg"]', 'Pierwsze spotkania w miejscach publicznych.'),
('host_picnic', 'Piknik Bez Biletu Wstępu', 'Plenerowe spotkanie z własnym prowiantem + plan na złą pogodę.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Wybierz miejsce","Ustal godzinę","Zrealizuj"]', null),
('host_skills_share', 'Każdy Umie Coś, Czego Ty Nie Umiesz', 'Spotkanie wymiany umiejętności / wskazówek.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Utwórz stół","Zaproś uczestników","Opisz co się wydarzyło"]', null),
('host_problem_idea', 'Mam Problem, Mam Pomysł', 'Spotkanie rozwiązywania małych problemów wspólnie.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Utwórz stół tematyczny","Poprowadź rundę problemów","Podsumuj"]', null),
('host_idea_market', 'Giełda Pomysłów', 'Jeden temat (zarobek, inicjatywa, projekt) — wymiana inspiracji.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Wybierz temat w opisie stołu","Zorganizuj","Opisz wnioski"]', null),
('host_babel', 'Wieża Babel', 'Spotkanie do ćwiczenia języków obcych.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Wskaż język","Utwórz stół","Zrealizuj"]', null),
('host_other_view', 'Świat Widziany Inaczej', 'Spokojna dyskusja o temacie z różnymi opiniami.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Wybierz temat","Ustal zasady szacunku","Zrealizuj"]', null),
('host_one_book', 'Jedna Książka, Wiele Światów', 'Spotkanie wokół książki/filmu/podcastu.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Wskaż materiał","Utwórz stół","Podsumuj"]', null),
('host_other_side', 'Po Drugiej Stronie Zawodu', 'Rozmowa o realiach różnych branż (bez rekrutacji/sprzedaży).', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Utwórz stół","Zbieraj zawody uczestników","Zrealizuj"]', null),
('host_small_change', 'Mała Zmiana, Wielka Sprawa', 'Lokalna inicjatywa / pierwszy wspólny krok.', 'volunteer', 'host', 'group', 3, 'self', 240, 100, 25, 0, 72, '["Wybierz cel","Ustal pierwszy krok","Udokumentuj"]', null),
('host_no_waste', 'Nic Się Nie Marnuje', 'Wymiana książek, roślin, gier, sprawnych przedmiotów.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Utwórz wymianę","Zrealizuj","Opisz"]', null),
('host_from_scratch', 'Projekt z Niczego', 'W jednym spotkaniu wymyślcie mały wspólny projekt.', 'social', 'host', 'group', 3, 'self', 168, 90, 20, 0, 48, '["Zbierz grupę","Wymyślcie projekt","Zapisz plan"]', null),
('host_chess', 'Gambit Towarzyski', 'Otwarte spotkanie szachowe.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Utwórz stół szachowy","Zrealizuj"]', null),
('host_boardgames', 'Plansza Łączy Ludzi', 'Wieczór gier planszowych/karcianych.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Wybierz gry łatwe do dołączenia","Zorganizuj"]', null),
('host_quiz', 'Turniej Wiedzy Bezużytecznej', 'Quiz z ciekawostek / popkultury.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Przygotuj pytania","Poprowadź quiz"]', null),
('host_curious', 'Klub Ludzi Ciekawych', 'Uczestnicy pokazują hobby.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Utwórz stół","Zrealizuj prezentacje hobby"]', null),
('host_three_steps', 'Trzy Kroki Naprzód', 'Każdy przedstawia cel i mały krok; inni proponują pomoc bez wykładów.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Utwórz stół","Poprowadź rundę celów"]', null),
('host_elder_wolf', 'Wiedza Starszego Wilka', 'Doświadczeni dzielą się wiedzą z początkującymi (ekspert vs uczestnicy).', 'social', 'host', 'group', 2, 'self', 168, 90, 20, 0, 48, '["Wybierz dziedzinę","Rozdziel role","Zrealizuj"]', null),
('host_map_ops', 'Mapa Możliwości', 'Spotkanie o lokalnych możliwościach: kursy, kluby, eventy.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Zbierz tipy","Podziel się listą"]', null),
('host_tasting', 'Wielka Degustacja', 'Spotkanie z pizzami/daniami do dzielenia — każdy sam decyduje o zamówieniu.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Utwórz stół","Zrealizuj degustację"]', null),
('host_sugar', 'Rada Miłośników Cukru', 'Spotkanie o deserach / cukiernia / własna degustacja.', 'social', 'host', 'group', 2, 'self', 168, 80, 20, 0, 48, '["Utwórz stół deserowy","Zrealizuj"]', null)
on conflict (code) do update set name = excluded.name, description = excluded.description, specialization_code = excluded.specialization_code, reward_xp = excluded.reward_xp, steps = excluded.steps, is_active = true;

-- Alchemist
insert into public.mission_definitions (code, name, description, category, specialization_code, participation, difficulty, confirmation_method, duration_hours, reward_xp, repeat_reward_xp, repeat_limit, cooldown_hours, steps, safety_rules) values
('alc_four_ingredients', 'Cztery Składniki, Zero Wymówek', 'Zrób fuzję dwóch potraw. Zdjęcie, przepis, krótki opis.', 'cooking', 'alchemist', 'solo', 2, 'self', 96, 80, 20, 0, 24, '["Wybierz 2 potrawy","Ugotuj fuzję","Dodaj zdjęcie i przepis"]', null),
('alc_last_zloty', 'Bitwa o Ostatnią Złotówkę', 'Pełnowartościowy posiłek jak najtaniej. Podaj koszt i liczbę porcji.', 'cooking', 'alchemist', 'solo', 2, 'self', 96, 80, 20, 0, 24, '["Ugotuj tanio","Policz koszt","Opublikuj wynik"]', null),
('alc_vs_restaurant', 'Restauracja kontra Twoja Kuchnia', 'Odtwórz danie z restauracji w domu. Porównaj koszt i wnioski.', 'cooking', 'alchemist', 'solo', 3, 'self', 120, 100, 25, 0, 48, '["Wybierz danie","Ugotuj wersję domową","Porównaj"]', null),
('alc_no_passport', 'Podróż Bez Paszportu', 'Wylosuj rzadką kuchnię kraju i ugotuj charakterystyczne danie.', 'cooking', 'alchemist', 'solo', 2, 'self', 96, 80, 20, 0, 24, '["Wylosuj kuchnię (lub wybierz rzadką)","Ugotuj","Opisz inspirację"]', null),
('alc_level_up', 'Awans Alchemika', 'Przećwicz jedną technikę (sos, ciasto, karmelizacja…). Publikuj wnioski.', 'cooking', 'alchemist', 'solo', 2, 'self', 96, 70, 15, 0, 24, '["Wybierz technikę","Ćwicz","Pokaż rezultat"]', null),
('alc_first_swap', 'Pierwsza Zamiana Obiadów', 'Zaproponuj wymianę posiłków z innym Yummiterem.', 'food_exchange', 'alchemist', 'pair', 2, 'peer', 120, 100, 25, 0, 48, '["Ustal danie i porcje","Wymień w miejscu publicznym","Poproś o potwierdzenie"]', 'Bez pól ceny w aplikacji — ustalenia poza płatnościami platformy. Alergeny obowiązkowe.'),
('alc_lunch_for_lunch', 'Obiad za Obiad', 'Wzajemne gotowanie na żądanie z drugim Yummiterem.', 'food_exchange', 'alchemist', 'pair', 3, 'peer', 168, 110, 30, 0, 72, '["Uzgodnijcie dania","Przygotujcie","Potwierdźcie odbiór"]', 'Aplikacja nie pośredniczy w płatnościach.'),
('alc_specialty_swap', 'Specjalność za Specjalność', 'Wymiana popisowych potraw z kimś o innej specjalności.', 'food_exchange', 'alchemist', 'pair', 3, 'peer', 168, 110, 30, 0, 72, '["Wybierz popisowe danie","Znajdź partnera","Wymień"]', null),
('alc_pan_secret', 'Sekret Mistrza Patelni', 'Opublikuj sprawdzony trik kulinarny z rezultatem.', 'cooking', 'alchemist', 'solo', 1, 'self', 72, 60, 15, 0, 24, '["Opisz trik","Pokaż efekt","Wyjaśnij dlaczego działa"]', null),
('alc_apprentice', 'Ucznia Przyjmę', 'Naucz drugiego Yummitera jednej umiejętności kulinarnej.', 'cooking', 'alchemist', 'pair', 3, 'peer', 120, 100, 25, 0, 48, '["Umów spotkanie","Naucz techniki","Poproś o potwierdzenie"]', 'Miejsce publiczne lub uzgodnione bezpiecznie.'),
('alc_recipe_story', 'Przepis z Historią', 'Przepis z proporcjami, czasem, kosztem i unikalną wskazówką.', 'cooking', 'alchemist', 'solo', 2, 'self', 96, 80, 20, 0, 24, '["Zapisz przepis","Dodaj wskazówkę","Opublikuj"]', null),
('alc_signature', 'Mój Kulinarny Znak Firmowy', 'Opisz popisową potrawę w profilu (zdjęcie, koszt, porcje). Wymiana od poziomu umiejętności 3.', 'cooking', 'alchemist', 'solo', 2, 'self', 96, 80, 20, 0, 48, '["Uzupełnij profil kulinarny","Dodaj popisowe danie","Dołącz dowód"]', null),
('alc_first_order', 'Pierwsze Zamówienie', 'Udostępnij ofertę dania na zamówienie (bez pola ceny w apce) i przyjmij pierwsze zlecenie.', 'cooking', 'alchemist', 'pair', 3, 'peer', 168, 120, 30, 0, 72, '["Opisz ofertę i alergeny","Przyjmij zlecenie","Potwierdź realizację"]', 'Wymaga oświadczeń sanitarno-prawnych przy włączeniu gotowania odpłatnego. Aplikacja nie jest sprzedawcą.'),
('alc_cover_ingredients', 'Gotuję, Ty Pokrywasz Składniki', 'Oferta gotowania za zwrot kosztów składników (ustalenia poza apką).', 'cooking', 'alchemist', 'pair', 3, 'peer', 168, 110, 30, 0, 72, '["Opisz ofertę","Uzgodnij warunki","Zrealizuj z potwierdzeniem"]', 'Bez pól finansowych w aplikacji.'),
('alc_menu_wish', 'Menu na Życzenie', 'Dodaj do profilu opis 3 potraw możliwych na zamówienie.', 'cooking', 'alchemist', 'solo', 2, 'self', 96, 70, 15, 0, 48, '["Opisz 3 potrawy","Alergeny","Warunki odbioru"]', null),
('alc_duet', 'Duet przy Desce', 'Wspólne danie z drugim Yummiterem z podziałem pracy.', 'cooking', 'alchemist', 'pair', 3, 'peer', 120, 100, 25, 0, 48, '["Znajdź partnera","Ugotujcie razem","Potwierdźcie"]', null),
('alc_tasters_table', 'Stół Degustatorów', 'Małe spotkanie z własnymi potrawami i konstruktywną opinią.', 'social', 'alchemist', 'group', 3, 'self', 168, 100, 25, 0, 72, '["Zorganizuj degustację","Zbierz opinie"]', null),
('alc_three_versions', 'Jedno Danie, Trzy Wersje', 'Wyzwanie: trzy wersje tej samej potrawy z innymi Yummiterami.', 'cooking', 'alchemist', 'group', 3, 'self', 168, 110, 30, 0, 72, '["Wybierz danie","Zaproś 2 osoby","Porównajcie wyniki"]', null),
('alc_bigger_cause', 'Garnek Dla Większej Sprawy', 'Gotowanie na inicjatywę społeczną / zbiórkę.', 'volunteer', 'alchemist', 'group', 3, 'self', 240, 120, 30, 0, 72, '["Ustal odbiorców","Przygotuj bezpiecznie","Przekaż i udokumentuj"]', 'Bezpieczeństwo żywności priorytetem.')
on conflict (code) do update set name = excluded.name, description = excluded.description, specialization_code = excluded.specialization_code, reward_xp = excluded.reward_xp, steps = excluded.steps, is_active = true;

-- Guardian
insert into public.mission_definitions (code, name, description, category, specialization_code, participation, difficulty, confirmation_method, duration_hours, reward_xp, repeat_reward_xp, repeat_limit, cooldown_hours, steps, safety_rules) values
('gua_bakery_bell', 'Ostatni Dzwonek Piekarni', 'Piekarnia z przeceną/przekazaniem pieczywa. Tagi: Piekarnia, Przeceny.', 'food_rescue', 'guardian', 'solo', 2, 'self', 72, 70, 15, 0, 24, '["Znajdź piekarnię","Dodaj/zaktualizuj pin","Opisz godziny odbioru"]', null),
('gua_saved_pastry', 'Misja: Ocalony Wypiek', 'Nadwyżki cukierni/kawiarni. Tagi: Cukiernia, Przeceny.', 'food_rescue', 'guardian', 'solo', 2, 'self', 72, 70, 15, 0, 24, '["Znajdź ofertę","Zaktualizuj pin"]', null),
('gua_last_chance', 'Paczka Ostatniej Szansy', 'Odbierz paczkę TGTG/podobną. Opisz zawartość i wykorzystanie.', 'food_rescue', 'guardian', 'solo', 2, 'self', 72, 80, 20, 0, 24, '["Odbierz paczkę","Opisz","Zaktualizuj pin lokalu"]', null),
('gua_last_portion', 'Ostatnia Porcja Przed Zamknięciem', 'Lokal przekazujący niesprzedane posiłki. Tag: Jadłodzielnia / zasady odbioru.', 'food_rescue', 'guardian', 'solo', 3, 'self', 96, 90, 20, 0, 48, '["Ustal zasady z personelem","Opisz w pinie"]', null),
('gua_open_pantry', 'Spiżarnia Otwartych Drzwi', 'Opublikuj jedzenie do bezpiecznego oddania (alergeny, czas, przechowywanie).', 'food_rescue', 'guardian', 'solo', 2, 'self', 48, 80, 20, 0, 12, '["Opisz posiłek i alergeny","Ustal okno odbioru","Dodaj dowód"]', 'Nie publikuj żywności niepewnej lub po terminie „należy spożyć do”.'),
('gua_good_taste_courier', 'Kurier Dobrego Smaku', 'Odbierz jedzenie od Yummitera i zanieś do jadłodzielni.', 'food_rescue', 'guardian', 'pair', 3, 'peer', 96, 100, 25, 0, 48, '["Uzgodnij odbiór","Dostarcz","Potwierdź"]', 'Bez fotografowania obcych osób.'),
('gua_second_life_map', 'Mapa Drugiego Życia', 'Znajdź jadłodzielnię: lokalizacja, godziny, zasady. Dodaj pin.', 'food_rescue', 'guardian', 'solo', 2, 'self', 96, 80, 20, 0, 48, '["Znajdź punkt","Dodaj pin","Opisz zasady"]', null),
('gua_course_fridge', 'Kurs na Jadłodzielnię', 'Przetransportuj produkty do jadłodzielni i udokumentuj przekazanie.', 'food_rescue', 'guardian', 'solo', 2, 'self', 72, 90, 20, 0, 24, '["Zanieś produkty","Udokumentuj bez twarzy osób"]', null),
('gua_still_alive', 'Punkt, Który Nadal Żyje', 'Zweryfikuj stan jadłodzielni i zaktualizuj pin (tylko gdy coś jest).', 'food_rescue', 'guardian', 'solo', 2, 'self', 48, 70, 15, 0, 12, '["Sprawdź lodówkę","Zaktualizuj opis + zdjęcie produktów"]', null),
('gua_red_labels', 'Czerwone Etykiety', 'Sklep z przecenami krótkiego terminu. Opisz pory przecen.', 'food_rescue', 'guardian', 'solo', 2, 'self', 72, 70, 15, 0, 24, '["Znajdź sklep","Opisz przeceny","Zachęć do Yummeet"]', null),
('gua_greengrocer', 'Sekret Warzywniaka', 'Warzywniak z tańszymi produktami do szybkiego użycia.', 'food_rescue', 'guardian', 'solo', 2, 'self', 72, 70, 15, 0, 24, '["Znajdź punkt","Opisz oferty i godziny"]', null),
('gua_restaurant_ally', 'Sojusz z restauracją', 'Nawiąż kontakt z lokalem ograniczającym marnowanie; zachęć do apki.', 'food_rescue', 'guardian', 'solo', 3, 'self', 120, 100, 25, 0, 72, '["Porozmawiaj z lokalem","Opisz ustalenia","Zaktualizuj pin"]', null)
on conflict (code) do update set name = excluded.name, description = excluded.description, specialization_code = excluded.specialization_code, reward_xp = excluded.reward_xp, steps = excluded.steps, is_active = true;

-- Keep starter_hello active
update public.mission_definitions set is_active = true where code = 'starter_hello';
