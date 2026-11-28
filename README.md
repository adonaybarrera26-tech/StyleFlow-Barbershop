# StyleFlow Citas 📅

Web app de citas en línea para negocios de servicios: barberías, spas, estéticas, dentistas, nutriólogos, consultorios y cualquier negocio que atienda con cita. En español (México) y con precios en pesos (MXN). Hecha con React, TypeScript y Vite.

La barbería que viene de ejemplo (`demo-barberia`) es solo la demo: el mismo código sirve para cualquier giro. Cada negocio tiene su propia dirección (`.../nombre-del-negocio`), sus servicios, su horario y su administrador, todo en **una sola base de datos**.

> Sin base de datos (modo demo) solo existe el negocio de ejemplo y los datos se guardan en el navegador de cada persona (LocalStorage).

## ✨ Qué incluye

- **Reserva en 3 pasos:** elegir servicios → elegir fecha y hora → confirmar
- **Varios negocios en una sola app:** cada uno en su dirección (`/<nombre-del-negocio>`), con su nombre, giro, WhatsApp, dirección, redes, etiquetas y promociones, y sin ver los datos de los demás
- **Giros listos:** barbería, spa, estética, dentista, nutriólogo, médico y "otro". Cada giro trae su propio look (colores, letra, formas y una ilustración en la portada), sus frases de la cinta superior y servicios de ejemplo al darlo de alta
- **Confirmación por WhatsApp:** botón que abre WhatsApp con la cita ya escrita
- **Mis reservas:** el cliente escribe su celular, ve sus próximas citas y puede cancelarlas (con botón para avisar al negocio por WhatsApp). Con Supabase no muestra nombres ni teléfonos de otras personas
- **Panel de administración por negocio:** citas, servicios, horarios y días de descanso. Cada administrador solo entra al panel de su negocio
- **Avisos por Telegram (opcional):** llega un mensaje con el nombre del negocio por cada cita nueva y cada cancelación del cliente. Es gratis; los pasos están en la sección 8 de `supabase/schema.sql`. El token del bot se guarda en Supabase Vault, nunca en el código
- **Límite de citas por celular:** por defecto 3 citas próximas por número, para que nadie bloquee la agenda. Se cambia en el panel, en Configuración → Citas por cliente
- **Exportar a Excel e imprimir** la agenda del día o de todas las citas
- **Portada con botones de acción:** llamar, cómo llegar, Instagram, Facebook y TikTok, más etiquetas de detalles y promociones (lo que el negocio no capture, no se muestra)
- **4 looks listos** que se asignan solos según el giro: *barbería* (oro y negro, cartel de disco), *spa* (ciruela y rosa cuarzo), *clínica* (porcelana y azul agua) y *natural* (avena y verde hoja). Cada negocio puede poner su logo y el color de su marca (ver abajo)
- **Funciona bien en celular y en computadora**

## 🏪 Dar de alta un negocio nuevo

Con la base de datos activa (siguiente sección), cada negocio nuevo toma un minuto:

1. En Supabase, **Authentication → Users**, crea el usuario del administrador (correo y contraseña).
2. En el **SQL Editor** ejecuta (cambia los datos):

   ```sql
   select public.create_business(
     'sereno-spa',            -- dirección: minúsculas, números y guiones
     'Sereno Spa',            -- nombre
     'spa',                   -- giro: barberia, spa, estetica, dentista, nutriologo, medico u otro
     '5215512345678',         -- WhatsApp: 52 + 10 dígitos
     'duena@ejemplo.com',     -- correo del administrador (el del paso 1)
     'Av. Jardines 45, Col. Roma, CDMX'
   );
   ```

   Crea el negocio, su horario inicial, unos servicios de ejemplo del giro y su administrador. Ya queda en `.../sereno-spa`.
3. El administrador entra a `.../sereno-spa/admin`, cambia sus servicios y precios, y ajusta el horario.
4. Para lo demás (teléfono visible, frase de portada, Instagram, Facebook, TikTok, mapa, etiquetas y promociones), abre **Table Editor → businesses** y llena las columnas del negocio.

### Look del negocio: tema, color de marca y logo

Se cambian en **Table Editor → businesses** (todas son opcionales):

| Columna | Qué hace | Ejemplo |
|---------|----------|---------|
| `theme` | Look completo. En blanco usa el de su giro (barbería→`barberia`, spa y estética→`spa`, dentista, médico y otro→`clinica`, nutriólogo→`natural`) | `natural` |
| `brand_color` | Color principal de su marca. La app calcula sola los tonos y cuida que el texto se lea bien | `#1A8F6B` |
| `logo_url` | Logo junto al nombre: un link `https://...` o un archivo de la carpeta `public/` | `demos/sereno-spa.svg` |

Los looks están en [`services/themes.ts`](./services/themes.ts) y las ilustraciones de portada en [`components/HeroArt.tsx`](./components/HeroArt.tsx).

### Demos para enseñar a clientes

[`supabase/demos.sql`](./supabase/demos.sql) crea tres negocios de ejemplo (spa, dentista y nutriólogo) con sus servicios, horarios, promoción y logo. Cambia el correo del inicio por el tuyo, pégalo en el SQL Editor y ejecútalo (se puede repetir). Quedan en `.../demo-spa`, `.../demo-dentista` y `.../demo-nutriologo`; la barbería de ejemplo es `.../demo-barberia`.

Las direcciones `admin`, `api`, `app` y `assets` están reservadas. Los negocios con `active = false` dejan de mostrarse.

> **Salud (dentistas, nutriólogos, médicos):** la app guarda solo nombre y celular de quien reserva. No captures datos médicos en la app. Pídele al negocio su aviso de privacidad y, si quiere, su cédula profesional para mostrarla en la portada.

