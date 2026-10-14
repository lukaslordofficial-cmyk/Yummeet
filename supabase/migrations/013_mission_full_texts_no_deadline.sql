-- =====================================================================
-- 013: pełne opisy misji (jak w briefie) + brak deadlinu + bezpieczne starty
-- Uruchom po 012 i 011.
-- =====================================================================

-- Brak limitu czasu na misję: expires_at może być NULL
alter table public.user_missions alter column expires_at drop not null;

create or replace function public.mission_accept(p_mission uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); m record; v_done int; v_last timestamptz; v_id uuid;
begin
  select * into m from public.mission_definitions where id = p_mission and is_active;
  if m.id is null or not public._mission_visible(v, m.id, m.specialization_code) then raise exception 'mission_not_available'; end if;
  select count(*), max(created_at) into v_done, v_last from public.mission_completions where user_id = v and mission_id = p_mission;
  if m.repeat_limit > 0 and v_done >= m.repeat_limit then raise exception 'repeat_limit_reached'; end if;
  if v_last is not null and v_last > now() - make_interval(hours => m.cooldown_hours) then raise exception 'cooldown_active'; end if;
  if (select count(*) from public.user_missions where user_id = v and created_at > now() - interval '1 day') >= 20 then raise exception 'rate_limited'; end if;
  if exists (select 1 from public.user_missions where user_id = v and mission_id = p_mission and status in ('accepted','in_progress','pending_confirmation')) then
    raise exception 'mission_already_open';
  end if;
  insert into public.user_missions (user_id, mission_id, status, attempt_no, expires_at)
  values (v, p_mission, 'accepted', v_done + 1, null) returning id into v_id;
  insert into public.mission_participants (user_mission_id, user_id, role) values (v_id, v, 'participant');
  return v_id;
end $$;

