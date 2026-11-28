-- =====================================================================
-- Web app de citas — base de datos en Supabase (PostgreSQL)
--
-- Una sola base de datos sirve para VARIOS negocios (barberías, spas,
-- dentistas, nutriólogos...). Cada servicio, horario, cita, administrador y
-- aviso pertenece a un negocio (columna business_id).
--
-- Se puede ejecutar completo más de una vez sin problema. Si la base ya tenía
-- los datos de UNA sola barbería (versión anterior), los conserva y los pasa
-- al negocio "demo-barberia".
--
-- Cómo funciona la seguridad:
--   * Los clientes (sin cuenta) solo pueden ver los datos públicos de cada
--     negocio (nombre, servicios, horario) y QUÉ HORARIOS están ocupados.
--     Nunca ven nombres ni celulares de otros clientes.
--   * Las citas solo se crean con la función create_booking(), que valida todo
--     en el servidor y evita citas dobles.
--   * Cada administrador (un correo en la tabla "admins") solo puede ver y
--     cambiar los datos de SU negocio.
--
-- Para dar de alta un negocio nuevo (desde el editor SQL de Supabase):
--   select public.create_business('sonrisa-dental', 'Sonrisa Dental', 'dentista',
--                                 '5512345678', 'dueno@correo.com', 'Calle 1, Col. Centro');
--   (antes, crea el usuario del dueño en Authentication → Users con ese mismo correo)
-- =====================================================================

