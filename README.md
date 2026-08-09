# StyleFlow Barbershop 💈

**English** | [نسخه فارسی](./README_fa.md)

A modern, bilingual (Persian/English) barbershop booking app built with React, TypeScript and Vite. Fully offline-first with no backend required.

> **🌐 Live:** https://erpycode.github.io/StyleFlow-Barbershop/

## ✨ Features

- **Bilingual + RTL** — one-click switch between Persian (RTL) and English (LTR)
- **Online Booking** — 3-step flow: choose services → pick date & time → confirm
- **Admin Panel** — manage services, bookings, and shop settings
- **Excel Export & Print** — download daily/all bookings as `.xlsx` or print a report
- **Offline-First Storage** — everything persists in the browser's LocalStorage, no database needed
- **Polished UI** — dark theme, Vazirmatn font, smooth Motion animations
- **Responsive** — works great on mobile and desktop

## 🧰 Tech Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18, TypeScript, Vite 5 |
| Styling  | Tailwind CSS (CDN) |
| Routing  | React Router (HashRouter) |
| Animation| Motion |
| Icons    | Lucide React |
| Export   | xlsx |
| Storage  | LocalStorage |

## 🔑 Admin Credentials

| Role  | Username | Password |
|-------|----------|----------|
| Admin | `admin`  | `admin`  |

> ⚠️ Note — data lives in the browser and is never sent to a server.

## 📁 Project Structure

```
├── pages/
│   ├── Home.tsx              # Landing page
│   ├── AboutProject.tsx      # About / credits
│   ├── user/                 # Booking flow + success receipt
│   └── admin/                # Admin login + dashboard
├── services/
│   ├── LanguageContext.tsx   # i18n (FA/EN)
│   └── dataService.ts        # LocalStorage data layer
├── components/Layout.tsx     # App shell + navigation
├── constants.ts              # Default services & settings
└── types.ts
```

## ✍️ Credit & Usage Terms

Designed and developed by **ErPyCode**.

You are free to use this project in your own projects, provided that:

1. You credit the original developer (**ErPyCode**) in your Credits section or README file
2. You do not remove the digital signatures present in the code or UI without permission
3. If significant changes are made, please still link back to the original source

---

Made with ❤️ by [ErPyCode](https://github.com/erpycode)