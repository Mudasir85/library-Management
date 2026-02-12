import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { FinesController } from './fines.controller';
import { FinesService } from './fines.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinesController],
  providers: [FinesService],
  exports: [FinesService],
})
export class FinesModule {}