create or replace function public.mission_start(p_um uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  update public.user_missions um set status = 'in_progress', started_at = now()
   where um.id = p_um and um.user_id = v and um.status = 'accepted'
     and (um.expires_at is null or um.expires_at > now());
  if not found then raise exception 'invalid_transition'; end if;
end $$;

create or replace function public.mission_submit(p_um uuid, p_kind text, p_content text, p_confirmer uuid default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); um record; m record; v_code text; v_lat float8; v_lng float8;
begin
  select * into um from public.user_missions where id = p_um and user_id = v for update;
  if um.id is null then raise exception 'not_found'; end if;
  if um.status = 'completed' then return jsonb_build_object('already_completed', true); end if;
  if um.status <> 'in_progress' then raise exception 'invalid_transition'; end if;
  if um.expires_at is not null and um.expires_at < now() then
    update public.user_missions set status = 'expired' where id = p_um;
    return jsonb_build_object('expired', true);
  end if;
  select * into m from public.mission_definitions where id = um.mission_id;
  if p_content is null or char_length(p_content) > 2000 then raise exception 'invalid_evidence'; end if;
  insert into public.mission_evidence (user_mission_id, user_id, kind, content) values (p_um, v, p_kind, p_content);

  if m.confirmation_method = 'self' then
    return public._complete_user_mission(p_um, null);
  elsif m.confirmation_method = 'code' then
    select confirmation_code into v_code from public.mission_secrets where mission_id = m.id;
    if v_code is null or upper(trim(p_content)) <> upper(v_code) then raise exception 'invalid_code'; end if;
    return public._complete_user_mission(p_um, null);
  elsif m.confirmation_method = 'location' then
    v_lat := split_part(p_content, ',', 1)::float8; v_lng := split_part(p_content, ',', 2)::float8;
    if m.pin_id is null or not exists (select 1 from public.pins where id = m.pin_id and st_dwithin(coords, st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography, 200)) then
      raise exception 'too_far_from_place';
    end if;
    return public._complete_user_mission(p_um, null);
  else
    if p_confirmer is null or p_confirmer = v then raise exception 'confirmer_required'; end if;
    if public.is_blocked(v, p_confirmer) then raise exception 'blocked'; end if;
    update public.user_missions set status = 'pending_confirmation', submitted_at = now(), confirmer_id = p_confirmer where id = p_um;
    insert into public.mission_participants (user_mission_id, user_id, role) values (p_um, p_confirmer, 'confirmer') on conflict do nothing;
    perform public._notify(p_confirmer, 'mission_confirm', 'Prośba o potwierdzenie misji', m.name, jsonb_build_object('user_mission_id', p_um), 'mission_confirm:' || p_um);
    return jsonb_build_object('pending_confirmation', true);
  end if;
end $$;

create or replace function public.get_mission_board()
returns table (mission_id uuid, code text, name text, description text, category text, specialization_code text, participation text,
               difficulty smallint, confirmation_method text, duration_hours int, reward_xp int, steps jsonb, safety_rules text,
               is_primary boolean, user_mission_id uuid, user_status text, expires_at timestamptz, completions int, card_reward_count int)
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_pref text; v_main text;
begin
  update public.user_missions um set status = 'expired'
   where um.user_id = v and um.status in ('accepted','in_progress')
     and um.expires_at is not null and um.expires_at < now();
  select preferred_specialization into v_pref from public.profiles where id = v;
  v_main := public.compute_main_specialization(v);
  return query
  select m.id, m.code, m.name, m.description, m.category, m.specialization_code, m.participation, m.difficulty, m.confirmation_method,
         m.duration_hours, m.reward_xp, m.steps, m.safety_rules,
         (m.specialization_code is not null and m.specialization_code = coalesce(v_pref, case when v_main = '__versatile__' then null else v_main end)),
         um.id, coalesce(um.status, 'available')::text, um.expires_at,
         (select count(*)::int from public.mission_completions c where c.user_id = v and c.mission_id = m.id),
         (select coalesce(sum(cr.count), 0)::int from public.card_rewards cr where cr.mission_id = m.id)
  from public.mission_definitions m
  left join lateral (
    select x.id, x.status, x.expires_at from public.user_missions x
    where x.user_id = v and x.mission_id = m.id order by x.created_at desc limit 1
  ) um on true
  where m.is_active
  order by (m.specialization_code = v_pref) desc nulls last, m.difficulty, m.name;
end $$;

-- Otwarte misje: wyczyść istniejącym deadliny
update public.user_missions set expires_at = null
where status in ('accepted','in_progress','pending_confirmation');

-- ---------- Pełne opisy (bez notatek w nawiasach dla agenta) ----------
update public.mission_definitions set description = 'Znajdź knajpę, której nie ma jeszcze na mapie Yummeet. Dodaj pinezkę z nazwą, lokalizacją, kategorią kuchni i podstawowymi informacjami.', name = 'Lokal Widmo', is_active = true where code = 'det_ghost_venue';
update public.mission_definitions set description = 'Znajdź lokal serwujący wskazany rodzaj kuchni, np. gruzińską, koreańską, wietnamską lub etiopską. Jeśli nie ma go na mapie, dodaj pinezkę.', name = 'Operacja: Nieznana Kuchnia', is_active = true where code = 'det_unknown_cuisine';
update public.mission_definitions set description = 'Znajdź lokal, w którym można zjeść obiad za maksymalnie 20 zł. Podaj przykładowe danie, cenę i źródło informacji. Zapisz go w kategorii Tanie.', name = 'Obiad za Dwie Dychy', is_active = true where code = 'det_two_tens';
update public.mission_definitions set description = 'Odkryj miejsce, które łatwo przeoczyć: ukryte na podwórku, w bocznej uliczce, na piętrze albo poza głównym szlakiem gastronomicznym.', name = 'Lokal Poza Radarem', is_active = true where code = 'det_off_radar';
update public.mission_definitions set description = 'Wybierz obszar mapy z małą liczbą pinezek i znajdź tam nowy lokal.', name = 'Biała Plama na Mapie', is_active = true where code = 'det_blank_spot';
update public.mission_definitions set description = 'Znajdź lokal oferujący paczki przez Too Good To Go lub podobną usługę. Dodaj pinezkę albo zapisz w pinie kategorię Paczki TGTG.', name = 'Misja: Ocalony Posiłek', is_active = true where code = 'det_tgtg';
update public.mission_definitions set description = 'Znajdź knajpę, w której o określonej porze można zjeść taniej, np. podczas happy hours, lunchu dnia lub wieczornej wyprzedaży. Zapisz w tej restauracji kategorię Happy-Hour.', name = 'Godzina Słabości Cenowej', is_active = true where code = 'det_happy_hour';
update public.mission_definitions set description = 'Znajdź miejsce, w którym można dostać sycący posiłek w ustalonym budżecie, np. do 25 lub 30 zł. Podaj konkretną propozycję z menu. Zapisz pin z kategorią Duże porcje.', name = 'Król Pełnego Brzucha', is_active = true where code = 'det_full_belly';
update public.mission_definitions set description = 'Znajdź lokal z ciekawą ofertą wegetariańską lub wegańską. Nie wystarczy, że w menu jest jedna sałatka — celem jest znalezienie miejsca z sensownym wyborem dań. Zapisz pina z kategorią wegetariańskie lub wegańskie.', name = 'Zielony Trop', is_active = true where code = 'det_green_trail';
update public.mission_definitions set description = 'Znajdź lokal z oznaczonymi opcjami bezglutenowymi lub inną wskazaną kategorią żywieniową. Zapisz wyłącznie to, co potwierdza menu lub obsługa. Zapisz pin z kategorią np. bezglutenowe.', name = 'Menu Bez Pułapek', is_active = true where code = 'det_no_traps';
update public.mission_definitions set description = 'Znajdź lokal, w którym można zjeść po 22:00. Zweryfikuj godziny otwarcia i rodzaj dostępnego jedzenia. Zapisz pin z kategorią nocne.', name = 'Głód po Godzinach', is_active = true where code = 'det_after_hours';
update public.mission_definitions set description = 'Znajdź miejsce odpowiednie dla grupy, np. z dużymi stolikami, daniami do dzielenia się lub rozsądnymi cenami przy większym zamówieniu. Zapisz pin z kategorią grupowe.', name = 'Stół dla Ekipy', is_active = true where code = 'det_group_table';
update public.mission_definitions set description = 'Znajdź lokal, w którym można zjeść śniadanie przed określoną godziną, najlepiej w cenie mieszczącej się w wyznaczonym budżecie. Zapisz pin z kategorią śniadania.', name = 'Śniadaniowy Alarm', is_active = true where code = 'det_breakfast';
update public.mission_definitions set description = 'Uzupełnij brakujące ceny, kategorie albo opis menu w pinie, w którym nie ma tych opisów, albo są niewystarczające.', name = 'Operacja: Aktualny Paragon', is_active = true where code = 'det_receipt';
update public.mission_definitions set description = 'Odwiedź lokal zapisany na mapie i oceń go według kwestionariusza Yummeet. Dodaj krótką opinię o jedzeniu i wskaż, komu polecasz to miejsce.', name = 'Raport z Miejsca Zdarzenia', is_active = true where code = 'det_field_report';
update public.mission_definitions set description = 'Dodaj pin lokalu, w którym można zjeść twoim zdaniem najlepszy deser lub słodycze. Opisz nazwę i cenę deseru, który polecasz.', name = 'Najlepszy deser', is_active = true where code = 'det_best_dessert';
update public.mission_definitions set description = 'Dodaj pin z kategorią Piekarnia.', name = 'Pan Piekarz', is_active = true where code = 'det_baker';

update public.mission_definitions set description = 'Zorganizuj swoje pierwsze otwarte spotkanie. Wybierz miejsce, termin i temat, który może zachęcić innych do przyjścia. Nie musi być wyszukany — ważne, żeby powstała realna okazja do poznania ludzi.', name = 'Pusty Stół Czeka', is_active = true, safety_rules = 'Zadbaj o bezpieczeństwo. Użytkownicy powinni móc zgłaszać niewłaściwe zachowania podczas spotkań, a organizator powinien jasno określać miejsce i warunki spotkania. Nie należy publikować prywatnych danych uczestników bez ich zgody.' where code = 'host_empty_table';
update public.mission_definitions set description = 'Zorganizuj kameralne spotkanie dla osób, które są singlami i chciałyby się lepiej poznać.', name = 'Dla singli', is_active = true where code = 'host_singles';
update public.mission_definitions set description = 'Zorganizuj plenerowe spotkanie, na które każdy może przynieść własny prowiant. Ustal dostępne miejsce, godzinę i plan na wypadek złej pogody.', name = 'Piknik Bez Biletu Wstępu', is_active = true where code = 'host_picnic';
update public.mission_definitions set description = 'Zorganizuj spotkanie, na którym każdy uczestnik dzieli się jedną umiejętnością, przydatną wskazówką albo doświadczeniem. Mogą to być języki, praca, podróże, majsterkowanie, gotowanie czy obsługa przydatnych narzędzi.', name = 'Każdy Umie Coś, Czego Ty Nie Umiesz', is_active = true where code = 'host_skills_share';
update public.mission_definitions set description = 'Zorganizuj spotkanie, podczas którego uczestnicy przedstawiają niewielki problem, z którym się mierzą, a pozostali wspólnie szukają rozwiązań. Mogą to być kwestie organizacji czasu, nauki, szukania pracy czy rozwijania projektu.', name = 'Mam Problem, Mam Pomysł', is_active = true where code = 'host_problem_idea';
update public.mission_definitions set description = 'Wybierz jeden temat — np. pomysły na dodatkowy zarobek, lokalną inicjatywę, mały biznes lub ciekawy projekt — i zbierz osoby, które chcą wymienić się pomysłami. Każdy powinien wyjść przynajmniej z jedną inspiracją do dalszego sprawdzenia.', name = 'Giełda Pomysłów', is_active = true where code = 'host_idea_market';
update public.mission_definitions set description = 'Zorganizuj spotkanie dla osób, które chcą ćwiczyć języki obce. Uczestnicy mogą rozmawiać w parach, zmieniać partnerów i pomagać sobie w nauce.', name = 'Wieża Babel', is_active = true where code = 'host_babel';
update public.mission_definitions set description = 'Wybierz temat, na który ludzie mogą mieć odmienne zdania, i zaproś uczestników do spokojnej dyskusji. Celem nie jest wygranie sporu, lecz zrozumienie, dlaczego inni myślą inaczej.', name = 'Świat Widziany Inaczej', is_active = true where code = 'host_other_view';
update public.mission_definitions set description = 'Zorganizuj spotkanie wokół książki, filmu, podcastu lub artykułu. Każdy może opowiedzieć, co go zaciekawiło, z czym się nie zgadzał albo co zmieniło jego spojrzenie na temat.', name = 'Jedna Książka, Wiele Światów', is_active = true where code = 'host_one_book';
update public.mission_definitions set description = 'Zaproś osoby z różnych branż do rozmowy o tym, jak naprawdę wygląda ich praca, czego się nauczyły i co zaskoczyło je w ich zawodzie. Nie chodzi o rekrutację ani sprzedaż usług.', name = 'Po Drugiej Stronie Zawodu', is_active = true where code = 'host_other_side';
update public.mission_definitions set description = 'Zorganizuj spotkanie osób, które chcą zrobić coś pożytecznego w swojej okolicy. Wybierzcie realny cel, np. pomoc lokalnej inicjatywie, zbiórkę potrzebnych rzeczy albo uporządkowanie wspólnej przestrzeni, i ustalcie pierwszy krok.', name = 'Mała Zmiana, Wielka Sprawa', is_active = true where code = 'host_small_change';
update public.mission_definitions set description = 'Zorganizuj spotkanie wymiany książek, roślin, gier, sprawnych przedmiotów lub innych rzeczy, które mogą przydać się komuś innemu.', name = 'Nic Się Nie Marnuje', is_active = true where code = 'host_no_waste';
update public.mission_definitions set description = 'Zbierz grupę, która w trakcie jednego spotkania wymyśli i zaplanuje mały wspólny projekt — np. klub wymiany umiejętności, lokalną mapę ciekawych miejsc albo cykl spotkań tematycznych.', name = 'Projekt z Niczego', is_active = true where code = 'host_from_scratch';
update public.mission_definitions set description = 'Zorganizuj otwarte spotkanie szachowe. Zaproś zarówno początkujących, jak i zaawansowanych graczy; można rozegrać szybkie partie, nauczyć się podstaw albo po prostu poćwiczyć.', name = 'Gambit Towarzyski', is_active = true where code = 'host_chess';
update public.mission_definitions set description = 'Zorganizuj wieczór gier planszowych lub karcianych. Wybierz gry, do których łatwo dołączyć, nawet jeśli uczestnicy nie znają się wcześniej.', name = 'Plansza Łączy Ludzi', is_active = true where code = 'host_boardgames';
update public.mission_definitions set description = 'Zorganizuj quiz z nietypowych ciekawostek, popkultury, geografii, historii itp. Temat dowolny.', name = 'Turniej Wiedzy Bezużytecznej', is_active = true where code = 'host_quiz';
update public.mission_definitions set description = 'Zorganizuj spotkanie, podczas którego uczestnicy pokażą innym swoje hobby: fotografię, rysowanie, origami, pisanie, modelarstwo lub coś zupełnie nieoczywistego.', name = 'Klub Ludzi Ciekawych', is_active = true where code = 'host_curious';
update public.mission_definitions set description = 'Zorganizuj spotkanie, podczas którego każdy chętny przedstawia jeden cel, nad którym pracuje, oraz najbliższy mały krok. Pozostali mogą zaproponować pomysł, kontakt lub pomoc — bez oceniania i nieproszonych wykładów.', name = 'Trzy Kroki Naprzód', is_active = true where code = 'host_three_steps';
update public.mission_definitions set description = 'Zorganizuj spotkanie, na którym osoby z większym doświadczeniem w wybranej dziedzinie dzielą się nim z początkującymi. Tematem może być nauka, praca, podróże, hobby albo rozwijanie własnego projektu.', name = 'Wiedza Starszego Wilka', is_active = true where code = 'host_elder_wolf';
update public.mission_definitions set description = 'Zorganizuj spotkanie poświęcone odkrywaniu możliwości, o których uczestnicy mogli wcześniej nie wiedzieć: ciekawych wydarzeń, bezpłatnych kursów, lokalnych inicjatyw, klubów zainteresowań czy sposobów rozwijania umiejętności.', name = 'Mapa Możliwości', is_active = true where code = 'host_map_ops';
update public.mission_definitions set description = 'Zorganizuj spotkanie, podczas którego uczestnicy spróbują różnych pizz lub innych dań do dzielenia się. Każdy sam decyduje, co zamawia i ile wydaje. Korzyść: pretekst do rozmowy i poznawania nowych smaków.', name = 'Wielka Degustacja', is_active = true where code = 'host_tasting';
update public.mission_definitions set description = 'Zorganizuj spotkanie poświęcone deserom, ciastom, lodom lub innym słodkościom. Możecie odwiedzić cukiernię albo urządzić własną degustację.', name = 'Rada Miłośników Cukru', is_active = true where code = 'host_sugar';

update public.mission_definitions set description = 'Wybierz dwie różne potrawy i zrób z nich fuzję. Wykorzystaj elementy jednego dania w drugim, albo połącz je tak by stworzyć coś nowego. Podziel się zdjęciem, przepisem i krótkim opisem wykonania.', name = 'Cztery Składniki, Zero Wymówek', is_active = true where code = 'alc_four_ingredients';
update public.mission_definitions set description = 'Przygotuj pełnowartościowy posiłek tak by koszt produkcji był jak najtańszy, a ugotowana potrawa była smacznym i pełnowartościowym posiłkiem. Podaj koszt składników i liczbę uzyskanych porcji.', name = 'Bitwa o Ostatnią Złotówkę', is_active = true where code = 'alc_last_zloty';
update public.mission_definitions set description = 'Wybierz danie znane z dobrej restauracji i przygotuj własną wersję w domu. Pokaż rezultat, koszt porcji i opisz, co udało się odtworzyć, a co zrobiłbyś inaczej następnym razem.', name = 'Restauracja kontra Twoja Kuchnia', is_active = true where code = 'alc_vs_restaurant';
update public.mission_definitions set description = 'Wylosuj kuchnię kraju, którego rzadko używasz w swojej kuchni. Przygotuj charakterystyczne danie i opublikuj przepis wraz z informacją, skąd pochodzi inspiracja. Korzyść: odkrywanie nowych smaków i kultur.', name = 'Podróż Bez Paszportu', is_active = true where code = 'alc_no_passport';
update public.mission_definitions set description = 'Wybierz jedną technikę, której jeszcze dobrze nie opanowałeś — np. przygotowanie sosu, wyrabianie ciasta, karmelizację cebuli lub flambirowanie. Przećwicz ją i opublikuj rezultat wraz z wnioskami.', name = 'Awans Alchemika', is_active = true where code = 'alc_level_up';
update public.mission_definitions set description = 'Jeśli ugotowałeś czegoś wystarczająco dużo, zaproponuj wymianę z innym Yummiterem. Ustalcie wcześniej rodzaj posiłków, liczbę porcji, miejsce i termin przekazania.', name = 'Pierwsza Zamiana Obiadów', is_active = true where code = 'alc_first_swap';
update public.mission_definitions set description = 'Umów się z drugim Yummiterem na gotowanie na żądanie. Ty przygotowujesz danie dla niego, a on przygotowuje coś dla Ciebie. Określcie wcześniej budżet, temat kulinarny i danie które ugotujecie dla siebie na wymianę.', name = 'Obiad za Obiad', is_active = true where code = 'alc_lunch_for_lunch';
update public.mission_definitions set description = 'Znajdź osobę, która specjalizuje się w czymś innym niż Ty. Wymieńcie się swoimi popisowymi potrawami — np. pierogami za chleb na zakwasie albo curry za domowe wypieki.', name = 'Specjalność za Specjalność', is_active = true where code = 'alc_specialty_swap';
update public.mission_definitions set description = 'Opublikuj własny sprawdzony trik, który rzeczywiście poprawia efekt gotowania — np. sposób uzyskania chrupiących ziemniaków, lepszego sosu lub bardziej puszystego omletu. Pokaż rezultat i wyjaśnij, dlaczego metoda działa.', name = 'Sekret Mistrza Patelni', is_active = true where code = 'alc_pan_secret';
update public.mission_definitions set description = 'Zorganizuj krótkie spotkanie lub wspólne gotowanie, podczas którego nauczysz drugiego Yummitera jednej konkretnej umiejętności kulinarnej. Nie musi to być skomplikowana rzecz — ważne, żeby druga osoba mogła samodzielnie powtórzyć technikę.', name = 'Ucznia Przyjmę', is_active = true where code = 'alc_apprentice';
update public.mission_definitions set description = 'Opublikuj swój sprawdzony przepis z proporcjami, czasem przygotowania, kosztem i jedną wskazówką, której nie ma w typowym przepisie. Może to być rodzinne danie albo własna modyfikacja.', name = 'Przepis z Historią', is_active = true where code = 'alc_recipe_story';
update public.mission_definitions set description = 'Wybierz potrawę, w której czujesz się najlepiej. Przygotuj jej opis, zdjęcie, orientacyjny koszt składników i liczbę porcji. Dodaj ją do swojego profilu jako specjalność i wystaw na zamianę obiadów jeśli twój poziom umiejętności kulinarnych jest na co najmniej 3 poziomie.', name = 'Mój Kulinarny Znak Firmowy', is_active = true where code = 'alc_signature';
update public.mission_definitions set description = 'Udostępnij ofertę przygotowania jednej konkretnej potrawy na zamówienie. Określ liczbę porcji, termin, cenę lub zasady pokrycia kosztów i sposób odbioru. Przyjmij pierwsze zlecenie, jeśli możesz je bezpiecznie zrealizować.', name = 'Pierwsze Zamówienie', is_active = true where code = 'alc_first_order';
update public.mission_definitions set description = 'Udostępnij ofertę przygotowania jednej konkretnej potrawy w zamian za opłacenie składników. Odbiorca pokrywa uzgodniony koszt produktów, a gotowa potrawa jest dzielona po równo. Przed rozpoczęciem ustalcie budżet, liczbę porcji i sposób rozliczenia.', name = 'Gotuję, Ty Pokrywasz Składniki', is_active = true where code = 'alc_cover_ingredients';
update public.mission_definitions set description = 'Dodaj do swojego profilu opis trzech potraw, które możesz wykonać na zamówienie. Przy każdej podaj cenę, wielkość porcji, możliwe modyfikacje i czas potrzebny na przygotowanie.', name = 'Menu na Życzenie', is_active = true where code = 'alc_menu_wish';
update public.mission_definitions set description = 'Znajdź drugiego Yummitera i przygotujcie wspólnie danie wymagające podziału pracy. Możecie wybrać kuchnię, której żadne z was nie zna dobrze, i wspólnie opracować przepis.', name = 'Duet przy Desce', is_active = true where code = 'alc_duet';
update public.mission_definitions set description = 'Zorganizuj niewielkie spotkanie, na którym kilka osób przynosi własne potrawy do spróbowania. Uczestnicy dzielą się konstruktywną opinią i mogą wymienić się przepisami.', name = 'Stół Degustatorów', is_active = true where code = 'alc_tasters_table';
update public.mission_definitions set description = 'Rzuć wyzwanie dwóm innym Yummiterom: przygotujcie własne wersje tej samej potrawy. Porównajcie składniki, techniki i rezultaty, podzielcie się tipami na jak najlepsze jej wykonanie.', name = 'Jedno Danie, Trzy Wersje', is_active = true where code = 'alc_three_versions';
update public.mission_definitions set description = 'Zorganizuj gotowanie na potrzeby uzgodnionej inicjatywy społecznej, np. wydarzenia sąsiedzkiego lub zbiórki. Wcześniej ustal odbiorców, finansowanie składników i sposób bezpiecznego przekazania jedzenia. Korzyść: wykorzystanie umiejętności kulinarnych w działaniu na rzecz innych.', name = 'Garnek Dla Większej Sprawy', is_active = true where code = 'alc_bigger_cause';

update public.mission_definitions set description = 'Znajdź piekarnię, która pod koniec dnia przecenia lub przekazuje niesprzedane pieczywo. Dodaj lokal do mapy z kategoriami Piekarnia i Przeceny, albo zaktualizuj jego ofertę, podając godzinę odbioru i zasady rezerwacji.', name = 'Ostatni Dzwonek Piekarni', is_active = true where code = 'gua_bakery_bell';
update public.mission_definitions set description = 'Znajdź aktualną ofertę nadwyżek z cukierni lub kawiarni. Dodaj ją na mapę z pinem Cukiernia, Przeceny, jeśli jeszcze jej nie ma, albo zaktualizuj jej ofertę, podając godzinę odbioru i zasady rezerwacji, jeśli już jest.', name = 'Misja: Ocalony Wypiek', is_active = true where code = 'gua_saved_pastry';
update public.mission_definitions set description = 'Odbierz paczkę z Too Good To Go lub podobnej usługi. Zapisz jej rodzaj, orientacyjną zawartość, koszt i sposób wykorzystania produktów. Dodaj pina z informacją o lokalu jeśli go nie ma, lub aktualizuj jego pin o kategorię przeceny.', name = 'Paczka Ostatniej Szansy', is_active = true where code = 'gua_last_chance';
update public.mission_definitions set description = 'Znajdź lokal, który przekazuje niesprzedane, bezpieczne posiłki. Ustal z personelem zasady odbioru, sposób pakowania i czas, w którym jedzenie można odebrać i opisz je w pinie. Dodaj lub aktualizuj pin tego lokalu na mapie z kategorią Jadłodzielnia.', name = 'Ostatnia Porcja Przed Zamknięciem', is_active = true where code = 'gua_last_portion';
update public.mission_definitions set description = 'Opublikuj jedzenie, którego już nie wykorzystasz, ale które nadal nadaje się do bezpiecznego przekazania. Podaj ilość, skład, alergeny, czas odbioru i warunki przechowywania.', name = 'Spiżarnia Otwartych Drzwi', is_active = true, safety_rules = 'Nie publikuj żywności niepewnej lub po terminie „należy spożyć do”.' where code = 'gua_open_pantry';
update public.mission_definitions set description = 'Odbierz zgłoszone jedzenie od jednego Yummitera i przekaż je do jadłodzielni.', name = 'Kurier Dobrego Smaku', is_active = true where code = 'gua_good_taste_courier';
update public.mission_definitions set description = 'Znajdź jadłodzielnię, sprawdź jej lokalizację, godziny dostępności i zasady przyjmowania produktów. Dodaj jej pin do mapy.', name = 'Mapa Drugiego Życia', is_active = true where code = 'gua_second_life_map';
update public.mission_definitions set description = 'Przetransportuj produkty spożywcze do jadłodzielni. Udokumentuj przekazanie bez fotografowania przypadkowych osób ani ujawniania danych odbiorców.', name = 'Kurs na Jadłodzielnię', is_active = true where code = 'gua_course_fridge';
update public.mission_definitions set description = 'Zweryfikuj, jakie produkty są obecnie w jadłodzielni, i aktualizuj pin z jej dzisiejszym stanem. Opisz co jest dostępne, do kiedy (jeśli to możliwe) i wrzuć zdjęcie. Jeśli w lodówce nie ma nic, to nie publikuj aktualizacji.', name = 'Punkt, Który Nadal Żyje', is_active = true where code = 'gua_still_alive';
update public.mission_definitions set description = 'Znajdź sklep, który przecenia produkty z krótkim terminem przydatności. Dodaj informację o rodzaju przecen i typowych porach przecen. Pokaż właścicielowi aplikację, zachęć do jej pobrania i aktualizowania informacji o pojawiających się przecenach.', name = 'Czerwone Etykiety', is_active = true where code = 'gua_red_labels';
update public.mission_definitions set description = 'Odkryj warzywniak, który oferuje tańsze produkty do szybkiego wykorzystania. Opisz, co można tam znaleźć i w jakich godzinach mogą pojawić się przeceny. Pokaż właścicielowi aplikację, zachęć do jej pobrania i aktualizowania informacji o pojawiających się przecenach.', name = 'Sekret Warzywniaka', is_active = true where code = 'gua_greengrocer';
update public.mission_definitions set description = 'Nawiąż kontakt z lokalem gastronomicznym, który chce ograniczyć marnowanie. Pokaż mu aplikację, zachęć do jej pobrania i aktualizowania informacji o pojawiających się daniach do odebrania za darmo lub na sporej przecenie.', name = 'Sojusz z restauracją', is_active = true where code = 'gua_restaurant_ally';
