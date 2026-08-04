-- Método de pago por equipo: además de si pagó o no, ahora se guarda
-- CÓMO pagó (efectivo o transferencia). null = todavía debe.

alter table teams add column if not exists metodo_pago text check (metodo_pago in ('efectivo', 'transferencia'));
