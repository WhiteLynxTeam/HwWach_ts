import { Module, ValidationPipe, Logger } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { getConfig } from './config/configuration';

const config = getConfig();
const logger = new Logger('Database');
logger.log(
  `Database connection settings: host=${config.db.host}, port=${config.db.port}, username=${config.db.username}, database=${config.db.database}, ssl=${config.db.ssl}`,
);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: config.db.host,
      port: config.db.port,
      username: config.db.username,
      password: config.db.password,
      database: config.db.database,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
      synchronize: false,
      migrationsRun: true,
      extra: config.db.ssl ? { sslmode: 'require' } : {},
    }),
    AuthModule,
    UsersModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {
  constructor() {
    console.log('🚀 AppModule initialized');
  }
}
