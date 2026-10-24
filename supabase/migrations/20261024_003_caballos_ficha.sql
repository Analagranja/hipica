-- Campos adicionales de la ficha del caballo
alter table public.caballos
  add column raza text,
  add column pelaje text,
  add column sexo text
    check (sexo in ('yegua','padrillo','castrado')),
  add column numero_registro text,
  add column observaciones text,
  add column foto_path text;

-- Bucket privado para las fotos (máx. 2 MB, solo imágenes)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('caballos', 'caballos', false, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Las fotos se guardan como {club_id}/{caballo_id}.jpg
-- Ven las fotos los miembros del club; suben, cambian y borran solo los administradores
create policy caballos_fotos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'caballos'
    and public.es_miembro_del_club(((storage.foldername(name))[1])::uuid)
  );

create policy caballos_fotos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'caballos'
    and public.tiene_rol(((storage.foldername(name))[1])::uuid, 'administrador')
  );

create policy caballos_fotos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'caballos'
    and public.tiene_rol(((storage.foldername(name))[1])::uuid, 'administrador')
  )
  with check (
    bucket_id = 'caballos'
    and public.tiene_rol(((storage.foldername(name))[1])::uuid, 'administrador')
  );

create policy caballos_fotos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'caballos'
    and public.tiene_rol(((storage.foldername(name))[1])::uuid, 'administrador')
  );
