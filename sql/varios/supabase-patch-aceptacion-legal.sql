-- Guarda si el organizador aceptó Términos y Condiciones / Política de
-- Privacidad al crear su cuenta (checkboxes obligatorios en /organizador/acceso).
-- Ejecutar una sola vez en el SQL Editor de Supabase. No borra ni cambia
-- ningún dato existente, solo agrega columnas nuevas y actualiza el
-- trigger que ya crea el perfil al registrarse.

alter table profiles add column if not exists accepted_terms boolean not null default false;
alter table profiles add column if not exists accepted_privacy boolean not null default false;
alter table profiles add column if not exists accepted_at timestamptz;
alter table profiles add column if not exists terms_version text;
alter table profiles add column if not exists privacy_version text;

-- Mismo trigger de siempre (se crea el perfil solo, apenas alguien pide el
-- código por primera vez), ahora también copia la aceptación legal que
-- viaja en los metadatos del signInWithOtp.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email, nombre, accepted_terms, accepted_privacy, accepted_at, terms_version, privacy_version)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce((new.raw_user_meta_data->>'acceptedTerms')::boolean, false),
    coalesce((new.raw_user_meta_data->>'acceptedPrivacy')::boolean, false),
    nullif(new.raw_user_meta_data->>'acceptedAt', '')::timestamptz,
    new.raw_user_meta_data->>'termsVersion',
    new.raw_user_meta_data->>'privacyVersion'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