-- 1) NEGOCIOS ----------------------------------------------------------

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  -- Va en la dirección: app.tudominio.com/<slug>. Solo minúsculas, números y guiones.
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
           and char_length(slug) between 2 and 40
           and slug not in ('admin', 'api', 'app', 'assets')),
  name text not null check (char_length(name) between 1 and 80),
  -- Giro: barberia, spa, dentista, nutriologo, medico, estetica, otro...
  category text not null default 'otro' check (category ~ '^[a-z0-9_-]{2,30}$'),
  tagline text not null default '',
  whatsapp_number text not null default '' check (whatsapp_number ~ '^[0-9]*$'),
  display_phone text not null default '',
  address text not null default '',
  maps_url text not null default '' check (maps_url = '' or maps_url ~* '^https?://'),
  instagram_url text not null default '' check (instagram_url = '' or instagram_url ~* '^https?://'),
  facebook_url text not null default '' check (facebook_url = '' or facebook_url ~* '^https?://'),
  tiktok_url text not null default '' check (tiktok_url = '' or tiktok_url ~* '^https?://'),
  -- Etiquetas de la portada: {"Estacionamiento","Pago con tarjeta"}
  perks text[] not null default '{}',
  -- Promociones de la portada: [{"id","title","description","days","normalPrice","promoPrice"}]
  promotions jsonb not null default '[]'::jsonb check (jsonb_typeof(promotions) = 'array'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Look del negocio (ver services/themes.ts). Los tres son opcionales:
--   theme: barberia, spa, clinica, natural o esencia. En blanco usa el de su giro (category).
--   brand_color: color principal de su marca, como #1A8F6B. En blanco usa el del tema.
--   logo_url: link completo (https://...) o archivo de la app (demos/logo.svg).
alter table public.businesses add column if not exists theme text not null default '';
alter table public.businesses drop constraint if exists businesses_theme_check;
alter table public.businesses add constraint businesses_theme_check
  check (theme in ('', 'barberia', 'spa', 'clinica', 'natural', 'esencia'));
alter table public.businesses add column if not exists brand_color text not null default ''
  check (brand_color = '' or brand_color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.businesses add column if not exists logo_url text not null default ''
  check (logo_url = '' or logo_url ~* '^https://[^ ]+$' or logo_url ~ '^demos/[a-z0-9._-]+$');

-- Negocio de ejemplo (también es donde caen los datos de la versión anterior)
insert into public.businesses (
  slug, name, category, tagline, whatsapp_number, display_phone, address,
  instagram_url, facebook_url, tiktok_url, perks, promotions
)
select
  'demo-barberia', 'StyleFlow Barbería', 'barberia',
  'Corte fresco, flow real. Reserva tu cita en menos de un minuto.',
  '525617527272', '56 1752 7272',
  'Calle Ejemplo 123, Col. Centro, Ciudad de México',
  'https://www.instagram.com/', 'https://www.facebook.com/', 'https://www.tiktok.com/',
  array['Cafecito de cortesía', 'Música a tu gusto', 'Toalla caliente en la barba'],
  '[{"id":"lunes-corte","title":"Lunes de corte","description":"Corte de cabello con máquina y tijera","days":"Solo los lunes","normalPrice":150,"promoPrice":120},{"id":"martes-barba","title":"Martes de barbones","description":"Corte de cabello y arreglo de barba","days":"Solo los martes","normalPrice":250,"promoPrice":210}]'::jsonb
where not exists (select 1 from public.businesses);

-- 2) TABLAS DE CADA NEGOCIO ----------------------------------------------

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  title text not null,
  price integer not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Una fila por negocio con su horario
create table if not exists public.settings (
  business_id uuid references public.businesses(id) on delete cascade,
  work_start text not null default '10:00',
  work_end text not null default '20:00',
  break_start text,
  break_end text,
  off_days integer[] not null default '{0}',   -- 0 = domingo ... 6 = sábado
  slot_interval integer not null default 30 check (slot_interval between 5 and 240),
  -- Máximo de citas próximas por celular (se cambia desde el panel, en Configuración)
  max_bookings_per_phone integer not null default 3 check (max_bookings_per_phone between 1 and 20)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text not null check (char_length(customer_phone) between 10 and 20),
  services jsonb not null default '[]'::jsonb,   -- copia de los servicios elegidos
  total_price integer not null default 0 check (total_price >= 0),
  total_duration integer not null default 30 check (total_duration > 0),
  booking_date date not null,
  time_slot text not null check (time_slot ~ '^[0-2][0-9]:[0-5][0-9]$'),
  created_at timestamptz not null default now()
);

-- Cupo y deslinde (se cambian desde el panel, en Configuración)
--   capacity: lugares por horario (barbería con 3 sillas = 3; estudio con 6 tubos = 6)
--   waiver_enabled / waiver_text: deslinde que el cliente acepta al reservar (si el texto está en blanco se usa uno general)
alter table public.settings add column if not exists capacity integer not null default 1
  check (capacity between 1 and 50);
alter table public.settings add column if not exists waiver_enabled boolean not null default false;
alter table public.settings add column if not exists waiver_text text not null default ''
  check (char_length(waiver_text) <= 4000);

-- Locales (sucursales) de un negocio. Todo lo que quede en blanco (null) usa lo de Configuración del negocio.
-- Mientras un negocio no tenga locales, funciona como siempre (un solo lugar).
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  address text not null default '' check (char_length(address) <= 200),
  maps_url text not null default '' check (maps_url = '' or maps_url ~* '^https?://[^ ]+$'),
  capacity integer check (capacity is null or capacity between 1 and 50),
  work_start text check (work_start is null or work_start ~ '^[0-2][0-9]:[0-5][0-9]$'),
  work_end text check (work_end is null or work_end ~ '^[0-2][0-9]:[0-5][0-9]$'),
  break_start text check (break_start is null or break_start ~ '^[0-2][0-9]:[0-5][0-9]$'),
  break_end text check (break_end is null or break_end ~ '^[0-2][0-9]:[0-5][0-9]$'),
  off_days integer[],
  slot_interval integer check (slot_interval is null or slot_interval between 5 and 240),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists locations_business_idx on public.locations (business_id);

-- Un servicio sin local es de todos; con local, solo de ese
alter table public.services add column if not exists location_id uuid references public.locations(id) on delete set null;

-- La cita guarda en qué local es y, si el negocio pide deslinde, cuándo lo aceptó
alter table public.bookings add column if not exists location_id uuid references public.locations(id) on delete set null;
alter table public.bookings add column if not exists waiver_accepted_at timestamptz;
create index if not exists bookings_business_date_idx on public.bookings (business_id, booking_date);

-- Correos con permiso de administrador (cada uno, en su negocio)
create table if not exists public.admins (
  business_id uuid references public.businesses(id) on delete cascade,
  email text not null
);

-- Chats de Telegram que reciben los avisos de cada negocio (nadie desde la app puede leerla)
create table if not exists public.notify_chats (
  business_id uuid references public.businesses(id) on delete cascade,
  chat_id bigint not null,
  label text not null default '',
  created_at timestamptz not null default now()
);

-- Si las tablas ya existían de una versión anterior, agrega lo que falta
alter table public.services add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.bookings add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.settings add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.admins add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.notify_chats add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.settings
  add column if not exists max_bookings_per_phone integer not null default 3
  check (max_bookings_per_phone between 1 and 20);

-- Los datos de la versión de una sola barbería pasan al negocio "demo-barberia"
-- y las llaves primarias antiguas se cambian por otras que incluyen el negocio.
do $$
declare
  v_demo uuid;
  v_table text;
  v_pk text;
begin
  select id into v_demo from public.businesses where slug = 'demo-barberia';

  update public.services set business_id = v_demo where business_id is null;
  update public.bookings set business_id = v_demo where business_id is null;
  update public.settings set business_id = v_demo where business_id is null;
  update public.admins set business_id = v_demo where business_id is null;
  update public.notify_chats set business_id = v_demo where business_id is null;

  -- Antes el horario era una sola fila con id = 1
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'settings' and column_name = 'id'
  ) then
    alter table public.settings drop constraint if exists settings_id_check;
  end if;

  foreach v_table in array array['settings', 'admins', 'notify_chats'] loop
    v_pk := null;
    select c.conname into v_pk
    from pg_constraint c
    where c.conrelid = ('public.' || v_table)::regclass
      and c.contype = 'p'
      and not exists (
        select 1 from pg_attribute a
        where a.attrelid = c.conrelid and a.attnum = any (c.conkey) and a.attname = 'business_id'
      );
    if v_pk is not null then
      execute format('alter table public.%I drop constraint %I', v_table, v_pk);
    end if;
  end loop;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'settings' and column_name = 'id'
  ) then
    alter table public.settings alter column id drop not null;
  end if;

  alter table public.services alter column business_id set not null;
  alter table public.bookings alter column business_id set not null;
  alter table public.settings alter column business_id set not null;
  alter table public.admins alter column business_id set not null;
  alter table public.notify_chats alter column business_id set not null;
  alter table public.admins alter column email set not null;
  alter table public.notify_chats alter column chat_id set not null;

  if not exists (select 1 from pg_constraint where conrelid = 'public.settings'::regclass and contype = 'p') then
    alter table public.settings add primary key (business_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.admins'::regclass and contype = 'p') then
    alter table public.admins add primary key (business_id, email);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.notify_chats'::regclass and contype = 'p') then
    alter table public.notify_chats add primary key (business_id, chat_id);
  end if;
end;
$$;

drop index if exists public.bookings_date_idx;
create index if not exists bookings_business_date_idx on public.bookings (business_id, booking_date, time_slot);
create index if not exists services_business_idx on public.services (business_id, sort_order);

-- Cada negocio nuevo nace con su horario por defecto
insert into public.settings (business_id)
select b.id from public.businesses b
where not exists (select 1 from public.settings s where s.business_id = b.id);

create or replace function public.businesses_create_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (business_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.businesses_create_settings() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'businesses_settings_insert' and tgrelid = 'public.businesses'::regclass
  ) then
    create trigger businesses_settings_insert
      after insert on public.businesses
      for each row execute function public.businesses_create_settings();
  end if;
end;
$$;

-- 3) ¿QUIÉN ES ADMINISTRADOR? ----------------------------------------

