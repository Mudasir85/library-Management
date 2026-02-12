import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '@/prisma/prisma.module';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      dest: './uploads/photos',
    }),
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
