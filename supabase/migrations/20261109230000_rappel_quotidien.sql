-- Rappel quotidien par notification (Web Push).
--
-- Ajout seul : aucune table existante n'est modifiée.
-- - push_subscriptions : les appareils qui reçoivent les rappels (un par navigateur installé) ;
-- - reminders : l'état utile au rappel, publié par l'app (heure, fuseau, fiches dues par jour…) ;
-- - une tâche planifiée appelle toutes les 5 minutes la fonction « daily-reminder », qui décide
--   et envoie. Son secret d'appel est rangé dans le coffre (vault), jamais dans ce fichier.

/* ---------- Appareils abonnés ---------- */

create table public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) between 1 and 1024),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 1 and 256),
  auth text not null check (char_length(auth) between 1 and 256),
  created_at timestamptz not null default now()
);

comment on table public.push_subscriptions is 'Appareils abonnés au rappel quotidien (abonnements Web Push).';

create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

create policy "Lecture de ses appareils" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Retrait de ses appareils" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Enregistrement par une fonction : un appareil repris par un autre compte (déconnexion,
-- puis connexion à un autre compte) change de propriétaire au lieu d'être refusé.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, (select auth.uid()), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth;
$$;

revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

/* ---------- État du rappel, publié par l'app ---------- */

create table public.reminders (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  time text not null default '20:00' check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone text not null default 'Europe/Paris' check (char_length(timezone) between 1 and 64),
  due_by_day jsonb not null default '{}'::jsonb
    check (jsonb_typeof(due_by_day) = 'object' and pg_column_size(due_by_day) < 65536),
  last_review_day text check (last_review_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  streak integer not null default 0 check (streak >= 0),
  -- Écrit par le serveur seulement : un rappel par jour au plus.
  last_sent_day text,
  updated_at timestamptz not null default now()
);

comment on table public.reminders is 'État du rappel quotidien, calculé et publié par l''app ; le serveur ne rejoue pas l''historique.';

alter table public.reminders enable row level security;
revoke all on public.reminders from anon, authenticated;
-- L'app écrit tout sauf last_sent_day.
grant select on public.reminders to authenticated;
grant insert (user_id, time, timezone, due_by_day, last_review_day, streak, updated_at) on public.reminders to authenticated;
grant update (time, timezone, due_by_day, last_review_day, streak, updated_at) on public.reminders to authenticated;

create policy "Lecture de son rappel" on public.reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Création de son rappel" on public.reminders for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Mise à jour de son rappel" on public.reminders for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

/* ---------- Tâche planifiée ---------- */

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Toutes les 5 minutes : la fonction ne prévient que les utilisateurs dont l'heure est venue.
-- Le secret partagé avec la fonction (« rappel_secret ») est créé à part dans le coffre.
select cron.schedule(
  'rappel-quotidien',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://nscnlrgyjodfazauymrq.supabase.co/functions/v1/daily-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'rappel_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $job$
);
