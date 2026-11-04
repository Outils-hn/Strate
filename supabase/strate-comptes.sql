-- Strate 15.7 : comptes Index a la place du PIN, et PRIX reserves aux comptes valides.
-- A coller dans Supabase (projet Index) > SQL Editor > Run. Colle le CONTENU du fichier, pas son nom.
-- Relancer ne casse rien.
--
-- - Modification du catalogue : compte connecte et valide (fonctions sans PIN).
-- - Lecture : la table n'est plus lisible par le public ; la fonction strate_lire() renvoie le catalogue
--   SANS les prix (prix des epaisseurs et prix des articles de fixation) tant qu'on n'a pas un compte valide.
-- - Les anciennes fonctions a PIN restent le temps de la transition.

create or replace function public._check_acces() returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'Connectez-vous avec votre compte Index pour modifier.'; end if;
  if not public.is_approved() then return 'Votre compte Index n''est pas encore valide : un administrateur doit l''approuver.'; end if;
  return null;
end $$;
revoke all on function public._check_acces() from public, anon, authenticated;

-- Lecture reservee aux comptes valides ; le public passe par strate_lire() (sans prix)
revoke select on public.strate_catalogue from anon;
drop policy if exists "lecture catalogue strate" on public.strate_catalogue;
create policy "lecture catalogue strate" on public.strate_catalogue for select to authenticated using (public.is_approved());

create or replace function public._strate_sans_prix(k text, d jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select case
    when k = 'produit' and jsonb_typeof(d->'thicknesses') = 'array'
      then jsonb_set(d, '{thicknesses}', (select coalesce(jsonb_agg(t - 'price'), '[]'::jsonb) from jsonb_array_elements(d->'thicknesses') t))
    when k = 'fixation' and jsonb_typeof(d->'articles') = 'array'
      then jsonb_set(d, '{articles}', (select coalesce(jsonb_agg(a - 'price100'), '[]'::jsonb) from jsonb_array_elements(d->'articles') a))
    else d end
$$;
revoke all on function public._strate_sans_prix(text, jsonb) from public, anon, authenticated;

create or replace function public.strate_lire() returns table (id text, kind text, data jsonb, updated_at timestamptz, deleted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.kind,
         case when public.is_approved() then c.data else public._strate_sans_prix(c.kind, c.data) end,
         c.updated_at, c.deleted_at
  from public.strate_catalogue c
$$;
revoke all on function public.strate_lire() from public;
grant execute on function public.strate_lire() to anon, authenticated;

create or replace function public.strate_save_item(p_kind text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id text := p->>'id';
begin
  e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if p_kind not in ('produit', 'fixation') then return jsonb_build_object('ok', false, 'error', 'Type inconnu.'); end if;
  if coalesce(v_id, '') = '' or length(v_id) > 100 then return jsonb_build_object('ok', false, 'error', 'Élément invalide.'); end if;
  if coalesce(trim(p->>'name'), '') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if octet_length(p::text) > 50000 then return jsonb_build_object('ok', false, 'error', 'Élément trop volumineux.'); end if;
  insert into public.strate_catalogue (id, kind, data, updated_at, deleted_at) values (v_id, p_kind, p, now(), null)
  on conflict (id) do update set kind = excluded.kind, data = excluded.data, updated_at = now(), deleted_at = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.strate_delete_item(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := public._check_acces();
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  update public.strate_catalogue set deleted_at = now(), updated_at = now() where id = p_id;
  -- Corbeille videe apres 90 jours
  delete from public.strate_catalogue where deleted_at < now() - interval '90 days';
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.strate_save_item(text, jsonb), public.strate_delete_item(text) to authenticated;
