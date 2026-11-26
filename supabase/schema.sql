-- =====================================================================
-- StyleFlow Barbería — base de datos en Supabase (PostgreSQL)
-- Se puede ejecutar completo más de una vez sin problema.
--
-- Cómo funciona la seguridad:
--   * Los clientes (sin cuenta) solo pueden ver los servicios, la configuración
--     y QUÉ HORARIOS están ocupados. Nunca ven nombres ni celulares de otros.
--   * Las citas solo se crean con la función create_booking(), que valida todo
--     en el servidor y evita citas dobles.
--   * Solo los correos que estén en la tabla "admins" pueden ver y cambiar
--     citas, servicios y configuración.
-- =====================================================================

-- 1) TABLAS -----------------------------------------------------------

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  price integer not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Una sola fila (id = 1) con el horario de la barbería
create table if not exists public.settings (
  id integer primary key check (id = 1),
  work_start text not null default '10:00',
  work_end text not null default '20:00',
  break_start text,
  break_end text,
  off_days integer[] not null default '{0}',   -- 0 = domingo ... 6 = sábado
  slot_interval integer not null default 30 check (slot_interval between 5 and 240),
  -- Máximo de citas próximas por celular (se cambia desde el panel, en Configuración)
  max_bookings_per_phone integer not null default 3 check (max_bookings_per_phone between 1 and 20)
);

-- Si la tabla ya existía de antes, agrega la columna nueva
alter table public.settings
  add column if not exists max_bookings_per_phone integer not null default 3
  check (max_bookings_per_phone between 1 and 20);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text not null check (char_length(customer_phone) between 10 and 20),
  services jsonb not null default '[]'::jsonb,   -- copia de los servicios elegidos
  total_price integer not null default 0 check (total_price >= 0),
  total_duration integer not null default 30 check (total_duration > 0),
  booking_date date not null,
  time_slot text not null check (time_slot ~ '^[0-2][0-9]:[0-5][0-9]$'),
  created_at timestamptz not null default now()
);

create index if not exists bookings_date_idx on public.bookings (booking_date, time_slot);

-- Correos con permiso de administrador
create table if not exists public.admins (
  email text primary key
);

-- 2) ¿QUIÉN ES ADMINISTRADOR? ----------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- 3) SEGURIDAD A NIVEL DE FILA (RLS) -----------------------------------

alter table public.services enable row level security;
alter table public.settings enable row level security;
alter table public.bookings enable row level security;
alter table public.admins enable row level security;   -- sin políticas: nadie la lee directo

-- Servicios: los ve cualquiera; solo el admin los cambia
drop policy if exists "services_select" on public.services;
create policy "services_select" on public.services
  for select to anon, authenticated using (true);

drop policy if exists "services_insert" on public.services;
create policy "services_insert" on public.services
  for insert to authenticated with check (public.is_admin());

drop policy if exists "services_update" on public.services;
create policy "services_update" on public.services
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "services_delete" on public.services;
create policy "services_delete" on public.services
  for delete to authenticated using (public.is_admin());

-- Configuración: la ve cualquiera; solo el admin la cambia
drop policy if exists "settings_select" on public.settings;
create policy "settings_select" on public.settings
  for select to anon, authenticated using (true);

drop policy if exists "settings_update" on public.settings;
create policy "settings_update" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Citas: solo el admin las ve y las cancela. Los clientes NO tienen acceso directo.
drop policy if exists "bookings_select" on public.bookings;
create policy "bookings_select" on public.bookings
  for select to authenticated using (public.is_admin());

drop policy if exists "bookings_delete" on public.bookings;
create policy "bookings_delete" on public.bookings
  for delete to authenticated using (public.is_admin());

-- Permisos de tabla: primero se quitan todos y luego se dan solo los necesarios
-- (las reglas de arriba deciden además qué filas se ven)
revoke all on public.services, public.settings, public.bookings, public.admins from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.services, public.settings to anon, authenticated;
grant insert, update, delete on public.services to authenticated;
grant update on public.settings to authenticated;
grant select, delete on public.bookings to authenticated;

