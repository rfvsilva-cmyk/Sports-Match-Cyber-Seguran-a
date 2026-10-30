create table if not exists public.notificacao (
  id text primary key default (gen_random_uuid())::text,
  jogador_id text not null references public.jogador(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  corpo text not null,
  dados jsonb not null default '{}'::jsonb,
  lida_em timestamp(3) without time zone,
  data_criacao timestamp(3) without time zone not null default current_timestamp
);

create index if not exists notificacao_jogador_leitura_data_idx
  on public.notificacao (jogador_id, lida_em, data_criacao desc);

alter table public.notificacao disable row level security;
