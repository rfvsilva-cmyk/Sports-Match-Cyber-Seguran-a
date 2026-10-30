const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('a migração protege vagas e avaliações no banco', () => {
  const migration = read('supabase/migrations/20260921180000_align_application_schema.sql');
  assert.match(migration, /create table if not exists public\.partida_participante/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /partida lotada/i);
  assert.match(migration, /partida_capacidade_valida/i);
});

test('o cliente nunca envia o registro inteiro ao atualizar o perfil', () => {
  const api = read('front-end/src/app/services/api.ts');
  assert.match(api, /serializeProfileUpdate/);
  assert.match(api, /profileUpdateFields/);
  assert.match(api, /updateProfile\(data: Partial<Profile>\)[\s\S]*JSON\.stringify\(serializeProfileUpdate\(data\)\)/);
});

test('PWA não usa ícones remotos nem faz cache da API', () => {
  const manifest = read('front-end/public/manifest.json');
  const worker = read('front-end/public/sw.js');
  assert.doesNotMatch(manifest, /https?:\/\//i);
  assert.match(worker, /pathname\.startsWith\('\/api\/'\)/);
  assert.match(worker, /sports-match-shell-v3/);
});

test('segredos de servidor não possuem fallback hardcoded', () => {
  const supabaseService = read('src/supabase/supabase.service.ts');
  const jwtStrategy = read('src/auth/jwt.strategy.ts');
  assert.match(supabaseService, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(supabaseService, /devem ser configurados/);
  assert.match(jwtStrategy, /getOrThrow<string>\('JWT_SECRET'\)/);
  assert.doesNotMatch(supabaseService, /eyJhbGciOi/);
});
