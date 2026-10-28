-- Migración: tabla de respuestas para el buzón (conversación admin ↔ operador)
-- Ejecutar en Supabase → SQL Editor

create table if not exists public.buzon_respuestas (
  id         bigint generated always as identity primary key,
  creado_en  timestamptz not null default now(),
  buzon_id   bigint not null references public.buzon(id) on delete cascade,
  autor      text not null,
  es_admin   boolean not null default false,
  texto      text not null check (char_length(texto) between 1 and 200)
);

create index if not exists buzon_respuestas_buzon_idx on public.buzon_respuestas (buzon_id, creado_en);

alter table public.buzon_respuestas enable row level security;
