create table if not exists public.planillas (
  nombre text primary key,
  matriz jsonb not null default '[]'::jsonb
);

create table if not exists public.ultimas_cargas (
  clave text primary key,
  fecha text not null
);
