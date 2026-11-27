-- ==================== TOBYGAMES — ESQUEMA SUPABASE (DB + STORAGE) ====================
-- Ejecuta este script completo en el SQL Editor de tu proyecto de Supabase.

-- 1. Tabla de perfiles / cuentas de usuarios
create table if not exists public.tg_profiles (
  id bigint primary key,
  name text not null,
  email text not null unique,
  password text not null,
  role text not null default 'user' check (role in ('admin', 'mod', 'user')),
  balance numeric(10, 2) not null default 0.00,
  spins integer not null default 1,
  library jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 2. Tabla de juegos y aplicaciones del catálogo
create table if not exists public.tg_games (
  id bigint primary key,
  title text not null,
  category text not null,
  price numeric(10, 2) not null default 1.00,
  description text not null,
  img_url text not null,
  file_name text,
  file_url text,
  created_at timestamptz not null default now()
);

-- 3. Cuenta inicial del Administrador Principal
insert into public.tg_profiles (id, name, email, password, role, balance, spins, library)
values (1, 'Tobygames', 'tobygames489@gmail.com', 'ikea123', 'admin', 99.00, 10, '[1]'::jsonb)
on conflict (id) do update
  set email = excluded.email,
      password = excluded.password,
      role = 'admin';

-- 4. Juegos iniciales del catálogo
insert into public.tg_games (id, title, category, price, description, img_url, file_name, file_url)
values
  (1, 'Neon Drift X', 'Acción', 1.00, 'Carreras cyberpunk a máxima velocidad con autos personalizables.', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80', null, null),
  (2, 'Pixel Dungeon Quest', 'Aventura', 1.00, 'Explora mazmorras generadas proceduralmente y derrota jefes épicos.', 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80', null, null),
  (3, 'Toby Boost Optimizer', 'Utilidades', 1.00, 'Herramienta ligera para optimizar FPS y liberar memoria RAM en PC.', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', null, null),
  (4, 'Shadow Hollow', 'Indie', 1.00, 'Aventura atmosférica de plataformas y acertijos en un bosque encantado.', 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80', null, null)
on conflict (id) do nothing;


-- 2b. Tabla de comentarios por juego o aplicación
create table if not exists public.tg_comments (
  id bigint primary key,
  game_id bigint not null references public.tg_games(id) on delete cascade,
  user_id bigint,
  user_name text not null,
  user_role text not null default 'user',
  comment text not null,
  created_at timestamptz not null default now()
);


-- 2c. Tabla de historial de movimientos (compras de saldo y compras de juegos)
create table if not exists public.tg_activity_logs (
  id bigint primary key,
  activity_type text not null check (activity_type in ('balance_topup', 'game_purchase')),
  user_id bigint,
  user_name text not null,
  user_email text,
  game_id bigint,
  game_title text,
  amount numeric(10, 2) not null default 0.00,
  balance_after numeric(10, 2) not null default 0.00,
  detail text,
  created_at timestamptz not null default now()
);

-- 2d. Tabla de códigos de verificación (registro Gmail y recuperación de contraseña)
create table if not exists public.tg_verification_codes (
  id bigint primary key,
  email text not null,
  purpose text not null check (purpose in ('register_gmail', 'password_reset')),
  code_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tg_verification_codes enable row level security;

drop policy if exists "tg_verification_codes_all_access" on public.tg_verification_codes;
create policy "tg_verification_codes_all_access"
  on public.tg_verification_codes
  for all
  using (true)
  with check (true);

-- 5. Habilitar Row Level Security (RLS) con políticas abiertas para el cliente anon
alter table public.tg_profiles enable row level security;
alter table public.tg_games enable row level security;
alter table public.tg_comments enable row level security;
alter table public.tg_activity_logs enable row level security;

drop policy if exists "tg_activity_logs_all_access" on public.tg_activity_logs;
create policy "tg_activity_logs_all_access"
  on public.tg_activity_logs
  for all
  using (true)
  with check (true);

drop policy if exists "tg_comments_all_access" on public.tg_comments;
create policy "tg_comments_all_access"
  on public.tg_comments
  for all
  using (true)
  with check (true);

drop policy if exists "tg_profiles_all_access" on public.tg_profiles;
create policy "tg_profiles_all_access"
  on public.tg_profiles
  for all
  using (true)
  with check (true);

drop policy if exists "tg_games_all_access" on public.tg_games;
create policy "tg_games_all_access"
  on public.tg_games
  for all
  using (true)
  with check (true);

-- 6. Crear bucket público 'tobygames-assets' para portadas y archivos de juegos
insert into storage.buckets (id, name, public)
values ('tobygames-assets', 'tobygames-assets', true)
on conflict (id) do update set public = true;

-- 7. Políticas de Storage para subir, leer y borrar archivos en 'tobygames-assets'
drop policy if exists "tg_storage_select" on storage.objects;
create policy "tg_storage_select"
  on storage.objects
  for select
  using (bucket_id = 'tobygames-assets');

drop policy if exists "tg_storage_insert" on storage.objects;
create policy "tg_storage_insert"
  on storage.objects
  for insert
  with check (bucket_id = 'tobygames-assets');

drop policy if exists "tg_storage_update" on storage.objects;
create policy "tg_storage_update"
  on storage.objects
  for update
  using (bucket_id = 'tobygames-assets')
  with check (bucket_id = 'tobygames-assets');

drop policy if exists "tg_storage_delete" on storage.objects;
create policy "tg_storage_delete"
  on storage.objects
  for delete
  using (bucket_id = 'tobygames-assets');
