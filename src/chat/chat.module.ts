import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AuthModule } from '../auth/auth.module';
import { RealtimeService } from './realtime.service';

@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  providers: [ChatService, RealtimeService],
  exports: [ChatService],
})
export class ChatModule {}
