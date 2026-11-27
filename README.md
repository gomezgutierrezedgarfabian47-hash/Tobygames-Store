# Tobygames — Supabase + Almacenamiento en la Nube (v6)

## Pasos rápidos para conectar Supabase
1. Crea un proyecto en Supabase y abre **SQL Editor**.
2. Pega y ejecuta el contenido de `supabase_schema.sql` (crea `tg_profiles`, `tg_games`, políticas RLS y el bucket público `tobygames-assets`).
3. Ve a **Project Settings -> API** en Supabase, copia tu **Project URL** y tu **anon public key**, y pégalos en `SUPABASE_URL` y `SUPABASE_ANON_KEY` al inicio de `app.js`.
4. Sube la carpeta `tobygames` a Vercel, Netlify o GitHub Pages para que cargue en PC y celular desde cualquier red.
