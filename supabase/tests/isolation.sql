-- Test d'isolation entre comptes (RLS), exécuté sur la base distante dans une
-- transaction ANNULÉE à la fin : aucune donnée n'est modifiée.
--   npx supabase db query --remote -f supabase/tests/isolation.sql
-- Il endosse le rôle « authenticated » avec un jeton d'utilisateur, comme PostgREST.
begin;

create temporary table isolation_results (check_name text, passed boolean, detail text) on commit drop;
grant all on isolation_results to authenticated;

do $$
declare
  owner uuid;
  intruder uuid := gen_random_uuid();
  target uuid;
  owner_items int;
  visible int;
  changed int;
  content_before jsonb;
  content_after jsonb;
begin
  select id into owner from auth.users where email = 'test1@mneme.invalid';
  select count(*) into owner_items from public.items where user_id = owner;
  select id, content into target, content_before from public.items where user_id = owner limit 1;
  insert into isolation_results values ('le compte test1 a des données à protéger', owner_items > 0, owner_items || ' fiche(s)');

  -- 1. Contrôle : endosser test1 lui-même doit montrer ses données.
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into visible from public.items;
  insert into isolation_results values ('test1 voit ses propres fiches (l''usurpation fonctionne)', visible = owner_items, visible || ' visible(s)');
  execute 'reset role';

  -- 2. Un autre utilisateur connecté.
  perform set_config('request.jwt.claims', json_build_object('sub', intruder, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into visible from public.items;
  insert into isolation_results values ('un autre compte ne voit aucune fiche', visible = 0, visible || ' visible(s)');
  select count(*) into visible from public.reviews;
  insert into isolation_results values ('un autre compte ne voit aucune réponse', visible = 0, visible || ' visible(s)');
  select count(*) into visible from public.settings;
  insert into isolation_results values ('un autre compte ne voit aucun réglage', visible = 0, visible || ' visible(s)');

  update public.items set content = '{"piraté": true}' where user_id = owner;
  get diagnostics changed = row_count;
  insert into isolation_results values ('un autre compte ne peut pas modifier les fiches', changed = 0, changed || ' modifiée(s)');

  begin
    insert into public.items (id, user_id, kind, content, created_at, updated_at)
    values (gen_random_uuid(), owner, 'vocabulary', '{}', 1, 1);
    insert into isolation_results values ('un autre compte ne peut pas créer de fiche au nom de test1', false, 'insertion acceptée');
  exception when insufficient_privilege then
    insert into isolation_results values ('un autre compte ne peut pas créer de fiche au nom de test1', true, 'refusé par RLS');
  end;

  begin
    perform public.push_items(jsonb_build_array(jsonb_build_object(
      'id', target, 'kind', 'vocabulary', 'content', '{"piraté": true}',
      'created_at', 1, 'updated_at', 9999999999999, 'deleted_at', null)));
  exception when others then
    null; -- un refus est aussi un succès ; on vérifie le contenu ci-dessous
  end;
  execute 'reset role';

  select content into content_after from public.items where id = target;
  insert into isolation_results values ('push_items ne peut pas écraser la fiche d''un autre', content_after = content_before, 'contenu inchangé : ' || (content_after = content_before));
end $$;

select passed, check_name, detail from isolation_results;
rollback;