## ⚙️ Personalizar el modo demo

Sin base de datos, el negocio de ejemplo y sus valores iniciales están en [`constants.ts`](./constants.ts):

| Qué cambiar | Dónde |
|-------------|-------|
| Nombre, giro, frase, dirección, teléfono, WhatsApp, redes, etiquetas y promociones del negocio de ejemplo | `DEMO_BUSINESS` |
| Quién ofrece el servicio (se ve al pie de "Acerca de"; en blanco se oculta) | `PLATFORM` |
| Usuario y contraseña del panel en modo demo | `ADMIN_CREDENTIALS` |
| Servicios y precios iniciales | `INITIAL_SERVICES` |
| Horario y días de descanso iniciales | `DEFAULT_SETTINGS` |
| Ícono, frases de la cinta, look e ilustración por giro (o un giro nuevo) | [`services/categories.ts`](./services/categories.ts) |
| Colores, letras y formas de cada look | [`services/themes.ts`](./services/themes.ts) |

> ⚠️ En **modo demo** cada celular guarda sus propias citas y la contraseña del panel es solo una barrera básica. Para un negocio real activa la base de datos en línea.

## 🗄️ Base de datos en línea (Supabase, gratis)

Con la base de datos activada, **todas las citas se guardan en un solo lugar**: el dueño las ve desde cualquier celular y los clientes solo ven qué horarios están ocupados (nunca nombres ni teléfonos de otras personas).

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. En **SQL Editor** pega y ejecuta el contenido de [`supabase/schema.sql`](./supabase/schema.sql). Crea las tablas, las reglas de seguridad y el negocio de ejemplo `demo-barberia`. Es seguro repetirlo: si ya tenías la versión de una sola barbería, la convierte a varios negocios sin perder datos.
3. Da de alta tus negocios como se explica arriba.
4. En **Project Settings → API** copia la **URL** y la llave **anon / publishable** y pégalas en `SUPABASE_CONFIG`, dentro de `constants.ts`. Esa llave es pública y es seguro publicarla: la protegen las reglas del paso 2.

Con la base de datos activa, el panel entra con **correo y contraseña** y tiene una pestaña **Resumen** con las citas de hoy, los ingresos del mes, el ticket promedio y gráficas. Si `SUPABASE_CONFIG` queda vacío, la app vuelve al modo demo.

**Seguridad:** las reglas de la base de datos (RLS) separan los negocios. Un administrador solo puede leer y cambiar lo de su negocio, y una cita solo puede reservar servicios del negocio al que pertenece.

### Cuando todos los celulares ya usan esta versión

La sección 10 de `schema.sql` deja unas funciones de compatibilidad (`is_admin()`, `get_taken_slots(date)`, `create_booking` de 5 datos, etc.) para que la página publicada antes del cambio siguiera funcionando. Cuando ya no haga falta, se pueden borrar junto con la columna `settings.id`.

## 🚀 Publicarla con GitHub Pages (la demo)

1. En tu repositorio ve a **Settings → Pages** y en **Source** elige **GitHub Actions**.
2. Cada vez que se guarden cambios en la rama `main`, la app se publica sola en `https://TU-USUARIO.github.io/StyleFlow-Barbershop/`.

El flujo define `VITE_ROUTER=hash` (GitHub Pages no sabe abrir direcciones como `/negocio/booking`, así que usa `#`) y `VITE_DEFAULT_BUSINESS=demo-barberia` (la dirección raíz abre la demo).

## 🌐 Publicarla con tu propio dominio (Cloudflare Pages)

1. En [Cloudflare](https://dash.cloudflare.com) entra a **Workers & Pages → Create → Pages → Connect to Git** y elige este repositorio.
2. Comando de construcción: `npm run build`. Carpeta de salida: `dist`.
3. No definas `VITE_BASE` ni `VITE_ROUTER`: así la página vive en la raíz (`/`) y usa direcciones limpias (`tudominio.com/nombre-del-negocio`). Cloudflare Pages abre `index.html` en las direcciones que no existen siempre que el proyecto no tenga un `404.html` en la raíz; no agregues uno.
4. Opcional: `VITE_DEFAULT_BUSINESS` con el nombre de un negocio para que la raíz lo abra. En blanco, la raíz muestra una portada general.
5. En el proyecto, pestaña **Custom domains**, agrega tu dominio.

## ⏰ Aviso diario para que Supabase no se pause

En el plan gratis, Supabase pausa el proyecto si pasa una semana con muy poca actividad. El flujo [`.github/workflows/mantener-activo.yml`](./.github/workflows/mantener-activo.yml) hace una consulta a la base una vez al día y falla (y GitHub te avisa por correo) si la base no responde. GitHub desactiva los flujos programados de los repositorios públicos que pasan 60 días sin actividad; si eso pasa, actívalo de nuevo en la pestaña **Actions**.

## 💻 Correrla en tu computadora

```bash
npm install
npm run dev
```

## 🧰 Tecnologías

React 18, TypeScript, Vite 5, Tailwind CSS (CDN), React Router, Motion, Lucide React y xlsx.

## 📄 Licencia y créditos

Basado en [StyleFlow Barbershop](https://github.com/erpycode/StyleFlow-Barbershop) de **ErPyCode**, bajo la [licencia MIT](./LICENSE). Esta versión está traducida al español de México, adaptada con precios en pesos y confirmación por WhatsApp, y generalizada para varios negocios y giros. Si no quieres mostrar el crédito de la plataforma al pie de "Acerca de", deja `PLATFORM.name` en blanco en `constants.ts`; el aviso de la licencia MIT debe conservarse.
