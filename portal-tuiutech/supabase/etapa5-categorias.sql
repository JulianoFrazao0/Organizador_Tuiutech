-- Etapa 5: categoria de verdade nos documentos (Mecânica & Design,
-- Programação & Autônomo, Gestão & Marketing, Atas de Reunião...).
-- (Rode com "Run as: postgres", igual às outras migrações.)

alter table public.documentos add column if not exists categoria text;
