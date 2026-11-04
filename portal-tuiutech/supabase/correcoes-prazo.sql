-- Rode SÓ SE você já executou o supabase/etapa2.sql antes desta atualização.
-- Se ainda não rodou etapa2.sql, ignore este arquivo: basta rodar o etapa2.sql
-- atualizado, que já inclui o campo de prazo.
-- Supabase > SQL Editor > New query > (confira "Run as: postgres") > cole > Run

alter table public.tarefas add column if not exists prazo date;
