-- One-time, hashed password-reset tokens.
-- Raw tokens are sent only by e-mail; the database stores only SHA-256 hashes.
create table if not exists public.password_reset_token (
  id text not null default (gen_random_uuid())::text,
  usuario_id text not null references public.usuarios(id) on update cascade on delete cascade,
  token_hash text not null unique,
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone,
  data_criacao timestamp with time zone not null default current_timestamp,
  constraint password_reset_token_expiration_check check (expires_at > data_criacao)
);

create index if not exists password_reset_token_active_idx
  on public.password_reset_token (token_hash, expires_at)
  where used_at is null;

alter table public.password_reset_token disable row level security;
