import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { MembersModule } from './members/members.module';
import { TransactionsModule } from './transactions/transactions.module';
import { FinesModule } from './fines/fines.module';
import { ReservationsModule } from './reservations/reservations.module';
import { SearchModule } from './search/search.module';
import { ReportsModule } from './reports/reports.module';
import { CategoriesModule } from './categories/categories.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('THROTTLE_TTL', 60000),
          limit: configService.get<number>('THROTTLE_LIMIT', 60),
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    BooksModule,
    MembersModule,
    TransactionsModule,
    FinesModule,
    ReservationsModule,
    SearchModule,
    ReportsModule,
    CategoriesModule,
    SettingsModule,
  ],
})
export class AppModule {}
