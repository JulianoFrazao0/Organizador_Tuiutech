-- Etapa 2: Documentos e Kanban compartilhados pela equipe.
-- Rode este arquivo uma vez em: Supabase > SQL Editor > New query > Run
-- IMPORTANTE: antes de rodar, confira se "Run as" está em "postgres" (mesmo aviso do setup.sql).

-- ===================== DOCUMENTOS =====================
create table public.documentos (
  id bigint generated always as identity primary key,
  titulo text not null,
  conteudo text not null default '',
  autor text not null default '??',
  autor_user_id uuid references auth.users(id) on delete set null,
  anexo_url text,
  anexo_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.documentos enable row level security;
grant select, insert, update, delete on public.documentos to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "equipe le documentos" on public.documentos
  for select to authenticated using (true);
create policy "equipe cria documentos" on public.documentos
  for insert to authenticated with check (true);
create policy "equipe edita documentos" on public.documentos
  for update to authenticated using (true) with check (true);
create policy "equipe apaga documentos" on public.documentos
  for delete to authenticated using (true);

-- ===================== KANBAN (QUADROS E TAREFAS) =====================
create table public.quadros (
  id bigint generated always as identity primary key,
  nome text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

create table public.tarefas (
  id bigint generated always as identity primary key,
  quadro_id bigint not null references public.quadros(id) on delete cascade,
  coluna text not null default 'A Fazer' check (coluna in ('A Fazer', 'Fazendo', 'Concluído')),
  titulo text not null,
  responsavel text,
  prazo date,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

alter table public.quadros enable row level security;
alter table public.tarefas enable row level security;
grant select, insert, update, delete on public.quadros to authenticated;
grant select, insert, update, delete on public.tarefas to authenticated;

create policy "equipe le quadros" on public.quadros
  for select to authenticated using (true);
create policy "equipe cria quadros" on public.quadros
  for insert to authenticated with check (true);
-- Só o administrador apaga um quadro inteiro (evita perder o trabalho da equipe sem querer)
create policy "admin apaga quadros" on public.quadros
  for delete to authenticated using (public.eh_admin());

create policy "equipe le tarefas" on public.tarefas
  for select to authenticated using (true);
create policy "equipe cria tarefas" on public.tarefas
  for insert to authenticated with check (true);
create policy "equipe edita tarefas" on public.tarefas
  for update to authenticated using (true) with check (true);
create policy "equipe apaga tarefas" on public.tarefas
  for delete to authenticated using (true);

-- Quadro de exemplo, igual ao que já existia no site (só é criado se ainda não houver nenhum quadro)
insert into public.quadros (nome, ordem)
select 'Quadro de Engenharia - Temporada 2026', 0
where not exists (select 1 from public.quadros);

insert into public.tarefas (quadro_id, coluna, titulo, responsavel, ordem)
select q.id, t.coluna, t.titulo, t.responsavel, t.ordem
from public.quadros q,
     (values
        ('A Fazer', 'Cortar perfis de alumínio', null, 0),
        ('A Fazer', 'Configurar controle do Xbox', null, 1),
        ('Fazendo', 'Montar caixa de redução', 'JF', 0)
     ) as t(coluna, titulo, responsavel, ordem)
where q.nome = 'Quadro de Engenharia - Temporada 2026'
  and not exists (select 1 from public.tarefas);
