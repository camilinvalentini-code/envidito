-- Registro manual de pagos de membresía por organizador (transferencia,
-- se coordina aparte — esto solo lleva el control de "ya pagó este mes").
-- Ejecutar una sola vez en el SQL Editor de Supabase. No borra ni cambia
-- ningún dato existente, solo agrega la tabla nueva y sus permisos.

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  organizador_id uuid references profiles(id) not null,
  paid_at date not null default current_date,
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists payments_organizador_idx on payments (organizador_id, paid_at);

alter table payments enable row level security;

drop policy if exists "admin ve pagos" on payments;
drop policy if exists "admin registra pagos" on payments;
drop policy if exists "admin borra pagos" on payments;

-- Reusa public.is_admin() (definida en supabase-schema-v2-roles.sql) para
-- mantener el mismo criterio que el resto del schema: solo admin aprobado.
create policy "admin ve pagos" on payments for select
  using (public.is_admin());
create policy "admin registra pagos" on payments for insert
  with check (public.is_admin());
create policy "admin borra pagos" on payments for delete
  using (public.is_admin());
