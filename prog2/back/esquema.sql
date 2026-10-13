create table if not exists public.planillas (
  nombre text primary key,
  matriz jsonb not null default '[]'::jsonb
);

create table if not exists public.ultimas_cargas (
  clave text primary key,
  fecha text not null
);

create table if not exists public.bitacora_folios (
  folio bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  eliminado_en timestamptz
);

alter table public.bitacora_folios add column if not exists eliminado_en timestamptz;

create table if not exists public.bitacora_filas (
  folio bigint not null references public.bitacora_folios(folio) on delete cascade,
  n_fila integer not null check (n_fila > 0),
  fecha text not null default '',
  chofer text not null default '',
  rut text not null default '',
  patente text not null default '',
  ruta text not null default '',
  h_salida text not null default '',
  h_llegada text not null default '',
  km_ini text not null default '',
  km_term text not null default '',
  km_reco text not null default '',
  observacion text not null default '',
  firma text not null default '',
  firma_hash text not null default '',
  firma_datos text not null default '',
  firma_en timestamptz,
  primary key (folio, n_fila)
);

alter table public.bitacora_filas add column if not exists firma_hash text not null default '';
alter table public.bitacora_filas add column if not exists firma_datos text not null default '';
alter table public.bitacora_filas add column if not exists firma_en timestamptz;

create table if not exists public.bitacora_firmas_historial (
  id bigint generated always as identity primary key,
  folio bigint not null,
  n_fila integer not null check (n_fila > 0),
  firma text not null default '',
  firma_hash text not null default '',
  firma_en timestamptz,
  quitada_en timestamptz not null default now(),
  motivo text not null default ''
);
