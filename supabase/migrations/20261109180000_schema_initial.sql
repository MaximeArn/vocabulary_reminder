-- Schéma initial de Mnémé : réplique distante de la base locale (IndexedDB).
--
-- Principes (voir l'analyse d'architecture) :
-- - L'app reste « local-first » : cette base est une copie synchronisée, jamais un prérequis.
-- - Les horodatages sont des millisecondes epoch (bigint), identiques à ceux de l'app :
--   aucune conversion, comparaison exacte pour « la modification la plus récente gagne ».
-- - server_seq : compteur posé par le serveur à chaque écriture ; il sert de curseur
--   pour ne récupérer que ce qui a changé depuis la dernière synchronisation.
-- - Les suppressions sont « douces » (deleted_at) : elles se synchronisent comme le reste.
-- - RLS : chaque utilisateur ne voit et ne modifie que ses propres lignes.

create sequence public.sync_seq;

-- Pose server_seq à chaque insertion ou modification.
create function public.set_server_seq() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_seq := nextval('public.sync_seq');
  return new;
end;
$$;

/* ---------- Fiches (toutes catégories) ---------- */

create table public.items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 64),
  content jsonb not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_seq bigint not null default 0
);
comment on table public.items is 'Fiches de connaissances (vocabulaire, dates historiques…). Contenu validé par l''app selon la catégorie.';

create index items_user_seq on public.items (user_id, server_seq);
create trigger items_server_seq before insert or update on public.items
  for each row execute function public.set_server_seq();

/* ---------- Historique des réponses (ajout seul) ---------- */

create table public.reviews (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  answered_at bigint not null,
  study_day date not null,
  exercise text not null check (char_length(exercise) between 1 and 128),
  correct boolean not null,
  server_seq bigint not null default 0
);
comment on table public.reviews is 'Réponses données en révision. La progression de chaque fiche est recalculée par l''app en rejouant cet historique.';

create index reviews_user_seq on public.reviews (user_id, server_seq);
create index reviews_item on public.reviews (item_id);
create trigger reviews_server_seq before insert on public.reviews
  for each row execute function public.set_server_seq();

/* ---------- Réglages ---------- */

create table public.settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 128),
  value jsonb,
  updated_at bigint not null,
  server_seq bigint not null default 0,
  primary key (user_id, key)
);

create index settings_user_seq on public.settings (user_id, server_seq);
create trigger settings_server_seq before insert or update on public.settings
  for each row execute function public.set_server_seq();

/* ---------- Sécurité : RLS, aucun accès anonyme ---------- */

alter table public.items enable row level security;
alter table public.reviews enable row level security;
alter table public.settings enable row level security;

revoke all on public.items, public.reviews, public.settings from anon;
revoke all on sequence public.sync_seq from anon;

create policy "Lecture de ses fiches" on public.items for select to authenticated using (user_id = (select auth.uid()));
create policy "Ajout de ses fiches" on public.items for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Modification de ses fiches" on public.items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Lecture de ses réponses" on public.reviews for select to authenticated using (user_id = (select auth.uid()));
create policy "Ajout de ses réponses" on public.reviews for insert to authenticated with check (user_id = (select auth.uid()));
-- Pas de modification ni de suppression des réponses : l'historique est en ajout seul.

create policy "Lecture de ses réglages" on public.settings for select to authenticated using (user_id = (select auth.uid()));
create policy "Ajout de ses réglages" on public.settings for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Modification de ses réglages" on public.settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Pas de DELETE : les fiches se suppriment « en douceur » (deleted_at).

/* ---------- Envoi des modifications : la plus récente gagne ---------- */

-- Les fonctions s'exécutent avec les droits de l'appelant (security invoker) :
-- les politiques RLS ci-dessus s'appliquent.

create function public.push_items(rows jsonb) returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.items (id, kind, content, created_at, updated_at, deleted_at)
  select r.id, r.kind, r.content, r.created_at, r.updated_at, r.deleted_at
  from jsonb_to_recordset(rows) as r(id uuid, kind text, content jsonb, created_at bigint, updated_at bigint, deleted_at bigint)
  on conflict (id) do update
    set kind = excluded.kind,
        content = excluded.content,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    where public.items.updated_at < excluded.updated_at;
$$;

create function public.push_settings(rows jsonb) returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.settings (key, value, updated_at)
  select r.key, r.value, r.updated_at
  from jsonb_to_recordset(rows) as r(key text, value jsonb, updated_at bigint)
  on conflict (user_id, key) do update
    set value = excluded.value,
        updated_at = excluded.updated_at
    where public.settings.updated_at < excluded.updated_at;
$$;

revoke all on function public.push_items(jsonb), public.push_settings(jsonb) from public, anon;
grant execute on function public.push_items(jsonb), public.push_settings(jsonb) to authenticated;