create or replace function public.is_business_admin(p_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where a.business_id = p_business
      and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_business_admin(uuid) to anon, authenticated;

-- 4) SEGURIDAD A NIVEL DE FILA (RLS) -----------------------------------

alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.settings enable row level security;
alter table public.bookings enable row level security;
alter table public.admins enable row level security;         -- sin políticas: nadie la lee directo
alter table public.notify_chats enable row level security;   -- sin políticas: nadie la lee directo
alter table public.locations enable row level security;

-- Negocios: los ven todos (solo los activos). Se crean y cambian desde el editor SQL.
drop policy if exists "businesses_select" on public.businesses;
create policy "businesses_select" on public.businesses
  for select to anon, authenticated using (active);

-- Servicios: los ve cualquiera; solo el admin de ese negocio los cambia
drop policy if exists "services_select" on public.services;
create policy "services_select" on public.services
  for select to anon, authenticated using (true);

-- (el local de un servicio tiene que ser de ese mismo negocio)
drop policy if exists "services_insert" on public.services;
create policy "services_insert" on public.services
  for insert to authenticated with check (
    public.is_business_admin(business_id)
    and (location_id is null or exists (
      select 1 from public.locations l where l.id = services.location_id and l.business_id = services.business_id))
  );

drop policy if exists "services_update" on public.services;
create policy "services_update" on public.services
  for update to authenticated
  using (public.is_business_admin(business_id))
  with check (
    public.is_business_admin(business_id)
    and (location_id is null or exists (
      select 1 from public.locations l where l.id = services.location_id and l.business_id = services.business_id))
  );

drop policy if exists "services_delete" on public.services;
create policy "services_delete" on public.services
  for delete to authenticated using (public.is_business_admin(business_id));

-- Configuración: la ve cualquiera; solo el admin de ese negocio la cambia
drop policy if exists "settings_select" on public.settings;
create policy "settings_select" on public.settings
  for select to anon, authenticated using (true);

drop policy if exists "settings_update" on public.settings;
create policy "settings_update" on public.settings
  for update to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));

-- Locales: los ve cualquiera (dirección y mapa son públicos); solo el admin de ese negocio los crea y cambia.
-- No se borran: se ocultan (active = false) para no perder el historial de sus citas.
drop policy if exists "locations_select" on public.locations;
create policy "locations_select" on public.locations
  for select to anon, authenticated using (true);

drop policy if exists "locations_insert" on public.locations;
create policy "locations_insert" on public.locations
  for insert to authenticated with check (public.is_business_admin(business_id));

drop policy if exists "locations_update" on public.locations;
create policy "locations_update" on public.locations
  for update to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));