-- 4) HORARIOS OCUPADOS (sin datos personales) ---------------------------

create or replace function public.get_taken_slots(p_from date default current_date)
returns table (booking_date date, time_slot text, total_duration integer)
language sql
stable
security definer
set search_path = public
as $$
  select b.booking_date, b.time_slot, b.total_duration
  from public.bookings b
  where b.booking_date >= p_from
    and b.booking_date <= p_from + 120
  order by b.booking_date, b.time_slot;
$$;

grant execute on function public.get_taken_slots(date) to anon, authenticated;

-- 5) CREAR UNA CITA (validada en el servidor, sin citas dobles) -----------

create or replace function public.create_booking(
  p_name text,
  p_phone text,
  p_service_ids uuid[],
  p_date date,
  p_time_slot text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_digits text;
  v_start integer;
  v_end integer;
  v_price integer;
  v_duration integer;
  v_services jsonb;
  v_set public.settings%rowtype;
  v_has_settings boolean;
  v_active integer;
begin
  -- Datos básicos
  if p_name is null or length(trim(p_name)) = 0 or length(p_name) > 120 then
    raise exception 'invalid_name';
  end if;

  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_digits) < 10 or length(v_digits) > 15 then
    raise exception 'invalid_phone';
  end if;

  if p_time_slot is null or p_time_slot !~ '^[0-2][0-9]:[0-5][0-9]$' then
    raise exception 'invalid_time';
  end if;

  if p_date is null or p_date < (now() at time zone 'America/Mexico_City')::date then
    raise exception 'past_date';
  end if;

  -- Servicios: el precio y la duración se calculan aquí, no los manda el cliente
  select
    coalesce(sum(s.price), 0),
    coalesce(sum(s.duration_minutes), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'price', s.price,
          'durationMinutes', s.duration_minutes,
          'description', s.description
        ) order by s.sort_order, s.created_at
      ),
      '[]'::jsonb
    )
  into v_price, v_duration, v_services
  from public.services s
  where s.id = any(p_service_ids);

  if v_duration <= 0 then
    raise exception 'invalid_services';
  end if;

  -- Horario de la barbería
  select * into v_set from public.settings where id = 1;
  v_has_settings := found;

  if v_has_settings then
    if extract(dow from p_date)::integer = any(v_set.off_days) then
      raise exception 'day_off';
    end if;
  end if;

  v_start := split_part(p_time_slot, ':', 1)::integer * 60 + split_part(p_time_slot, ':', 2)::integer;
  v_end := v_start + v_duration;

  if v_has_settings then
    if v_start < (split_part(v_set.work_start, ':', 1)::integer * 60 + split_part(v_set.work_start, ':', 2)::integer)
       or v_start >= (split_part(v_set.work_end, ':', 1)::integer * 60 + split_part(v_set.work_end, ':', 2)::integer) then
      raise exception 'invalid_time';
    end if;

    if v_set.break_start is not null and v_set.break_end is not null then
      if v_start >= (split_part(v_set.break_start, ':', 1)::integer * 60 + split_part(v_set.break_start, ':', 2)::integer)
         and v_start < (split_part(v_set.break_end, ':', 1)::integer * 60 + split_part(v_set.break_end, ':', 2)::integer) then
        raise exception 'invalid_time';
      end if;
    end if;
  end if;

  -- Límite de citas próximas por celular (un candado por celular para que dos reservas a la vez no lo rebasen)
  perform pg_advisory_xact_lock(hashtext('phone:' || right(v_digits, 10)));

  select count(*) into v_active
  from public.bookings b
  where right(regexp_replace(b.customer_phone, '\D', '', 'g'), 10) = right(v_digits, 10)
    and b.booking_date >= (now() at time zone 'America/Mexico_City')::date;

  if v_active >= (case when v_has_settings then v_set.max_bookings_per_phone else 3 end) then
    raise exception 'too_many_bookings';
  end if;

  -- Una cita a la vez por día, para que dos personas no tomen el mismo horario
  perform pg_advisory_xact_lock(hashtext('bookings:' || p_date::text));

  if exists (
    select 1
    from public.bookings b
    where b.booking_date = p_date
      and (split_part(b.time_slot, ':', 1)::integer * 60 + split_part(b.time_slot, ':', 2)::integer) < v_end
      and (split_part(b.time_slot, ':', 1)::integer * 60 + split_part(b.time_slot, ':', 2)::integer + b.total_duration) > v_start
  ) then
    raise exception 'slot_taken';
  end if;

  insert into public.bookings (
    customer_name, customer_phone, services, total_price, total_duration, booking_date, time_slot
  ) values (
    trim(p_name), trim(p_phone), v_services, v_price, v_duration, p_date, p_time_slot
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_booking(text, text, uuid[], date, text) to anon, authenticated;

-- 6) DATOS INICIALES -----------------------------------------------------

