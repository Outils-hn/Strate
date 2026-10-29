-- Catalogue commun de Strate : a coller UNE FOIS dans Supabase (projet de Masse)
-- > SQL Editor > New query > Run. Relancer le script ne casse rien.
--
-- - Une table « strate_catalogue » : un produit d'isolant ou un systeme de fixation par ligne
--   (epaisseurs, m2 par colis, colis par palette, prix catalogue, articles HFT...).
-- - Lecture libre ; partage, mise a jour et retrait proteges par le PIN de Masse
--   (meme code, memes 5 essais avant blocage 5 minutes : fonction public._check_pin).
-- - Un retrait met l'element a la corbeille (deleted_at) : les postes qui l'utilisent
--   dans une commande le gardent.

create table if not exists public.strate_catalogue (
  id text primary key,
  kind text not null check (kind in ('produit', 'fixation')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.strate_catalogue enable row level security;
grant select on public.strate_catalogue to anon, authenticated;
grant all on public.strate_catalogue to service_role;
drop policy if exists "lecture catalogue strate" on public.strate_catalogue;
create policy "lecture catalogue strate" on public.strate_catalogue for select to anon, authenticated using (true);

create or replace function public.strate_save_item(p_pin text, p_kind text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text; v_id text := p->>'id';
begin
  e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  if p_kind not in ('produit', 'fixation') then return jsonb_build_object('ok', false, 'error', 'Type inconnu.'); end if;
  if coalesce(v_id, '') = '' or length(v_id) > 100 then return jsonb_build_object('ok', false, 'error', 'Élément invalide.'); end if;
  if coalesce(trim(p->>'name'), '') = '' then return jsonb_build_object('ok', false, 'error', 'Le nom est obligatoire.'); end if;
  if octet_length(p::text) > 50000 then return jsonb_build_object('ok', false, 'error', 'Élément trop volumineux.'); end if;
  insert into public.strate_catalogue (id, kind, data, updated_at, deleted_at) values (v_id, p_kind, p, now(), null)
  on conflict (id) do update set kind = excluded.kind, data = excluded.data, updated_at = now(), deleted_at = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.strate_delete_item(p_pin text, p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := public._check_pin(p_pin);
  if e is not null then return jsonb_build_object('ok', false, 'error', e); end if;
  update public.strate_catalogue set deleted_at = now(), updated_at = now() where id = p_id;
  -- Corbeille videe apres 90 jours
  delete from public.strate_catalogue where deleted_at < now() - interval '90 days';
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.strate_save_item(text, text, jsonb), public.strate_delete_item(text, text) from public;
grant execute on function public.strate_save_item(text, text, jsonb), public.strate_delete_item(text, text) to anon, authenticated;
