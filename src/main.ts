import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { getConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // IP клиента за прокси Render (8.7): доверяем ровно N прокси, а не true —
  // иначе клиент подделает свой адрес заголовком X-Forwarded-For
  app.set('trust proxy', getConfig().trustProxy);

  const config = new DocumentBuilder()
    .setTitle('Equipment Tracking API')
    .setDescription('API for tracking computer equipment in an organization')
    .setVersion('2.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3033);
}
bootstrap();
