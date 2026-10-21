-- =====================================================================
-- 023: Karty do księgi ↔ misje (Smaczne Odkrycia + Gospodarz Stołu)
-- Po ukończeniu misji gracz dostaje konkretną kartę collectible.
-- =====================================================================

-- Usuń stare losowe nagrody dla tych misji (jeśli ktoś dodał ręcznie)
delete from public.card_rewards
where mission_id in (
  select id from public.mission_definitions
  where code like 'det_%' or code like 'host_%'
);

-- --- Smaczne Odkrycia (detective) — karty 1–17 ---
insert into public.card_definitions (
  code, name, lore, category, kind, rarity, art_key, effect, challenge_text, challenge_hours,
  specialization_code, set_code, obtain_conditions, confirmation_required
) values
('book_det_ghost_venue', 'Lokal Widmo', '„Jeśli nie ma go na mapie, to znaczy, że właśnie na Ciebie czeka.”', 'mission_book', 'offensive', 'rare', 'sheet_smaczne_odkrycia',
 'Dodaj nowy pin lokalu, którego jeszcze nie ma w Yummeet.', 'Znajdź działający lokal spoza mapy Yummeet i dodaj jego pinezkę.', 48, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Lokal Widmo', 'Nowy pin + potwierdzenie istnienia'),
('book_det_unknown_cuisine', 'Agent Nieznanej Kuchni', '„Dziś jesz coś, czego nie umiesz nawet wymówić.”', 'mission_book', 'offensive', 'common', 'sheet_smaczne_odkrycia',
 'Odkryj lokal z kuchnią, której jeszcze nie próbowałeś.', 'Znajdź lokal z kuchnią, której jeszcze nie próbowałeś.', 120, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Operacja: Nieznana Kuchnia', 'Pin z opisem i kategorią'),
('book_det_two_tens', 'Obiad za Dwie Dychy', '„Dwie dychy. Jedno danie. Zero wymówek.”', 'mission_book', 'offensive', 'common', 'sheet_smaczne_odkrycia',
 'Znajdź obiad w niskim budżecie i opublikuj go.', 'Znajdź obiad do ok. 25 zł i opublikuj go.', 72, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Obiad za Dwie Dychy', 'Menu, cennik lub zdjęcie'),
('book_det_off_radar', 'Mistrz Bocznej Uliczki', '„Główna ulica jest dla turystów. Ty idziesz tam, gdzie pachnie.”', 'mission_book', 'offensive', 'common', 'sheet_smaczne_odkrycia',
 'Odkryj lokal poza głównym szlakiem.', 'Odkryj lokal zbaczający z głównej ścieżki.', 72, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Lokal Poza Radarem', 'Pin i zdjęcie lokalu/wejścia'),
('book_det_blank_spot', 'Zapełniacz Białych Plam', '„Gdzie mapa milczy — Ty mówisz pierwszym pinem.”', 'mission_book', 'offensive', 'rare', 'sheet_smaczne_odkrycia',
 'Znajdź lokal w obszarze z małą liczbą pinezek.', 'Znajdź lokal w okolicy z bardzo małą liczbą pinów.', 120, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Biała Plama na Mapie', 'Pin i potwierdzenie lokalizacji'),
('book_det_tgtg', 'Łowca Ocalonych Paczek', '„To nie resztki. To druga szansa na smak.”', 'mission_book', 'offensive', 'rare', 'sheet_smaczne_odkrycia',
 'Znajdź ofertę paczek TGTG / ocalonych posiłków.', 'Znajdź lokal oferujący paczki Too Good To Go (lub podobne).', 120, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Misja: Ocalony Posiłek', 'Szczegóły oferty (źródło, cena, data)'),
('book_det_happy_hour', 'Godzina Słabości Cenowej', '„Ceny też mają swoje słabe chwile.”', 'mission_book', 'offensive', 'common', 'sheet_smaczne_odkrycia',
 'Znajdź promocję czasową (happy hour / lunch).', 'Znajdź promocję ograniczoną czasowo (Happy Hour).', 72, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Godzina Słabości Cenowej', 'Cena przed/po, godziny i warunki'),
('book_det_full_belly', 'Król Pełnego Brzucha', '„Sytność to też kategoria jakości.”', 'mission_book', 'offensive', 'common', 'sheet_smaczne_odkrycia',
 'Znajdź sycący posiłek w budżecie.', 'Znajdź sycący posiłek do ok. 25 zł i opisz porcję.', 72, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Król Pełnego Brzucha', 'Menu, zdjęcie i cena'),
('book_det_green_trail', 'Zielony Trop', '„Zielone nie znaczy nudne — znaczy świadome.”', 'mission_book', 'offensive', 'common', 'sheet_smaczne_odkrycia',
 'Znajdź lokal z pełnym menu wege/vegan.', 'Znajdź lokal z pełnymi daniami wegetariańskimi/wegańskimi.', 72, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Zielony Trop', 'Zaktualizowany pin/menu'),
('book_det_no_traps', 'Inspektor Menu', '„Jedna gwiazdka przy alergenie potrafi uratować wieczór.”', 'mission_book', 'offensive', 'rare', 'sheet_smaczne_odkrycia',
 'Zweryfikuj opcje dietetyczne w lokalu.', 'Zweryfikuj opcje dietetyczne (np. bezglutenowe) w lokalu.', 120, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Menu Bez Pułapek', 'Menu lub info od lokalu'),
('book_det_after_hours', 'Nocny Żarłok', '„Gdy miasto śpi, kuchnia dopiero się budzi.”', 'mission_book', 'offensive', 'common', 'sheet_smaczne_odkrycia',
 'Znajdź lokal otwarty po 22:00.', 'Znajdź lokal otwarty po 22:00.', 120, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Głód po Godzinach', 'Godziny otwarcia i opis menu'),
('book_det_group_table', 'Dowódca Głodnej Ekipy', '„Jeden stół. Wiele apetytów. Zero chaosu.”', 'mission_book', 'offensive', 'common', 'sheet_smaczne_odkrycia',
 'Znajdź lokal dobry dla grup.', 'Znajdź lokal odpowiedni dla grup (stoliki, rezerwacje).', 120, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Stół dla Ekipy', 'Pin z info dla grup'),
('book_det_breakfast', 'Alarm Śniadaniowy', '„Kto wstaje z kurami, ten je najlepsze jajka.”', 'mission_book', 'offensive', 'common', 'sheet_smaczne_odkrycia',
 'Znajdź miejsce ze śniadaniami we wczesnych godzinach.', 'Znajdź miejsce serwujące śniadania przed wyznaczoną godziną.', 72, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Śniadaniowy Alarm', 'Menu śniadaniowe i godziny'),
('book_det_receipt', 'Paragonowy Detektyw', '„Cena bez źródła to plotka. Paragon to dowód.”', 'mission_book', 'offensive', 'common', 'sheet_smaczne_odkrycia',
 'Uzupełnij brakujące ceny w istniejącym pinie.', 'Uzupełnij brakującą cenę przy istniejącym pinie.', 48, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Operacja: Aktualny Paragon', 'Menu, cennik lub inne źródło'),
('book_det_field_report', 'Krytyk po Przejściach', '„Byłem. Jadłem. Oddaję sprawiedliwość.”', 'mission_book', 'offensive', 'rare', 'sheet_smaczne_odkrycia',
 'Odwiedź lokal i wypełnij ankietę Yummeet.', 'Odwiedź lokal i wypełnij ankietę Yummeet.', 168, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Raport z Miejsca Zdarzenia', 'Zapisana ankieta i potwierdzenie wizyty'),
('book_det_best_dessert', 'Łowca Słodkiego Graala', '„Deser to nie dodatek. To destynacja.”', 'mission_book', 'offensive', 'common', 'sheet_smaczne_odkrycia',
 'Dodaj lokal z polecanym deserem i ceną.', 'Dodaj lokal z polecanym deserem i jego ceną.', 72, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Najlepszy deser', 'Zdjęcie deseru i menu/cennik'),
('book_det_baker', 'Pan Piekarz', '„Pierwszy zapach dnia należy do pieczywa.”', 'mission_book', 'offensive', 'common', 'sheet_smaczne_odkrycia',
 'Dodaj lub zweryfikuj piekarnię na mapie.', 'Dodaj lub zweryfikuj piekarnię, której nie ma jeszcze na mapie.', 72, 'detective', 'smaczne_odkrycia',
 'Ukończ misję Pan Piekarz', 'Nowy pin i potwierdzenie istnienia')
on conflict (code) do update set
  name = excluded.name, lore = excluded.lore, rarity = excluded.rarity, art_key = excluded.art_key,
  effect = excluded.effect, challenge_text = excluded.challenge_text, challenge_hours = excluded.challenge_hours,
  specialization_code = excluded.specialization_code, set_code = excluded.set_code,
  obtain_conditions = excluded.obtain_conditions, confirmation_required = excluded.confirmation_required,
  status = 'published';

-- --- Klasa II: Gospodarz Stołu — karty z arkusza + brakujące misje ---
insert into public.card_definitions (
  code, name, lore, category, kind, rarity, art_key, effect, challenge_text, challenge_hours,
  specialization_code, set_code, obtain_conditions, confirmation_required
) values
('book_host_empty_table', 'Pusty Stół Czeka', '„Masz stół. Masz termin. Teraz znajdź ludzi.”', 'mission_book', 'offensive', 'rare', 'sheet_gospodarz_stolu',
 'Opublikuj otwarte spotkanie w Yummeet.', 'Opublikuj otwarte spotkanie z datą, miejscem i liczbą miejsc.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Pusty Stół Czeka', 'Opublikowane wydarzenie'),
('book_host_singles', 'Amor od Rezerwacji', '„Strzała Amora? Nie. Powiadomienie o wolnym miejscu.”', 'mission_book', 'offensive', 'epic', 'sheet_gospodarz_stolu',
 'Zorganizuj spotkanie dla singli / speed dating.', 'Zorganizuj spotkanie speed dating według zasad i przeprowadź je.', 336, 'host', 'gospodarz_stolu',
 'Ukończ misję Dla singli', 'Wydarzenie + potwierdzenie organizatora i min. 1 uczestnika'),
('book_host_picnic', 'Piknik Bez Wymówek', '„Pogoda jest wymówką. Kanapka jest planem.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Opublikuj piknik z planem B na złą pogodę.', 'Opublikuj piknik z punktem zbiórki i planem na złą pogodę.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Piknik Bez Biletu Wstępu', 'Wydarzenie i plan organizacyjny'),
('book_host_skills_share', 'Każdy Umie Coś, Czego Ty Nie Umiesz', '„Nowa umiejętność = nowa znajomość.”', 'mission_book', 'offensive', 'rare', 'sheet_gospodarz_stolu',
 'Zorganizuj wymianę umiejętności.', 'Zorganizuj spotkanie wymiany umiejętności.', 336, 'host', 'gospodarz_stolu',
 'Ukończ misję Każdy Umie Coś…', 'Podsumowanie i potwierdzenie'),
('book_host_problem_idea', 'Mam Problem, Mam Pomysł', '„Problem wnosisz ty. Rozwiązanie może wnieść ktoś z herbatą.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj spotkanie rozwiązywania problemów.', 'Zorganizuj spotkanie, na którym uczestnicy wspólnie szukają rozwiązań.', 336, 'host', 'gospodarz_stolu',
 'Ukończ misję Mam Problem, Mam Pomysł', 'Podsumowanie spotkania'),
('book_host_idea_market', 'Giełda Pomysłów', '„Jeden temat. Wiele głów. Co najmniej jedna inspiracja na wyjście.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj giełdę pomysłów.', 'Zorganizuj spotkanie wymiany pomysłów na wybrany temat.', 336, 'host', 'gospodarz_stolu',
 'Ukończ misję Giełda Pomysłów', 'Podsumowanie / lista inspiracji'),
('book_host_babel', 'Poliglota po Kawie', '„Mówisz po angielsku? To teraz zamów kawę po hiszpańsku.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj spotkanie językowe.', 'Zorganizuj spotkanie językowe w wybranym języku i poziomie.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Wieża Babel', 'Wydarzenie i plan spotkania'),
('book_host_other_view', 'Dyplomata Przy Stole', '„Nie musisz wygrać dyskusji. Wystarczy, że nie przewrócisz stołu.”', 'mission_book', 'offensive', 'rare', 'sheet_gospodarz_stolu',
 'Zorganizuj moderowaną dyskusję.', 'Zorganizuj moderowaną rozmowę na temat, w którym opinie się różnią.', 336, 'host', 'gospodarz_stolu',
 'Ukończ misję Świat Widziany Inaczej', 'Temat, zasady i podsumowanie'),
('book_host_one_book', 'Recenzent Recenzentów', '„Film trwał dwie godziny. Dyskusja potrwa do zamknięcia lokalu.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj spotkanie o książce/filmie/podcaście.', 'Zorganizuj spotkanie wokół książki, filmu, podcastu lub artykułu.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Jedna Książka, Wiele Światów', 'Wydarzenie i plan dyskusji'),
('book_host_other_side', 'Szpieg Zawodowy', '„Czym się zajmujesz? Tym razem odpowiedź może być dłuższa.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj rozmowę o zawodach.', 'Zorganizuj spotkanie o zawodach, ścieżkach kariery i doświadczeniach.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Po Drugiej Stronie Zawodu', 'Temat, plan i potwierdzenie'),
('book_host_small_change', 'Bohater Osiedla', '„Nie musisz ratować świata. Zacznij od swojej ulicy.”', 'mission_book', 'offensive', 'epic', 'sheet_gospodarz_stolu',
 'Zorganizuj akcję dla lokalnej społeczności.', 'Zorganizuj spotkanie i akcję na rzecz lokalnej społeczności.', 336, 'host', 'gospodarz_stolu',
 'Ukończ misję Mała Zmiana, Wielka Sprawa', 'Opis akcji i potwierdzenie'),
('book_host_no_waste', 'Nic Się Nie Marnuje', '„Jedna rzecz mniej w szafie. Jedna radość więcej u kogoś innego.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj wymianę rzeczy.', 'Zorganizuj spotkanie wymiany książek, roślin, gier lub przedmiotów.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Nic Się Nie Marnuje', 'Wydarzenie i zasady wymiany'),
('book_host_from_scratch', 'Projektant Chaosu', '„Siedem osób. Dwanaście pomysłów. Jeden wspólny dokument.”', 'mission_book', 'offensive', 'rare', 'sheet_gospodarz_stolu',
 'Zorganizuj spotkanie i wspólny plan projektu.', 'Zorganizuj spotkanie i opracuj mały plan projektu z uczestnikami.', 336, 'host', 'gospodarz_stolu',
 'Ukończ misję Projekt z Niczego', 'Plan z podziałem zadań i krokiem 1'),
('book_host_chess', 'Gambit Towarzyski', '„Szach-mat. A potem: któż jeszcze chce zagrać?”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Opublikuj otwarte spotkanie szachowe.', 'Opublikuj otwarte spotkanie szachowe także dla początkujących.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Gambit Towarzyski', 'Wydarzenie z datą i zasadami'),
('book_host_boardgames', 'Planszowy Rozjemca', '„Przyszliście pograć. Teraz kłócicie się o zasady.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj wieczór gier planszowych/karcianych.', 'Zorganizuj wieczór gier planszowych lub karcianych.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Plansza Łączy Ludzi', 'Wydarzenie z info o grach'),
('book_host_quiz', 'Profesor Bezużytecznej Wiedzy', '„Wreszcie ktoś docenił, że pamiętasz wszystkie stolice.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj quiz z pytaniami i zasadami.', 'Zorganizuj quiz z przynajmniej kilkoma pytaniami i zasadami.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Turniej Wiedzy Bezużytecznej', 'Zestaw pytań i podsumowanie'),
('book_host_curious', 'Muzeum Dziwnych Talentów', '„Tak, robienie żurawi z papieru też jest talentem.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj pokaz hobby i nietypowych umiejętności.', 'Zorganizuj spotkanie, na którym uczestnicy pokażą hobby, kolekcje lub nietypowe umiejętności.', 336, 'host', 'gospodarz_stolu',
 'Ukończ misję Klub Ludzi Ciekawych', 'Opis i potwierdzenie wydarzenia'),
('book_host_three_steps', 'Trzy Kroki Naprzód', '„Cel bez kroku to marzenie. Krok bez celu to błądzenie.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj spotkanie celów i małych kroków.', 'Zorganizuj spotkanie, na którym każdy przedstawia cel i najbliższy mały krok.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Trzy Kroki Naprzód', 'Podsumowanie celów'),
('book_host_elder_wolf', 'Wiedza Starszego Wilka', '„Doświadczenie smakuje najlepiej, gdy się nim dzielisz.”', 'mission_book', 'offensive', 'rare', 'sheet_gospodarz_stolu',
 'Zorganizuj mentoring / wiedzę od doświadczonych.', 'Zorganizuj spotkanie, na którym doświadczeni dzielą się wiedzą z początkującymi.', 336, 'host', 'gospodarz_stolu',
 'Ukończ misję Wiedza Starszego Wilka', 'Temat i potwierdzenie'),
('book_host_map_ops', 'Mapa Możliwości', '„Nie wiedziałeś, że to istnieje — aż ktoś otworzył mapę.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj spotkanie o lokalnych możliwościach.', 'Zorganizuj spotkanie o kursach, inicjatywach i możliwościach w okolicy.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Mapa Możliwości', 'Lista odkryć / podsumowanie'),
('book_host_tasting', 'Wielka Degustacja', '„Jeden stół. Wiele talerzy. Jeszcze więcej rozmów.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj degustację dań do dzielenia.', 'Zorganizuj spotkanie degustacyjne z daniami do dzielenia się.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Wielka Degustacja', 'Wydarzenie i potwierdzenie'),
('book_host_sugar', 'Rada Miłośników Cukru', '„Deser łączy pewniej niż polityka.”', 'mission_book', 'offensive', 'common', 'sheet_gospodarz_stolu',
 'Zorganizuj spotkanie o słodkościach.', 'Zorganizuj spotkanie poświęcone deserom i słodyczom.', 168, 'host', 'gospodarz_stolu',
 'Ukończ misję Rada Miłośników Cukru', 'Wydarzenie i potwierdzenie')
on conflict (code) do update set
  name = excluded.name, lore = excluded.lore, rarity = excluded.rarity, art_key = excluded.art_key,
  effect = excluded.effect, challenge_text = excluded.challenge_text, challenge_hours = excluded.challenge_hours,
  specialization_code = excluded.specialization_code, set_code = excluded.set_code,
  obtain_conditions = excluded.obtain_conditions, confirmation_required = excluded.confirmation_required,
  status = 'published';

-- --- Powiązania: misja → konkretna karta (1:1, first time) ---
insert into public.card_rewards (mission_id, card_id, kind, rarity, count, first_time_only)
select m.id, c.id, c.kind, c.rarity, 1, true
from (values
  ('det_ghost_venue', 'book_det_ghost_venue'),
  ('det_unknown_cuisine', 'book_det_unknown_cuisine'),
  ('det_two_tens', 'book_det_two_tens'),
  ('det_off_radar', 'book_det_off_radar'),
  ('det_blank_spot', 'book_det_blank_spot'),
  ('det_tgtg', 'book_det_tgtg'),
  ('det_happy_hour', 'book_det_happy_hour'),
  ('det_full_belly', 'book_det_full_belly'),
  ('det_green_trail', 'book_det_green_trail'),
  ('det_no_traps', 'book_det_no_traps'),
  ('det_after_hours', 'book_det_after_hours'),
  ('det_group_table', 'book_det_group_table'),
  ('det_breakfast', 'book_det_breakfast'),
  ('det_receipt', 'book_det_receipt'),
  ('det_field_report', 'book_det_field_report'),
  ('det_best_dessert', 'book_det_best_dessert'),
  ('det_baker', 'book_det_baker'),
  ('host_empty_table', 'book_host_empty_table'),
  ('host_singles', 'book_host_singles'),
  ('host_picnic', 'book_host_picnic'),
  ('host_skills_share', 'book_host_skills_share'),
  ('host_problem_idea', 'book_host_problem_idea'),
  ('host_idea_market', 'book_host_idea_market'),
  ('host_babel', 'book_host_babel'),
  ('host_other_view', 'book_host_other_view'),
  ('host_one_book', 'book_host_one_book'),
  ('host_other_side', 'book_host_other_side'),
  ('host_small_change', 'book_host_small_change'),
  ('host_no_waste', 'book_host_no_waste'),
  ('host_from_scratch', 'book_host_from_scratch'),
  ('host_chess', 'book_host_chess'),
  ('host_boardgames', 'book_host_boardgames'),
  ('host_quiz', 'book_host_quiz'),
  ('host_curious', 'book_host_curious'),
  ('host_three_steps', 'book_host_three_steps'),
  ('host_elder_wolf', 'book_host_elder_wolf'),
  ('host_map_ops', 'book_host_map_ops'),
  ('host_tasting', 'book_host_tasting'),
  ('host_sugar', 'book_host_sugar')
) as map(mission_code, card_code)
join public.mission_definitions m on m.code = map.mission_code
join public.card_definitions c on c.code = map.card_code
where not exists (
  select 1 from public.card_rewards cr
  where cr.mission_id = m.id and cr.card_id = c.id
);

-- Upewnij się, że misje są aktywne
update public.mission_definitions set is_active = true
where code in (
  select unnest(array[
    'det_ghost_venue','det_unknown_cuisine','det_two_tens','det_off_radar','det_blank_spot','det_tgtg',
    'det_happy_hour','det_full_belly','det_green_trail','det_no_traps','det_after_hours','det_group_table',
    'det_breakfast','det_receipt','det_field_report','det_best_dessert','det_baker',
    'host_empty_table','host_singles','host_picnic','host_skills_share','host_problem_idea','host_idea_market',
    'host_babel','host_other_view','host_one_book','host_other_side','host_small_change','host_no_waste',
    'host_from_scratch','host_chess','host_boardgames','host_quiz','host_curious','host_three_steps',
    'host_elder_wolf','host_map_ops','host_tasting','host_sugar'
  ])
);