-- Citas: solo el admin de ese negocio las ve y las cancela. Los clientes NO tienen acceso directo.
drop policy if exists "bookings_select" on public.bookings;
create policy "bookings_select" on public.bookings
  for select to authenticated using (public.is_business_admin(business_id));

drop policy if exists "bookings_delete" on public.bookings;
create policy "bookings_delete" on public.bookings
  for delete to authenticated using (public.is_business_admin(business_id));

-- Permisos de tabla: primero se quitan todos y luego se dan solo los necesarios
-- (las reglas de arriba deciden además qué filas se ven). Las columnas business_id
-- e id nunca se pueden modificar desde la app.
revoke all on public.businesses, public.services, public.settings, public.bookings,
  public.admins, public.notify_chats, public.locations from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.businesses, public.services, public.settings, public.locations to anon, authenticated;
grant insert, delete on public.services to authenticated;
grant update (title, price, duration_minutes, description, sort_order, location_id) on public.services to authenticated;
grant update (work_start, work_end, break_start, break_end, off_days, slot_interval, max_bookings_per_phone,
  capacity, waiver_enabled, waiver_text)
  on public.settings to authenticated;
grant insert on public.locations to authenticated;
grant update (name, address, maps_url, capacity, work_start, work_end, break_start, break_end, off_days,
  slot_interval, sort_order, active)
  on public.locations to authenticated;
grant select, delete on public.bookings to authenticated;

-- 5) HORARIOS OCUPADOS (sin datos personales) ---------------------------

create or replace function public.get_taken_slots(p_business uuid, p_from date default current_date)
returns table (booking_date date, time_slot text, total_duration integer)
language sql
stable
security definer
set search_path = public
as $$
  select b.booking_date, b.time_slot, b.total_duration
  from public.bookings b
  where b.business_id = p_business
    and b.booking_date >= p_from
    and b.booking_date <= p_from + 120
  order by b.booking_date, b.time_slot;
$$;

grant execute on function public.get_taken_slots(uuid, date) to anon, authenticated;

-- Igual que la anterior, pero dice en qué local es cada cita (la pantalla de reservas la usa para contar el cupo)
create or replace function public.get_booked_slots(p_business uuid, p_from date default current_date)
returns table (booking_date date, time_slot text, total_duration integer, location_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select b.booking_date, b.time_slot, b.total_duration, b.location_id
  from public.bookings b
  where b.business_id = p_business
    and b.booking_date >= p_from
    and b.booking_date <= p_from + 120
  order by b.booking_date, b.time_slot;
$$;

grant execute on function public.get_booked_slots(uuid, date) to anon, authenticated;

-- 6) CREAR UNA CITA (validada en el servidor, sin citas dobles) -----------

-- Cambió la lista de datos: se quita la versión anterior (la nueva acepta las mismas llamadas de antes)
drop function if exists public.create_booking(uuid, text, text, uuid[], date, text);

