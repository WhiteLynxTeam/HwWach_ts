import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { PendingChanges } from './users/entities/pending-changes.entity';
import { PendingRegistration } from './users/entities/pending-registration.entity';
import { User } from './users/entities/user.entity';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Equipment Tracking API')
    .setDescription('API for tracking computer equipment in an organization')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

const document = SwaggerModule.createDocument(app, config, {
  extraModels: [PendingChanges, PendingRegistration, User], // Явно указываем все сущности
});
SwaggerModule.setup('api', app, document);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3033);
}
bootstrap();
