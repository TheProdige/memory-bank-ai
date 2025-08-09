-- Move pgvector extension objects into the extensions schema to satisfy linter
alter extension vector set schema extensions;