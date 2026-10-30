-- Snapshot of the remote Supabase public schema on 2026-09-21.
-- Generated from the linked project's metadata, without data.
-- Extension-owned objects (for example, PostGIS) are not recreated here.

create extension if not exists pgcrypto with schema extensions;

create type public."StatusPartida" as enum (
  'AGENDADA',
  'CONCLUIDA',
  'CANCELADA'
);

create type public."TipoSwipe" as enum (
  'LIKE',
  'DISLIKE'
);

create table public.usuarios (
  id text not null default (gen_random_uuid())::text,
  email text not null,
  senha text not null,
  data_criacao timestamp(3) without time zone not null default current_timestamp,
  ultimo_login timestamp(3) without time zone not null default current_timestamp,
  constraint usuarios_pkey primary key (id),
  constraint usuarios_email_key unique (email)
);

create table public.jogador (
  id text not null default (gen_random_uuid())::text,
  usuario_id text not null,
  nome text not null,
  foto_url text,
  bio text,
  data_nascimento timestamp(3) without time zone,
  genero text,
  latitude double precision,
  longitude double precision,
  endereco text,
  esporte_individual text,
  nivel_individual text,
  esporte_coletivo text,
  nivel_coletivo text,
  esporte_outro text,
  nivel_outro text,
  perfil_completo boolean not null default false,
  media_avaliacao double precision not null default 0.0,
  total_avaliacoes integer not null default 0,
  data_atualizacao timestamp(3) without time zone not null default current_timestamp,
  constraint jogador_pkey primary key (id),
  constraint jogador_usuario_id_key unique (usuario_id),
  constraint jogador_usuario_id_fkey foreign key (usuario_id)
    references public.usuarios(id) on update cascade on delete cascade
);

create table public."like" (
  id text not null,
  id_origem text not null,
  id_destino text not null,
  tipo public."TipoSwipe" not null default 'LIKE'::public."TipoSwipe",
  data_criacao timestamp(3) without time zone not null default current_timestamp,
  constraint like_pkey primary key (id),
  constraint like_id_origem_id_destino_key unique (id_origem, id_destino),
  constraint like_id_origem_fkey foreign key (id_origem)
    references public.jogador(id) on update cascade on delete cascade,
  constraint like_id_destino_fkey foreign key (id_destino)
    references public.jogador(id) on update cascade on delete cascade
);

create table public.match (
  id text not null,
  id_jogador1 text not null,
  id_jogador2 text not null,
  data_criacao timestamp(3) without time zone not null default current_timestamp,
  constraint match_pkey primary key (id),
  constraint match_id_jogador1_id_jogador2_key unique (id_jogador1, id_jogador2),
  constraint match_id_jogador1_fkey foreign key (id_jogador1)
    references public.jogador(id) on update cascade on delete cascade,
  constraint match_id_jogador2_fkey foreign key (id_jogador2)
    references public.jogador(id) on update cascade on delete cascade
);

create table public.conversa (
  id text not null,
  match_id text not null,
  data_criacao timestamp(3) without time zone not null default current_timestamp,
  constraint conversa_pkey primary key (id),
  constraint conversa_match_id_key unique (match_id),
  constraint conversa_match_id_fkey foreign key (match_id)
    references public.match(id) on update cascade on delete cascade
);

create table public.mensagem (
  id text not null,
  conversa_id text not null,
  remetente_id text not null,
  conteudo text not null,
  criado_em timestamp(3) without time zone not null default current_timestamp,
  constraint mensagem_pkey primary key (id),
  constraint mensagem_conversa_id_fkey foreign key (conversa_id)
    references public.conversa(id) on update cascade on delete cascade,
  constraint mensagem_remetente_id_fkey foreign key (remetente_id)
    references public.jogador(id) on update cascade on delete cascade
);

create table public.partida (
  id text not null,
  conversa_id text not null,
  criador_id text not null,
  oponente_id text not null,
  modalidade text not null,
  local_nome text not null,
  latitude double precision,
  longitude double precision,
  data_hora timestamp(3) without time zone not null,
  status public."StatusPartida" not null default 'AGENDADA'::public."StatusPartida",
  data_criacao timestamp(3) without time zone not null default current_timestamp,
  data_atualizacao timestamp(3) without time zone not null,
  constraint partida_pkey primary key (id),
  constraint partida_conversa_id_fkey foreign key (conversa_id)
    references public.conversa(id) on update cascade on delete cascade,
  constraint partida_criador_id_fkey foreign key (criador_id)
    references public.jogador(id) on update cascade on delete cascade,
  constraint partida_oponente_id_fkey foreign key (oponente_id)
    references public.jogador(id) on update cascade on delete cascade
);

create table public.avaliacao (
  id text not null,
  partida_id text not null,
  avaliador_id text not null,
  avaliado_id text not null,
  nota integer not null,
  comentario text,
  data_criacao timestamp(3) without time zone not null default current_timestamp,
  constraint avaliacao_pkey primary key (id),
  constraint avaliacao_partida_id_avaliador_id_avaliado_id_key
    unique (partida_id, avaliador_id, avaliado_id),
  constraint avaliacao_partida_id_fkey foreign key (partida_id)
    references public.partida(id) on update cascade on delete cascade,
  constraint avaliacao_avaliador_id_fkey foreign key (avaliador_id)
    references public.jogador(id) on update cascade on delete cascade,
  constraint avaliacao_avaliado_id_fkey foreign key (avaliado_id)
    references public.jogador(id) on update cascade on delete cascade
);
