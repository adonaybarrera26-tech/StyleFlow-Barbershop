# StyleFlow Barbería 💈

Sistema de citas en línea para barbería, en español (México) y con precios en pesos (MXN). Hecho con React, TypeScript y Vite. No necesita servidor ni base de datos.

> Versión de demostración: los datos se guardan en el navegador de cada persona (LocalStorage) y no se envían a ningún servidor.

## ✨ Qué incluye

- **Reserva en 3 pasos:** elegir servicios → elegir fecha y hora → confirmar
- **Confirmación por WhatsApp:** botón que abre WhatsApp con la cita ya escrita
- **Panel de administración:** citas, servicios, horarios y días de descanso
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

> ⚠️ Al ser una app sin servidor, la contraseña del panel es solo una barrera básica para demostraciones. Para un negocio real hace falta una base de datos y un acceso seguro.

## 🚀 Publicarla con GitHub Pages

1. En tu repositorio ve a **Settings → Pages** y en **Source** elige **GitHub Actions**.
2. Cada vez que se guarden cambios en la rama `main`, la app se publica sola en `https://TU-USUARIO.github.io/StyleFlow-Barbershop/`.

## 💻 Correrla en tu computadora

```bash
npm install
npm run dev
```

## 🧰 Tecnologías

React 18, TypeScript, Vite 5, Tailwind CSS (CDN), React Router (HashRouter), Motion, Lucide React y xlsx.

## 📄 Licencia y créditos

Basado en [StyleFlow Barbershop](https://github.com/erpycode/StyleFlow-Barbershop) de **ErPyCode**, bajo la [licencia MIT](./LICENSE). Esta versión está traducida al español de México y adaptada con precios en pesos y confirmación por WhatsApp.
