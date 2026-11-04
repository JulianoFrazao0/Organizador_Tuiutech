-- Libera para qualquer pessoa da equipe excluir um quadro (a conferência da senha
-- "1234" já acontece no site). Sem rodar isto, o banco de dados ainda bloqueia
-- quem não é administrador, mesmo digitando a senha certa.
-- Supabase > SQL Editor > New query > confira "Run as: postgres" > cole > Run

drop policy if exists "admin apaga quadros" on public.quadros;

create policy "equipe apaga quadros" on public.quadros
  for delete to authenticated using (true);
