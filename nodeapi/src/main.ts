import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet'; // Security middleware
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { // Create the NestJS application
    bufferLogs: true,
  });

  const config = app.get(ConfigService); // Get the ConfigService instance
  const port = config.getOrThrow<number>('app.port'); // Get the port from the configuration
  const apiPrefix = config.getOrThrow<string>('app.apiPrefix'); // Get the API prefix from the configuration
  const frontendUrl = config.getOrThrow<string>('app.frontendUrl'); // Get the frontend URL from the configuration    // Allow requests from the frontend and local development server  

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: false, // Swagger UI needs inline scripts
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS — frontend and socket clients
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000'],
    credentials: true,
  });

  app.setGlobalPrefix(apiPrefix);

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Accounting API')
    .setDescription(
      'Accounting system. Includes authentication, accounts, journal transactions, and journal lines.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter your JWT access token',
      in: 'header',
    })
    .addTag('Auth', 'User registration, login, and email verification')
    .addTag('Accounts', 'Account CRUD')
    .addTag('Journal Transactions', 'Journal transaction CRUD')
    .addTag('Journal Lines', 'Journal line CRUD')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  const url = await app.getUrl(); // Get the URL of the running application
  console.log(`Accounting API running at: ${url}/${apiPrefix}`);
  console.log(`Swagger docs at: ${url}/${apiPrefix}/docs`); // Print the Swagger docs URL
}

bootstrap();