-- p_location: el local elegido (si el negocio tiene varios es obligatorio; si tiene uno, se usa ese).
-- p_waiver: true si el cliente aceptó el deslinde (obligatorio solo si el negocio lo pide).
-- Cupo: en cada instante puede haber hasta "capacity" citas en el mismo local.
create or replace function public.create_booking(
  p_business uuid,
  p_name text,
  p_phone text,
  p_service_ids uuid[],
  p_date date,
  p_time_slot text,
  p_location uuid default null,
  p_waiver boolean default false
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
  v_found integer;
  v_requested integer;
  v_set public.settings%rowtype;
  v_loc public.locations%rowtype;
  v_location uuid;
  v_nloc integer;
  v_work_start text;
  v_work_end text;
  v_break_start text;
  v_break_end text;
  v_off integer[];
  v_capacity integer;
  v_active integer;
begin
  if not exists (select 1 from public.businesses where id = p_business and active) then
    raise exception 'business_not_found';
  end if;

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

  select * into v_set from public.settings where business_id = p_business;

  -- Deslinde: si el negocio lo pide, el cliente tiene que haberlo aceptado
  if coalesce(v_set.waiver_enabled, false) and not coalesce(p_waiver, false) then
    raise exception 'waiver_required';
  end if;

  -- Local: con varios locales hay que elegir uno; con uno solo se usa ese; sin locales, el negocio es un solo lugar
  select count(*) into v_nloc from public.locations where business_id = p_business and active;

  if p_location is not null then
    select * into v_loc from public.locations where id = p_location and business_id = p_business and active;
    if not found then
      raise exception 'invalid_location';
    end if;
    v_location := v_loc.id;
  elsif v_nloc = 1 then
    select * into v_loc from public.locations where business_id = p_business and active;
    v_location := v_loc.id;
  elsif v_nloc > 1 then
    raise exception 'location_required';
  end if;

  -- Servicios: deben ser de ESTE negocio (y de todos los locales o del elegido).
  -- El precio y la duración se calculan aquí, no los manda el cliente
  select
    count(*),
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
  into v_found, v_price, v_duration, v_services
  from public.services s
  where s.business_id = p_business
    and s.id = any(p_service_ids)
    and (s.location_id is null or s.location_id = v_location);

  select count(distinct x) into v_requested from unnest(coalesce(p_service_ids, '{}'::uuid[])) as x;

  if v_duration <= 0 or v_found <> v_requested then
    raise exception 'invalid_services';
  end if;

  -- Horario, días de descanso y cupo: lo del local si lo tiene; si no, lo del negocio
  v_work_start := coalesce(v_loc.work_start, v_set.work_start);
  v_work_end := coalesce(v_loc.work_end, v_set.work_end);
  if v_loc.work_start is not null then
    -- si el local define su horario, también define su descanso (puede ser "sin descanso")
    v_break_start := v_loc.break_start;
    v_break_end := v_loc.break_end;
  else
    v_break_start := v_set.break_start;
    v_break_end := v_set.break_end;
  end if;
  v_off := coalesce(v_loc.off_days, v_set.off_days);
  v_capacity := coalesce(v_loc.capacity, v_set.capacity, 1);

  if v_off is not null and extract(dow from p_date)::integer = any(v_off) then
    raise exception 'day_off';
  end if;

  v_start := split_part(p_time_slot, ':', 1)::integer * 60 + split_part(p_time_slot, ':', 2)::integer;
  v_end := v_start + v_duration;

  if v_work_start is not null and v_work_end is not null then
    if v_start < (split_part(v_work_start, ':', 1)::integer * 60 + split_part(v_work_start, ':', 2)::integer)
       or v_start >= (split_part(v_work_end, ':', 1)::integer * 60 + split_part(v_work_end, ':', 2)::integer) then
      raise exception 'invalid_time';
    end if;
  end if;

  if v_break_start is not null and v_break_end is not null then
    if v_start >= (split_part(v_break_start, ':', 1)::integer * 60 + split_part(v_break_start, ':', 2)::integer)
       and v_start < (split_part(v_break_end, ':', 1)::integer * 60 + split_part(v_break_end, ':', 2)::integer) then
      raise exception 'invalid_time';
    end if;
  end if;

  -- Límite de citas próximas por celular en este negocio (un candado por celular para que dos reservas a la vez no lo rebasen)
  perform pg_advisory_xact_lock(hashtext('phone:' || p_business::text || ':' || right(v_digits, 10)));

  select count(*) into v_active
  from public.bookings b
  where b.business_id = p_business
    and right(regexp_replace(b.customer_phone, '\D', '', 'g'), 10) = right(v_digits, 10)
    and b.booking_date >= (now() at time zone 'America/Mexico_City')::date;

  if v_active >= coalesce(v_set.max_bookings_per_phone, 3) then
    raise exception 'too_many_bookings';
  end if;

  -- Una cita a la vez por día y local, para que dos personas no se queden con el último lugar
  perform pg_advisory_xact_lock(hashtext('bookings:' || p_business::text || ':' || p_date::text || ':' || coalesce(v_location::text, '')));

  -- Cupo: se revisa el momento de inicio y el inicio de cada cita que empieza durante esta;
  -- si en alguno ya están todos los lugares ocupados, el horario no está disponible
  if exists (
    select 1
    from (
      select v_start as t
      union
      select (split_part(b.time_slot, ':', 1)::integer * 60 + split_part(b.time_slot, ':', 2)::integer)
      from public.bookings b
      where b.business_id = p_business
        and b.booking_date = p_date
        and b.location_id is not distinct from v_location
        and (split_part(b.time_slot, ':', 1)::integer * 60 + split_part(b.time_slot, ':', 2)::integer) > v_start
        and (split_part(b.time_slot, ':', 1)::integer * 60 + split_part(b.time_slot, ':', 2)::integer) < v_end
    ) pts
    where (
      select count(*)
      from public.bookings b2
      where b2.business_id = p_business
        and b2.booking_date = p_date
        and b2.location_id is not distinct from v_location
        and (split_part(b2.time_slot, ':', 1)::integer * 60 + split_part(b2.time_slot, ':', 2)::integer) <= pts.t
        and (split_part(b2.time_slot, ':', 1)::integer * 60 + split_part(b2.time_slot, ':', 2)::integer + b2.total_duration) > pts.t
    ) >= v_capacity
  ) then
    raise exception 'slot_taken';
  end if;

  insert into public.bookings (
    business_id, customer_name, customer_phone, services, total_price, total_duration, booking_date, time_slot,
    location_id, waiver_accepted_at
  ) values (
    p_business, trim(p_name), trim(p_phone), v_services, v_price, v_duration, p_date, p_time_slot,
    v_location,
    case when coalesce(v_set.waiver_enabled, false) then now() else null end
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_booking(uuid, text, text, uuid[], date, text, uuid, boolean) to anon, authenticated;

-- 7) MIS RESERVAS (el cliente ve y cancela sus propias citas) -------------
-- Se busca por celular (se comparan los últimos 10 dígitos). Para no exponer
-- datos personales, la búsqueda NO regresa nombre ni teléfono, solo muestra
-- citas de hoy en adelante, y solo se cancela una cita si el celular coincide.

-- Cambió la lista de datos (ahora dice el local): se quita la versión anterior
drop function if exists public.get_my_bookings(uuid, text);

create or replace function public.get_my_bookings(p_business uuid, p_phone text)
returns table (
  id uuid,
  booking_date date,
  time_slot text,
  services jsonb,
  total_price integer,
  total_duration integer,
  location_id uuid,
  location_name text
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
    select b.id, b.booking_date, b.time_slot, b.services, b.total_price, b.total_duration, b.location_id, l.name
    from public.bookings b
    left join public.locations l on l.id = b.location_id
    where b.business_id = p_business
      and right(regexp_replace(b.customer_phone, '\D', '', 'g'), 10) = right(v_digits, 10)
      and b.booking_date >= (now() at time zone 'America/Mexico_City')::date
    order by b.booking_date, b.time_slot;
end;
$$;

-- Regresa true si canceló la cita, false si no pudo (celular distinto, cita pasada, inexistente
-- o de otro negocio). Si se canceló, avisa por Telegram (sección 8; si no está configurado, no hace nada).
create or replace function public.cancel_my_booking(p_business uuid, p_booking_id uuid, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text;
  v_row public.bookings%rowtype;
  v_name text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_digits) < 10 or length(v_digits) > 15 then
    raise exception 'invalid_phone';
  end if;

  delete from public.bookings b
  where b.id = p_booking_id
    and b.business_id = p_business
    and right(regexp_replace(b.customer_phone, '\D', '', 'g'), 10) = right(v_digits, 10)
    and b.booking_date >= (now() at time zone 'America/Mexico_City')::date
  returning b.* into v_row;

  if not found then
    return false;
  end if;

  select name into v_name from public.businesses where id = p_business;

  perform public.send_telegram(
    p_business,
    E'❌ Cita cancelada por el cliente · ' || coalesce(v_name, '') || E'\n' ||
    E'👤 ' || v_row.customer_name || E'\n' ||
    E'📅 ' || public.format_slot_es(v_row.booking_date, v_row.time_slot) || E'\n' ||
    E'✂️ ' || coalesce((select string_agg(e ->> 'title', ', ') from jsonb_array_elements(v_row.services) e), '') || E'\n' ||
    coalesce(E'📍 ' || (select l.name from public.locations l where l.id = v_row.location_id) || E'\n', '') ||
    E'📱 ' || v_row.customer_phone
  );

  return true;
end;
$$;

revoke all on function public.get_my_bookings(uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_my_booking(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.get_my_bookings(uuid, text) to anon, authenticated;
grant execute on function public.cancel_my_booking(uuid, uuid, text) to anon, authenticated;

-- 8) AVISOS POR TELEGRAM AL NEGOCIO ----------------------------------------
-- Cada vez que se reserva una cita (o un cliente cancela la suya) llega un
-- mensaje al Telegram de quien atiende ese negocio. Es opcional: mientras no
-- exista el token, no hace nada y las citas se guardan normal.
--
-- Cómo activarlo:
--   1. Una sola vez: crea el bot con @BotFather (/newbot) y guarda su token en
--      Supabase Vault (queda cifrado, nunca en el código):
--        select vault.create_secret('PEGA_AQUÍ_EL_TOKEN', 'telegram_bot_token');
--   2. Por cada negocio: la persona que recibirá los avisos abre el bot y toca
--      "Iniciar" (si no, el bot no puede escribirle), y con @userinfobot obtiene
--      su Id (un número). Luego:
--        insert into public.notify_chats (business_id, chat_id, label)
--        select id, 123456789, 'Dueño' from public.businesses where slug = 'sonrisa-dental';
--   Para quitar a alguien:  delete from public.notify_chats where chat_id = 123456789;

create extension if not exists pg_net;

-- "Jueves 3 de diciembre, 2:00 p.m."
create or replace function public.format_slot_es(p_date date, p_slot text)
returns text
language sql
immutable
set search_path = public
as $$
  select
    upper(left((array['domingo','lunes','martes','miércoles','jueves','viernes','sábado'])[extract(dow from p_date)::int + 1], 1))
    || substr((array['domingo','lunes','martes','miércoles','jueves','viernes','sábado'])[extract(dow from p_date)::int + 1], 2)
    || ' ' || extract(day from p_date)::int
    || ' de ' || (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from p_date)::int]
    || ', '
    || (case when split_part(p_slot, ':', 1)::int % 12 = 0 then 12 else split_part(p_slot, ':', 1)::int % 12 end)
    || ':' || split_part(p_slot, ':', 2)
    || ' ' || (case when split_part(p_slot, ':', 1)::int < 12 then 'a.m.' else 'p.m.' end);
$$;

-- Manda un texto a todos los chats registrados de ese negocio. Nunca lanza errores:
-- avisar no debe impedir guardar o cancelar una cita.
create or replace function public.send_telegram(p_business uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_chat record;
begin
  select s.decrypted_secret into v_token
  from vault.decrypted_secrets s
  where s.name = 'telegram_bot_token'
  limit 1;

  if v_token is null or v_token = '' then
    return;
  end if;

  for v_chat in select chat_id from public.notify_chats where business_id = p_business loop
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      body := jsonb_build_object('chat_id', v_chat.chat_id, 'text', p_text),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end loop;
exception when others then
  null;
end;
$$;

revoke all on function public.send_telegram(uuid, text) from public, anon, authenticated;

-- Aviso de cita nueva
create or replace function public.notify_new_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select name into v_name from public.businesses where id = new.business_id;

  perform public.send_telegram(
    new.business_id,
    E'💈 Nueva cita · ' || coalesce(v_name, '') || E'\n' ||
    E'👤 ' || new.customer_name || E'\n' ||
    E'📅 ' || public.format_slot_es(new.booking_date, new.time_slot) || E'\n' ||
    E'✂️ ' || coalesce((select string_agg(e ->> 'title', ', ') from jsonb_array_elements(new.services) e), '') || E'\n' ||
    E'💵 $' || to_char(new.total_price, 'FM999,999,990') || E'\n' ||
    coalesce(E'📍 ' || (select l.name from public.locations l where l.id = new.location_id) || E'\n', '') ||
    E'📱 ' || new.customer_phone
  );
  return new;
exception when others then
  return new;
end;
$$;

revoke all on function public.notify_new_booking() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'bookings_notify_insert' and tgrelid = 'public.bookings'::regclass
  ) then
    create trigger bookings_notify_insert
      after insert on public.bookings
      for each row execute function public.notify_new_booking();
  end if;
end;
$$;

-- Al crear el PRIMER local de un negocio, las citas que ya tenía pasan a ese local
create or replace function public.locations_assign_first()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.locations l where l.business_id = new.business_id) = 1 then
    update public.bookings set location_id = new.id
    where business_id = new.business_id and location_id is null;
  end if;
  return new;
end;
$$;

revoke all on function public.locations_assign_first() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'locations_assign_first_insert' and tgrelid = 'public.locations'::regclass
  ) then
    create trigger locations_assign_first_insert
      after insert on public.locations
      for each row execute function public.locations_assign_first();
  end if;