insert into public.settings (id) values (1) on conflict (id) do nothing;

insert into public.services (title, price, duration_minutes, description, sort_order)
select v.title, v.price, v.duration_minutes, v.description, v.sort_order
from (values
  ('Corte de cabello', 150, 30, 'Clásico o moderno, con máquina y tijera', 1),
  ('Arreglo de barba', 100, 20, 'Perfilado con navaja y toalla caliente', 2),
  ('Paquete novio', 800, 120, 'Corte, barba, limpieza facial y peinado', 3),
  ('Limpieza facial', 250, 45, 'Mascarilla negra y vapor caliente', 4)
) as v(title, price, duration_minutes, description, sort_order)
where not exists (select 1 from public.services);

-- 7) ADMINISTRADOR ---------------------------------------------------------
-- Después de crear el usuario en Authentication → Users, agrega su correo:
--   insert into public.admins (email) values ('correo@ejemplo.com') on conflict do nothing;

-- 8) MIS RESERVAS (el cliente ve y cancela sus propias citas) -------------
-- Se busca por celular (se comparan los últimos 10 dígitos). Para no exponer
-- datos personales, la búsqueda NO regresa nombre ni teléfono, solo muestra
-- citas de hoy en adelante, y solo se cancela una cita si el celular coincide.

create or replace function public.get_my_bookings(p_phone text)
returns table (
  id uuid,
  booking_date date,
  time_slot text,
  services jsonb,
  total_price integer,
  total_duration integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_digits) < 10 or length(v_digits) > 15 then
    raise exception 'invalid_phone';
  end if;

  return query
    select b.id, b.booking_date, b.time_slot, b.services, b.total_price, b.total_duration
    from public.bookings b
    where right(regexp_replace(b.customer_phone, '\D', '', 'g'), 10) = right(v_digits, 10)
      and b.booking_date >= (now() at time zone 'America/Mexico_City')::date
    order by b.booking_date, b.time_slot;
end;
$$;

-- Regresa true si canceló la cita, false si no pudo (celular distinto, cita pasada o inexistente)
create or replace function public.cancel_my_booking(p_booking_id uuid, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text;
  v_deleted integer;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_digits) < 10 or length(v_digits) > 15 then
    raise exception 'invalid_phone';
  end if;

  delete from public.bookings b
  where b.id = p_booking_id
    and right(regexp_replace(b.customer_phone, '\D', '', 'g'), 10) = right(v_digits, 10)
    and b.booking_date >= (now() at time zone 'America/Mexico_City')::date;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.get_my_bookings(text) from public, anon, authenticated;
revoke all on function public.cancel_my_booking(uuid, text) from public, anon, authenticated;
grant execute on function public.get_my_bookings(text) to anon, authenticated;
grant execute on function public.cancel_my_booking(uuid, text) to anon, authenticated;
