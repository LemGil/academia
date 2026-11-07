-- =====================================================================
-- LemChat (Fase B) — Buzón por internet en Supabase
-- ---------------------------------------------------------------------
-- Correr UNA vez en el SQL Editor del MISMO proyecto Supabase que ya
-- usan LemWriter y la Academia (el de las tablas lw_* y los cursos).
-- Crea solo la tabla lc_mensajes: no toca ninguna tabla existente.
--
-- CÓMO FUNCIONA (honesto, para que sepas qué estás creando):
-- El buzón es una oficina pública a propósito. Cualquiera con la anon
-- key puede dejar, leer y borrar filas de lc_mensajes. Eso NO es un
-- descuido: la privacidad y la confianza no viven en la tabla —
--   * los mensajes personales viajan CIFRADOS extremo a extremo
--     (sin las llaves de los dos teléfonos, la fila es ilegible);
--   * cada fila va FIRMADA con Ed25519 y la app descarta lo que no
--     verifica;
--   * un paquete de enseñanza SOLO se archiva solo si lo firmó la
--     llave del maestro.
-- Lo que un abusador con la anon key SÍ podría hacer es borrar filas
-- (fastidiar la entrega, no falsificarla). Para la Fase B es un riesgo
-- aceptado y conocido; si un día hace falta, se endurece con una
-- función que exija la firma antes de borrar.
--
-- Las filas del canal las lee todo el mundo y NO se borran al leer:
-- expiran solas a los 30 días (columna expira_en). Las personales las
-- borra el destinatario al recogerlas.
-- =====================================================================

create table if not exists public.lc_mensajes (
  id         uuid primary key default gen_random_uuid(),
  de         text not null,  -- clave pública Ed25519 del remitente (base64url)
  para       text not null,  -- clave pública del destinatario, o 'canal'
  tipo       text not null check (tipo in ('texto', 'paquete', 'recibo')),
  cuerpo     text not null,  -- texto sellado, sobre de paquete o id (recibo)
  firma      text not null,  -- firma Ed25519 del remitente sobre la fila
  creado_en  timestamptz not null default now(),
  expira_en  timestamptz not null default (now() + interval '30 days')
);

create index if not exists lc_mensajes_para_idx
  on public.lc_mensajes (para, creado_en);

create index if not exists lc_mensajes_expira_idx
  on public.lc_mensajes (expira_en);

alter table public.lc_mensajes enable row level security;

-- Oficina pública: el rol anon (la app del estudiante, sin cuentas)
-- puede insertar, leer y borrar. Ver la explicación de arriba.
drop policy if exists lc_buzon_insertar on public.lc_mensajes;
create policy lc_buzon_insertar on public.lc_mensajes
  for insert to anon with check (true);

drop policy if exists lc_buzon_leer on public.lc_mensajes;
create policy lc_buzon_leer on public.lc_mensajes
  for select to anon using (true);

drop policy if exists lc_buzon_borrar on public.lc_mensajes;
create policy lc_buzon_borrar on public.lc_mensajes
  for delete to anon using (true);

-- Limpieza de expirados (opcional, cuando quieras, a mano):
--   delete from public.lc_mensajes where expira_en < now();
-- Si tu plan de Supabase trae pg_cron, puedes programarla semanal:
--   select cron.schedule('lc-limpiar', '0 4 * * 1',
--     $$ delete from public.lc_mensajes where expira_en < now() $$);