end;
$$;

-- 9) DAR DE ALTA UN NEGOCIO NUEVO ------------------------------------------
-- Solo se usa desde el editor SQL (la app no puede llamarla). Crea el negocio,
-- su horario por defecto, unos servicios de ejemplo según el giro (se editan
-- desde el panel) y, si se da el correo, al administrador.

create or replace function public.create_business(
  p_slug text,
  p_name text,
  p_category text default 'otro',
  p_whatsapp text default '',
  p_admin_email text default null,
  p_address text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_digits text;
  v_category text;
  v_starter jsonb;
begin
  v_digits := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  -- Número de México de 10 dígitos: se le agrega la lada 52
  if length(v_digits) = 10 then
    v_digits := '52' || v_digits;
  end if;
  v_category := coalesce(nullif(lower(trim(p_category)), ''), 'otro');

  insert into public.businesses (slug, name, category, tagline, whatsapp_number, display_phone, address)
  values (
    lower(trim(p_slug)),
    trim(p_name),
    v_category,
    'Reserva tu cita en menos de un minuto.',
    v_digits,
    case when length(v_digits) >= 10
      then regexp_replace(right(v_digits, 10), '^(\d{2})(\d{4})(\d{4})$', '\1 \2 \3')
      else '' end,
    coalesce(trim(p_address), '')
  )
  returning id into v_id;

  v_starter := case v_category
    when 'barberia' then
      '[{"t":"Corte de cabello","p":150,"d":30,"x":"Clásico o moderno"},{"t":"Arreglo de barba","p":100,"d":20,"x":"Perfilado con toalla caliente"},{"t":"Corte y barba","p":220,"d":50,"x":"El combo completo"}]'
    when 'spa' then
      '[{"t":"Masaje relajante","p":600,"d":60,"x":"Descontractura y relajación"},{"t":"Facial hidratante","p":450,"d":45,"x":"Limpieza e hidratación"},{"t":"Masaje con piedras calientes","p":850,"d":75,"x":"Relajación profunda"}]'
    when 'dentista' then
      '[{"t":"Consulta de valoración","p":400,"d":30,"x":"Revisión y plan de tratamiento"},{"t":"Limpieza dental","p":600,"d":45,"x":"Profilaxis y pulido"},{"t":"Blanqueamiento dental","p":2500,"d":60,"x":"Un tono más claro en una sesión"}]'
    when 'nutriologo' then
      '[{"t":"Primera consulta","p":700,"d":60,"x":"Valoración y plan de alimentación"},{"t":"Consulta de seguimiento","p":450,"d":30,"x":"Ajustes y avances"}]'
    when 'medico' then
      '[{"t":"Consulta general","p":500,"d":30,"x":"Revisión y diagnóstico"},{"t":"Consulta de seguimiento","p":350,"d":20,"x":"Control y resultados"}]'
    when 'estetica' then
      '[{"t":"Corte de cabello","p":250,"d":45,"x":"Corte y peinado"},{"t":"Manicure","p":200,"d":45,"x":"Cuidado y esmaltado"},{"t":"Tinte","p":800,"d":120,"x":"Color completo"}]'
    when 'estudio' then
      '[{"t":"Clase grupal","p":150,"d":60,"x":"Cupo limitado, cada quien con su lugar"},{"t":"Clase privada","p":300,"d":60,"x":"Atención 1 a 1 a tu ritmo"}]'
    else
      '[{"t":"Consulta o servicio","p":300,"d":30,"x":"Edita este servicio desde tu panel"}]'
  end::jsonb;

  insert into public.services (business_id, title, price, duration_minutes, description, sort_order)
  select v_id, e.x ->> 't', (e.x ->> 'p')::integer, (e.x ->> 'd')::integer, e.x ->> 'x', e.n::integer
  from jsonb_array_elements(v_starter) with ordinality as e(x, n);

  if p_admin_email is not null and length(trim(p_admin_email)) > 0 then
    insert into public.admins (business_id, email) values (v_id, lower(trim(p_admin_email)));
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_business(text, text, text, text, text, text) from public, anon, authenticated;

-- Servicios de ejemplo del negocio demo (solo si todavía no tiene)
insert into public.services (business_id, title, price, duration_minutes, description, sort_order)
select b.id, v.title, v.price, v.duration_minutes, v.description, v.sort_order
from public.businesses b,
  (values
    ('Corte de cabello', 150, 30, 'Clásico o moderno, con máquina y tijera', 1),
    ('Arreglo de barba', 100, 20, 'Perfilado con navaja y toalla caliente', 2),
    ('Paquete novio', 800, 120, 'Corte, barba, limpieza facial y peinado', 3),
    ('Limpieza facial', 250, 45, 'Mascarilla negra y vapor caliente', 4)
  ) as v(title, price, duration_minutes, description, sort_order)
where b.slug = 'demo-barberia'
  and not exists (select 1 from public.services s where s.business_id = b.id);

-- 10) COMPATIBILIDAD CON LA VERSIÓN ANTERIOR (de una sola barbería) --------
-- La página anterior llama a estas funciones sin indicar negocio: aquí apuntan
-- al negocio "demo-barberia" para que la página ya publicada siga funcionando
-- mientras se publica la nueva. Cuando ya no se use la versión anterior se
-- pueden borrar (ver README).

