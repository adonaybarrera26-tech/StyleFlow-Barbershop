-- =====================================================================
-- NEGOCIOS DE EJEMPLO para mostrar a clientes: spa, dentista, nutriólogo y estudio de pole
-- =====================================================================
-- Pegar completo en Supabase > SQL Editor y ejecutar (se puede repetir las veces que quieras:
-- deja cada demo como nuevo). Antes, cambia el correo de la línea "v_admin" por el tuyo:
-- con ese correo entras al panel de administración de cada demo.
--
--   app.tudominio.com/demo-spa          (tema "spa": ciruela y rosa cuarzo)
--   app.tudominio.com/demo-dentista     (tema "clinica": porcelana y azul agua)
--   app.tudominio.com/demo-nutriologo   (tema "natural": avena y verde hoja)
--   app.tudominio.com/demo-pole         (tema "esencia": noche violeta y dorado)
--
-- Los datos son inventados (teléfono de prueba, direcciones de ejemplo). Los logos están en public/demos/.
-- Requiere haber ejecutado antes supabase/schema.sql (la versión con locales, cupo y deslinde).

do $$
declare
  v_admin text := 'tu-correo@ejemplo.com';   -- <-- CAMBIA ESTO
  v_id uuid;
begin
  -- ---------------------------------------------------------------- Sereno Spa
  select id into v_id from public.businesses where slug = 'demo-spa';
  if v_id is null then
    v_id := public.create_business('demo-spa', 'Sereno Spa', 'spa', '5617527272', v_admin, 'Calle Ejemplo 45, Col. Roma Norte, Ciudad de México');
  end if;

  update public.businesses set
    name = 'Sereno Spa',
    category = 'spa',
    tagline = 'Masajes, faciales y rituales para desconectarte. Reserva en un minuto.',
    instagram_url = 'https://www.instagram.com/',
    facebook_url = 'https://www.facebook.com/',
    perks = array['Té de cortesía', 'Vapor y regadera', 'Estacionamiento'],
    promotions = '[{"id":"miercoles-bienestar","title":"Miércoles de bienestar","description":"Masaje relajante y facial hidratante","days":"Solo los miércoles","normalPrice":1200,"promoPrice":1000}]'::jsonb,
    theme = '', brand_color = '', logo_url = 'demos/sereno-spa.svg'
  where id = v_id;

  update public.settings set
    work_start = '10:00', work_end = '20:00', break_start = null, break_end = null,
    off_days = '{0}', slot_interval = 60
  where business_id = v_id;

  delete from public.services where business_id = v_id;
  insert into public.services (business_id, title, price, duration_minutes, description, sort_order)
  select v_id, e.x ->> 't', (e.x ->> 'p')::integer, (e.x ->> 'd')::integer, e.x ->> 'x', e.n::integer
  from jsonb_array_elements('[
    {"t":"Masaje relajante","p":650,"d":60,"x":"Presión suave con aceites tibios"},
    {"t":"Masaje descontracturante","p":750,"d":60,"x":"Presión firme en espalda, cuello y hombros"},
    {"t":"Facial hidratante","p":550,"d":50,"x":"Limpieza profunda y mascarilla"},
    {"t":"Ritual de piedras calientes","p":890,"d":75,"x":"Piedras volcánicas y aromaterapia"},
    {"t":"Circuito de spa","p":450,"d":90,"x":"Vapor, jacuzzi y regaderas"},
    {"t":"Paquete para pareja","p":1800,"d":90,"x":"Masaje relajante para dos"}
  ]'::jsonb) with ordinality as e(x, n);

  insert into public.admins (business_id, email)
  select v_id, lower(trim(v_admin))
  where not exists (select 1 from public.admins where business_id = v_id and email = lower(trim(v_admin)));

  -- ---------------------------------------------------------------- Dental Sonrisa
  select id into v_id from public.businesses where slug = 'demo-dentista';
  if v_id is null then
    v_id := public.create_business('demo-dentista', 'Dental Sonrisa', 'dentista', '5617527272', v_admin, 'Av. Ejemplo 210, Col. Del Valle, Ciudad de México');
  end if;

  update public.businesses set
    name = 'Dental Sonrisa',
    category = 'dentista',
    tagline = 'Cuidamos tu sonrisa con atención amable y sin esperas. Reserva tu cita en línea.',
    instagram_url = 'https://www.instagram.com/',
    facebook_url = 'https://www.facebook.com/',
    perks = array['Atención con cita', 'Estacionamiento', 'Pago con tarjeta'],
    promotions = '[{"id":"limpieza-valoracion","title":"Limpieza + valoración","description":"Limpieza dental y consulta de valoración","days":"De lunes a jueves","normalPrice":950,"promoPrice":800}]'::jsonb,
    theme = '', brand_color = '', logo_url = 'demos/dental-sonrisa.svg'
  where id = v_id;

  update public.settings set
    work_start = '09:00', work_end = '19:00', break_start = '14:00', break_end = '15:00',
    off_days = '{0}', slot_interval = 30
  where business_id = v_id;

  delete from public.services where business_id = v_id;
  insert into public.services (business_id, title, price, duration_minutes, description, sort_order)
  select v_id, e.x ->> 't', (e.x ->> 'p')::integer, (e.x ->> 'd')::integer, e.x ->> 'x', e.n::integer
  from jsonb_array_elements('[
    {"t":"Limpieza dental","p":600,"d":45,"x":"Profilaxis y pulido"},
    {"t":"Consulta de valoración","p":350,"d":30,"x":"Revisión y plan de tratamiento"},
    {"t":"Blanqueamiento dental","p":2800,"d":60,"x":"Una sonrisa más luminosa en una sesión"},
    {"t":"Resina (empaste)","p":750,"d":45,"x":"Reparación de caries"},
    {"t":"Extracción simple","p":900,"d":45,"x":"Con anestesia local"},
    {"t":"Revisión de ortodoncia","p":800,"d":30,"x":"Ajuste de brackets"}
  ]'::jsonb) with ordinality as e(x, n);

  insert into public.admins (business_id, email)
  select v_id, lower(trim(v_admin))
  where not exists (select 1 from public.admins where business_id = v_id and email = lower(trim(v_admin)));

  -- ---------------------------------------------------------------- Raíz Nutrición
  select id into v_id from public.businesses where slug = 'demo-nutriologo';
  if v_id is null then
    v_id := public.create_business('demo-nutriologo', 'Raíz Nutrición', 'nutriologo', '5617527272', v_admin, 'Calle Ejemplo 88, Col. Condesa, Ciudad de México');
  end if;

  update public.businesses set
    name = 'Raíz Nutrición',
    category = 'nutriologo',
    tagline = 'Come rico y sin culpa, con un plan hecho para ti. Reserva tu consulta en línea.',
    instagram_url = 'https://www.instagram.com/',
    facebook_url = 'https://www.facebook.com/',
    perks = array['Presencial u online', 'Plan por WhatsApp', 'Estacionamiento'],
    promotions = '[{"id":"paquete-4","title":"Paquete de 4 consultas","description":"Primera consulta y tres de seguimiento","days":"Vigente por 30 días","normalPrice":2200,"promoPrice":1900}]'::jsonb,
    theme = '', brand_color = '', logo_url = 'demos/raiz-nutricion.svg'
  where id = v_id;

  update public.settings set
    work_start = '08:00', work_end = '18:00', break_start = '13:00', break_end = '14:00',
    off_days = '{0}', slot_interval = 30
  where business_id = v_id;

  delete from public.services where business_id = v_id;
  insert into public.services (business_id, title, price, duration_minutes, description, sort_order)
  select v_id, e.x ->> 't', (e.x ->> 'p')::integer, (e.x ->> 'd')::integer, e.x ->> 'x', e.n::integer
  from jsonb_array_elements('[
    {"t":"Primera consulta","p":700,"d":60,"x":"Historia clínica, medidas y objetivos"},
    {"t":"Consulta de seguimiento","p":500,"d":40,"x":"Revisión de avances y ajustes"},
    {"t":"Plan de alimentación","p":600,"d":30,"x":"Menú personalizado por escrito"},
    {"t":"Consulta deportiva","p":850,"d":60,"x":"Plan para rendimiento y composición corporal"},
    {"t":"Consulta en línea","p":450,"d":40,"x":"Por videollamada, desde donde estés"},
    {"t":"Composición corporal","p":350,"d":20,"x":"Medición de grasa y músculo"}
  ]'::jsonb) with ordinality as e(x, n);

  insert into public.admins (business_id, email)
  select v_id, lower(trim(v_admin))
  where not exists (select 1 from public.admins where business_id = v_id and email = lower(trim(v_admin)));

  -- ---------------------------------------------------------------- Pole Essence (estudio)
  select id into v_id from public.businesses where slug = 'demo-pole';
  if v_id is null then
    v_id := public.create_business('demo-pole', 'Pole Essence', 'estudio', '5617527272', v_admin, 'Calle Ejemplo 12, Huixquilucan, Estado de México');
  end if;

  update public.businesses set
    name = 'Pole Essence',
    category = 'estudio',
    tagline = 'Pole dance y fitness para descubrir tu fuerza. Clases grupales, semi personalizadas y privadas.',
    instagram_url = 'https://www.instagram.com/',
    facebook_url = 'https://www.facebook.com/',
    tiktok_url = 'https://www.tiktok.com/',
    perks = array['Máximo 6 alumnas', 'Cada alumna con su tubo', 'Sin experiencia previa'],
    promotions = '[{"id":"paquete-semi","title":"Paquete de 4 semi personalizadas","description":"Cuatro clases para 2 alumnas, con atención casi privada","days":"Favorito de las alumnas","normalPrice":480,"promoPrice":450}]'::jsonb,
    theme = '', brand_color = '', logo_url = 'demos/pole-essence.webp'
  where id = v_id;

  -- Clases con cupo y deslinde: "capacity" son los lugares por horario (cada local puede tener el suyo)
  update public.settings set
    work_start = '09:00', work_end = '21:00', break_start = '14:00', break_end = '17:00',
    off_days = '{0}', slot_interval = 60,
    capacity = 1, waiver_enabled = true, waiver_text = ''
  where business_id = v_id;

  -- Dos locales de ejemplo. Sá Sicarú: clases grupales de 6 lugares, con el horario general.
  -- Frecuencia 528: 2 lugares, con su propio horario (10 a 20 h, sin descanso, cierra sábado y domingo).
  insert into public.locations (business_id, name, sort_order)
  select v_id, n, o from (values ('Sá Sicarú', 1), ('Frecuencia 528', 2)) as t(n, o)
  where not exists (select 1 from public.locations where business_id = v_id and name = t.n);

  update public.locations set
    address = 'Calle Ejemplo 12, Huixquilucan, Estado de México', maps_url = '', capacity = 6,
    work_start = null, work_end = null, break_start = null, break_end = null, off_days = null, slot_interval = null,
    sort_order = 1, active = true
  where business_id = v_id and name = 'Sá Sicarú';

  update public.locations set
    address = 'Calle Ejemplo 48, Interlomas, Estado de México', maps_url = '', capacity = 2,
    work_start = '10:00', work_end = '20:00', break_start = null, break_end = null, off_days = '{0,6}', slot_interval = null,
    sort_order = 2, active = true
  where business_id = v_id and name = 'Frecuencia 528';

  delete from public.services where business_id = v_id;
  insert into public.services (business_id, title, price, duration_minutes, description, sort_order)
  select v_id, e.x ->> 't', (e.x ->> 'p')::integer, (e.x ->> 'd')::integer, e.x ->> 'x', e.n::integer
  from jsonb_array_elements('[
    {"t":"Pole Básico","p":120,"d":60,"x":"Tu primer encuentro con el tubo, sin experiencia previa"},
    {"t":"Pole Intermedio","p":120,"d":60,"x":"Fluidez, fuerza y primeras inversiones"},
    {"t":"Pole Avanzado","p":120,"d":60,"x":"Figuras aéreas y transiciones de alto nivel"},
    {"t":"Pole Exotic","p":120,"d":60,"x":"Sensualidad, floorwork y tacones"},
    {"t":"Semi personalizada","p":120,"d":60,"x":"2 alumnas, cada quien con su tubo"},
    {"t":"Clase privada 1 a 1","p":200,"d":60,"x":"Plan a tu medida y atención exclusiva"}
  ]'::jsonb) with ordinality as e(x, n);

  -- Cada clase se ofrece solo en su local
  update public.services s set location_id = l.id
  from public.locations l
  where s.business_id = v_id and l.business_id = v_id
    and ((l.name = 'Sá Sicarú' and s.title in ('Pole Básico', 'Pole Intermedio', 'Pole Avanzado', 'Pole Exotic'))
      or (l.name = 'Frecuencia 528' and s.title in ('Semi personalizada', 'Clase privada 1 a 1')));

  insert into public.admins (business_id, email)
  select v_id, lower(trim(v_admin))
  where not exists (select 1 from public.admins where business_id = v_id and email = lower(trim(v_admin)));
end;
$$;
