import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { JogadorModule } from './jogador/jogador.module';
import { DescobertaModule } from './descoberta/descoberta.module';
import { ChatModule } from './chat/chat.module';
import { AvaliacaoModule } from './avaliacao/avaliacao.module';
import { PartidasModule } from './partidas/partidas.module';
import { AppController } from './app.controller';
import { ModalidadesModule } from './modalidades/modalidades.module';
import { NotificacaoModule } from './notificacao/notificacao.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SupabaseModule,
    AuthModule,
    JogadorModule,
    DescobertaModule,
    ChatModule,
    AvaliacaoModule,
    PartidasModule,
    ModalidadesModule,
    NotificacaoModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