create or replace function public.legacy_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.businesses where slug = 'demo-barberia';
$$;

revoke all on function public.legacy_business_id() from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_business_admin(public.legacy_business_id());
$$;

create or replace function public.get_taken_slots(p_from date default current_date)
returns table (booking_date date, time_slot text, total_duration integer)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.get_taken_slots(public.legacy_business_id(), p_from);
$$;

create or replace function public.create_booking(
  p_name text,
  p_phone text,
  p_service_ids uuid[],
  p_date date,
  p_time_slot text
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.create_booking(public.legacy_business_id(), p_name, p_phone, p_service_ids, p_date, p_time_slot);
$$;

create or replace function public.get_my_bookings(p_phone text)
returns table (
  id uuid,
  booking_date date,
  time_slot text,
  services jsonb,
  total_price integer,
  total_duration integer
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.booking_date, m.time_slot, m.services, m.total_price, m.total_duration
  from public.get_my_bookings(public.legacy_business_id(), p_phone) m;
$$;

create or replace function public.cancel_my_booking(p_booking_id uuid, p_phone text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.cancel_my_booking(public.legacy_business_id(), p_booking_id, p_phone);
$$;

revoke all on function public.get_my_bookings(text) from public, anon, authenticated;
revoke all on function public.cancel_my_booking(uuid, text) from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.get_taken_slots(date) to anon, authenticated;
grant execute on function public.create_booking(text, text, uuid[], date, text) to anon, authenticated;
grant execute on function public.get_my_bookings(text) to anon, authenticated;
grant execute on function public.cancel_my_booking(uuid, text) to anon, authenticated;

-- Ya no se usa: ahora el aviso lleva el negocio
drop function if exists public.send_telegram(text);
