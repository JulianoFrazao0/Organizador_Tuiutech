-- Rode este arquivo uma vez em: Supabase > SQL Editor > New query > Run

-- 1. Tabela de perfis: liga o ID da equipe (ex.: 011) ao nome e ao papel
create table public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  codigo text unique not null,
  nome text not null,
  papel text not null default 'membro' check (papel in ('admin', 'membro')),
  criado_em timestamptz not null default now()
);

alter table public.perfis enable row level security;

-- Permissões de acesso à tabela (projetos novos do Supabase exigem isto de forma explícita)
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.perfis to authenticated;
grant all on public.perfis to service_role;

create function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where user_id = auth.uid() and papel = 'admin');
$$;

-- Quem está logado pode ver a lista da equipe; só o admin altera.
create policy "equipe le perfis" on public.perfis
  for select to authenticated using (true);

create policy "admin gerencia perfis" on public.perfis
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- 2. Seu acesso de administrador
-- Antes: Authentication > Users > Add user > Create new user
--   e-mail: SEUID@tuiutech.app (o ID em minúsculas), escolha sua senha e marque "Auto Confirm User".
-- Depois troque os três valores abaixo e rode:
insert into public.perfis (user_id, codigo, nome, papel)
select id, 'SEUID', 'Seu Nome Completo', 'admin'
from auth.users where email = 'seuid@tuiutech.app';
