# Libro de Préstamos (PWA)

App de control de préstamos, hipotecas, pignoraciones y arriendos.
React + Vite. Datos en el navegador (localStorage) + respaldo a archivo.
Instalable en el celular (Agregar a pantalla de inicio) y funciona offline.

## Probar local
```
npm install
npm run dev
```

## Publicar en Vercel
1. Sube esta carpeta a un repositorio nuevo de GitHub.
2. Vercel → Add New Project → importa el repo → Deploy.

## Instalar como app (usuario)
Abre el link en Chrome (Android): menú ⋮ → "Agregar a pantalla de inicio".
En iPhone (Safari): Compartir → "Agregar a inicio".

## Convertir en APK real (más adelante, con Capacitor)
```
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Libro de Préstamos" com.tunegocio.libroprestamos
npm run build && npx cap add android && npx cap sync && npx cap open android
```
