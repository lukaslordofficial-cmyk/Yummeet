-- Usuwa zaszyte pytania przy stole (ice-breakery). Gry i wyzwania zostają.
-- Nie kasuje event_attractions już przypiętych do spotkań.

delete from public.attraction_suggestions
where category = 'questions'
   or title in (
     'Ulubione danie z dzieciństwa?',
     'Gdybyś otworzył restaurację…',
     'Podróż smaków',
     'Najdziwniejsze danie'
   );
