import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { AuthService } from '../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/users/entities/user.entity';

// Моки для сервисов
const mockUsersService = {
  registerUser: jest.fn(),
  findByLogin: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
};

const mockAuthService = {
  login: jest.fn(),
  refresh: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  decode: jest.fn(),
};

const mockUserRepository = {
  findOne: jest.fn(),
};

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(UsersService)
    .useValue(mockUsersService)
    .overrideProvider(AuthService)
    .useValue(mockAuthService)
    .overrideProvider(JwtService)
    .useValue(mockJwtService)
    .overrideProvider(getRepositoryToken(User))
    .useValue(mockUserRepository)
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/auth/register (POST) - should register a new user', async () => {
    const registerData = {
      login: 'testuser',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      phone: '+375291234567',
      position: 'Developer',
    };

    const mockPendingRegistration = {
      id: '1',
      login: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      phone: '+375291234567',
      position: 'Developer',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUsersService.registerUser.mockResolvedValue(mockPendingRegistration);

    return request(app.getHttpServer())
      .post('/auth/register')
      .send(registerData)
      .expect(201)
      .then(response => {
        expect(response.body).toEqual(mockPendingRegistration);
      });
  });

  it('/auth/login (POST) - should login user', async () => {
    const loginData = {
      login: 'testuser',
      password: 'password123',
    };

    const mockUser = {
      id: '1',
      login: 'testuser',
      password: 'hashedpassword',
      firstName: 'Test',
      lastName: 'User',
      phone: '+375291234567',
      position: 'Developer',
      role: 'USER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockTokens = {
      access_token: 'access_token_mock',
      refresh_token: 'refresh_token_mock',
    };

    mockUsersService.findByLogin.mockResolvedValue(mockUser);
    mockAuthService.login.mockResolvedValue(mockTokens);

    return request(app.getHttpServer())
      .post('/auth/login')
      .send(loginData)
      .expect(200)
      .then(response => {
        expect(response.body).toEqual(mockTokens);
      });
  });
});

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(UsersService)
    .useValue(mockUsersService)
    .overrideProvider(JwtService)
    .useValue(mockJwtService)
    .overrideProvider(getRepositoryToken(User))
    .useValue(mockUserRepository)
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Подготовим токен для авторизации
    authToken = 'valid_jwt_token';
    mockJwtService.decode.mockReturnValue({
      sub: '1',
      login: 'admin',
      role: 'ADMIN',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('/users (GET) - should return users list', async () => {
    const mockUsers = [
      {
        id: '1',
        login: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        phone: '+375291234567',
        position: 'Developer',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockUsersService.findAll.mockResolvedValue(mockUsers);

    return request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .then(response => {
        expect(response.body).toEqual(mockUsers);
      });
  });

  it('/users/:id (GET) - should return a user', async () => {
    const mockUser = {
      id: '1',
      login: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      phone: '+375291234567',
      position: 'Developer',
      role: 'USER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUsersService.findOne.mockResolvedValue(mockUser);

    return request(app.getHttpServer())
      .get('/users/1')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .then(response => {
        expect(response.body).toEqual(mockUser);
      });
  });
});