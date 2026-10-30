-- A private game created from chat is a proposal until the other participant
-- confirms it. Existing public-game statuses remain unchanged.
alter type public."StatusPartida" add value if not exists 'PENDENTE' before 'AGENDADA';

alter table public.mensagem
  add column if not exists lida_em timestamp(3) without time zone;

create index if not exists mensagem_conversa_leitura_idx
  on public.mensagem (conversa_id, remetente_id, lida_em, criado_em desc);
