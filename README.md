# StyleFlow Barbería 💈

Sistema de citas en línea para barbería, en español (México) y con precios en pesos (MXN). Hecho con React, TypeScript y Vite. No necesita servidor ni base de datos.

> Versión de demostración: los datos se guardan en el navegador de cada persona (LocalStorage) y no se envían a ningún servidor.

## ✨ Qué incluye

- **Reserva en 3 pasos:** elegir servicios → elegir fecha y hora → confirmar
- **Confirmación por WhatsApp:** botón que abre WhatsApp con la cita ya escrita
- **Mis reservas:** el cliente escribe su celular, ve sus próximas citas y puede cancelarlas (con botón para avisar a la barbería por WhatsApp). Con Supabase usa las funciones de la sección 8 de `supabase/schema.sql`; no muestra nombres ni teléfonos
- **Panel de administración:** citas, servicios, horarios y días de descanso
- **Avisos por Telegram al barbero (opcional):** llega un mensaje con cada cita nueva y cada cancelación del cliente, aunque el panel esté cerrado. Es gratis; los pasos para activarlo están en la sección 9 de `supabase/schema.sql`. El token del bot se guarda en Supabase Vault, nunca en el código
- **Límite de citas por celular:** por defecto 3 citas próximas por número, para que nadie bloquee la agenda. Se cambia en el panel, en Configuración → Citas por cliente. (Si ya tenías la base creada, vuelve a ejecutar `supabase/schema.sql`: es seguro repetirlo.)
- **Exportar a Excel e imprimir** la agenda del día o de todas las citas
- **Diseño oscuro** que funciona bien en celular y en computadora

## ⚙️ Cómo personalizarlo

Todo lo importante está en [`constants.ts`](./constants.ts):

| Qué cambiar | Dónde |
|-------------|-------|
| Nombre de la barbería, dirección y teléfono | `SHOP_INFO` |
| Número de WhatsApp (lada + 10 dígitos, sin espacios) | `SHOP_INFO.whatsappNumber` |
| Usuario y contraseña del panel | `ADMIN_CREDENTIALS` |
| Servicios y precios iniciales | `INITIAL_SERVICES` |
| Horario y días de descanso iniciales | `DEFAULT_SETTINGS` |

Usuario inicial del panel: `admin`. Cambia la contraseña antes de compartir la app.

> ⚠️ En **modo demo** (sin base de datos) cada celular guarda sus propias citas y la contraseña del panel es solo una barrera básica. Para un negocio real activa la base de datos en línea (siguiente sección).

## 🗄️ Base de datos en línea (Supabase, gratis)

Con la base de datos activada, **todas las citas se guardan en un solo lugar**: el dueño las ve desde cualquier celular y los clientes solo ven qué horarios están ocupados (nunca nombres ni teléfonos de otras personas).

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. En **SQL Editor** pega y ejecuta el contenido de [`supabase/schema.sql`](./supabase/schema.sql). Crea las tablas, las reglas de seguridad y los servicios de ejemplo.
3. En **Authentication → Users** crea el usuario del dueño (correo y contraseña) y luego ejecuta en el SQL Editor:
   `insert into public.admins (email) values ('correo-del-dueno@ejemplo.com');`
4. En **Project Settings → API** copia la **URL** y la llave **anon / publishable** y pégalas en `SUPABASE_CONFIG`, dentro de `constants.ts`. Esa llave es pública y es seguro publicarla: la protegen las reglas del paso 2.

Con la base de datos activa, el panel de administración entra con **correo y contraseña** y tiene una pestaña **Resumen** con las citas de hoy, los ingresos del mes, el ticket promedio y gráficas. Si `SUPABASE_CONFIG` queda vacío, la app vuelve al modo demo.

## 🚀 Publicarla con GitHub Pages

1. En tu repositorio ve a **Settings → Pages** y en **Source** elige **GitHub Actions**.
2. Cada vez que se guarden cambios en la rama `main`, la app se publica sola en `https://TU-USUARIO.github.io/StyleFlow-Barbershop/`.

## 🌐 Publicarla con tu propio dominio (Cloudflare Pages)

1. En [Cloudflare](https://dash.cloudflare.com) entra a **Workers & Pages → Create → Pages → Connect to Git** y elige este repositorio.
2. Comando de construcción: `npm run build`. Carpeta de salida: `dist`.
3. No hace falta definir `VITE_BASE`: sin ella la página se construye para vivir en la raíz (`/`), que es lo que necesita un dominio propio.
4. En el proyecto, pestaña **Custom domains**, agrega tu dominio.

El despliegue de GitHub Pages sigue funcionando al mismo tiempo, porque su flujo define `VITE_BASE=/StyleFlow-Barbershop/`.

## ⏰ Aviso diario para que Supabase no se pause

En el plan gratis, Supabase pausa el proyecto si pasa una semana con muy poca actividad. El flujo [`.github/workflows/mantener-activo.yml`](./.github/workflows/mantener-activo.yml) hace una consulta a la base una vez al día y falla (y GitHub te avisa por correo) si la base no responde. GitHub desactiva los flujos programados de los repositorios públicos que pasan 60 días sin actividad; si eso pasa, actívalo de nuevo en la pestaña **Actions**.

## 💻 Correrla en tu computadora

```bash
npm install
npm run dev
```

## 🧰 Tecnologías

React 18, TypeScript, Vite 5, Tailwind CSS (CDN), React Router (HashRouter), Motion, Lucide React y xlsx.

## 📄 Licencia y créditos

Basado en [StyleFlow Barbershop](https://github.com/erpycode/StyleFlow-Barbershop) de **ErPyCode**, bajo la [licencia MIT](./LICENSE). Esta versión está traducida al español de México y adaptada con precios en pesos y confirmación por WhatsApp.
