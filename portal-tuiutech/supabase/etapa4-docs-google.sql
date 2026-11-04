-- Etapa 4: os documentos passam a ser Documentos do Google de verdade.
-- O texto do documento fica no Google Docs; aqui a gente só guarda o
-- título, o autor e o link/ID do Documento no Drive.
-- (Rode com "Run as: postgres", igual às outras migrações.)

alter table public.documentos add column if not exists doc_url text;
alter table public.documentos add column if not exists doc_id text;
