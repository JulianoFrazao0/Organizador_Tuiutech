-- Etapa 3: Chamada com código do dia.
-- Rode este arquivo uma vez em: Supabase > SQL Editor > New query > Run
-- IMPORTANTE: confira se "Run as" está em "postgres" antes de rodar.

-- Um único código por dia. Só o administrador consegue LER esta tabela:
-- é isso que garante que ninguém descubra o código sozinho, só quem o admin avisar.
create table public.chamadas (
  id bigint generated always as identity primary key,
  data date not null unique,
  codigo text not null,
  criado_em timestamptz not null default now()
);

alter table public.chamadas enable row level security;
grant select, insert, update on public.chamadas to authenticated;
grant all on public.chamadas to service_role;

create policy "admin le chamadas" on public.chamadas
  for select to authenticated using (public.eh_admin());
create policy "admin cria chamadas" on public.chamadas
  for insert to authenticated with check (public.eh_admin());

-- Quem confirmou presença em qual dia. Cada pessoa só vê a própria confirmação;
-- o administrador vê todo mundo. Só a função do servidor pode CRIAR uma confirmação
-- (o site nunca insere aqui diretamente, para ninguém "confirmar" sem saber o código certo).
create table public.presencas (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.perfis(user_id) on delete cascade,
  data date not null,
  confirmado_em timestamptz not null default now(),
  unique (user_id, data)
);

alter table public.presencas enable row level security;
grant select on public.presencas to authenticated;
grant all on public.presencas to service_role;

create policy "ve a propria presenca ou admin ve todas" on public.presencas
  for select to authenticated using (user_id = auth.uid() or public.eh_admin());
