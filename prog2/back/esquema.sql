create table if not exists public.planillas (
  nombre text primary key,
  matriz jsonb not null default '[]'::jsonb
);

create table if not exists public.usuarios (
  usuario text primary key,
  clave_hash text not null,
  creado_en timestamptz not null default now()
);

alter table public.usuarios add column if not exists rol text not null default 'operador';
alter table public.usuarios drop constraint if exists usuarios_rol_check;
alter table public.usuarios add constraint usuarios_rol_check check (rol in ('admin', 'operador', 'desactivado'));

alter table public.usuarios enable row level security;

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

create table if not exists public.bitacora_log (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  usuario text not null default '',
  accion text not null,
  folio bigint,
  n_fila integer,
  campo text,
  valor_anterior text,
  valor_nuevo text,
  detalle jsonb not null default '{}'::jsonb
);

create index if not exists bitacora_log_folio_idx on public.bitacora_log (folio);
create index if not exists bitacora_log_creado_idx on public.bitacora_log (creado_en desc);
alter table public.bitacora_log enable row level security;

create table if not exists public.ventas_planillas (
  id bigint generated always as identity primary key,
  anio integer not null check (anio between 2000 and 2999),
  mes integer not null check (mes between 1 and 12),
  creado_en timestamptz not null default now(),
  unique (anio, mes)
);

create table if not exists public.ventas_filas (
  id bigint generated always as identity primary key,
  planilla_id bigint not null references public.ventas_planillas(id) on delete cascade,
  lote bigint not null default 0,
  pos integer not null default 0,
  fecha text not null default '',
  codigo text not null default '',
  descripcion text not null default '',
  ubicacion text not null default '',
  m501 numeric not null default 0,
  m502 numeric not null default 0,
  m503 numeric not null default 0,
  m504 numeric not null default 0,
  m505 numeric not null default 0,
  solicitado numeric not null default 0,
  entregar numeric not null default 0,
  med text not null default '',
  tiras numeric,
  dif numeric not null default 0,
  kg_u numeric not null default 0,
  precio_u numeric not null default 0,
  precio_total numeric not null default 0,
  contratista text not null default '',
  movimiento text not null default 'VENTA',
  almacen text not null default '',
  n_venta text not null default '',
  cant_gd numeric not null default 0,
  gd_esval text not null default '',
  estado text not null default '',
  fecha_gd text not null default '',
  gd_esval2 text not null default '',
  observacion text not null default '',
  rojo boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists ventas_filas_planilla_idx on public.ventas_filas (planilla_id, pos);
alter table public.ventas_planillas enable row level security;
alter table public.ventas_filas enable row level security;

create table if not exists public.ventas_log (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  usuario text not null default '',
  accion text not null,
  planilla_id bigint,
  fila_id bigint,
  campo text,
  valor_anterior text,
  valor_nuevo text,
  detalle jsonb not null default '{}'::jsonb
);

create index if not exists ventas_log_planilla_idx on public.ventas_log (planilla_id);
create index if not exists ventas_log_creado_idx on public.ventas_log (creado_en desc);
alter table public.ventas_log enable row level security;
