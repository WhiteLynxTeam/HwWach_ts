import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestAppModule } from './TestAppModule';

// Прямо определяем конфигурацию для тестов
const testConfig = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'hwwach_test_db',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'test_secret_for_testing',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
};

describe('API Integration Tests (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test', '.env'], // Загружаем сначала .env.test, потом .env
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: testConfig.db.host,
          port: testConfig.db.port,
          username: testConfig.db.username,
          password: testConfig.db.password,
          database: testConfig.db.database,
          autoLoadEntities: true, // Автоматическая загрузка сущностей
          synchronize: true, // Только для тестов
          dropSchema: true, // Очищаем схему перед каждым запуском тестов
        }),
        TestAppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  }, 30000); // Увеличиваем таймаут для подключения к БД

  afterAll(async () => {
    await app.close();
  });

  it('should register a new user', async () => {
    const registerData = {
      login: 'testuser_e2e',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      phone: '+375291234567',
      position: 'Developer',
    };

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.login).toBe(registerData.login);
    expect(response.body.firstName).toBe(registerData.firstName);
    expect(response.body.lastName).toBe(registerData.lastName);
    expect(response.body.phone).toBe(registerData.phone);
    expect(response.body.position).toBe(registerData.position);
    expect(response.body.status).toBe('PENDING');
  });

  it('should login as admin', async () => {
    const adminLogin = process.env.DEFAULT_ADMIN_LOGIN || 'admin';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || '123!';

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        login: adminLogin,
        password: adminPassword,
      })
      .expect(200);

    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('refresh_token');

    adminToken = response.body.access_token;
  });

  it('should approve pending registration', async () => {
    // Получим нерассмотренные регистрации
    const pendingRegsResponse = await request(app.getHttpServer())
      .get('/users/registrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Найдем нашу регистрацию и одобрим её
    const testReg = pendingRegsResponse.body.find(reg => reg.login === 'testuser_e2e');

    if (testReg) {
      const approveResponse = await request(app.getHttpServer())
        .post(`/users/registrations/${testReg.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: 'Approved for testing' })
        .expect(200);

      expect(approveResponse.body).toHaveProperty('id');
      expect(approveResponse.body.status).toBe('APPROVED');
    }
  });

  it('should login as newly approved user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        login: 'testuser_e2e',
        password: 'password123',
      })
      .expect(200);

    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('refresh_token');
  });

  it('should create a new user (admin only)', async () => {
    const userData = {
      login: 'newuser_e2e',
      password: 'newpassword123',
      firstName: 'New',
      lastName: 'User',
      phone: '+375297654321',
      position: 'Manager',
      role: 'USER',
    };

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(userData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.login).toBe(userData.login);
    expect(response.body.firstName).toBe(userData.firstName);
    expect(response.body.lastName).toBe(userData.lastName);
    expect(response.body.phone).toBe(userData.phone);
    expect(response.body.position).toBe(userData.position);
    expect(response.body.role).toBe(userData.role);
    expect(response.body.isActive).toBe(true);

    testUserId = response.body.id;
  });

  it('should get a user by ID', async () => {
    const response = await request(app.getHttpServer())
      .get(`/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body.id).toBe(testUserId);
  });

  it('should update a user', async () => {
    const updateData = {
      firstName: 'Updated',
      position: 'Senior Manager',
    };

    const response = await request(app.getHttpServer())
      .put(`/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body.firstName).toBe(updateData.firstName);
    expect(response.body.position).toBe(updateData.position);
  });

  it('should create and approve a change request', async () => {
    // Сначала залогинимся как обычный пользователь
    const userLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        login: 'testuser_e2e',
        password: 'password123',
      })
      .expect(200);

    const userTokenForChange = userLoginResponse.body.access_token;

    // Создаем запрос на изменение
    const changeData = {
      firstName: 'ChangedFirstName',
      position: 'Lead Developer',
    };

    const createChangeResponse = await request(app.getHttpServer())
      .post('/user-change-requests/request')
      .set('Authorization', `Bearer ${userTokenForChange}`)
      .send(changeData)
      .expect(201);

    expect(createChangeResponse.body).toHaveProperty('id');
    expect(createChangeResponse.body.requestedByUserId).toBeDefined();
    expect(createChangeResponse.body.firstName).toBe(changeData.firstName);
    expect(createChangeResponse.body.position).toBe(changeData.position);
    expect(createChangeResponse.body.status).toBe('PENDING');

    // Теперь админ должен одобрить запрос
    const getAllChangesResponse = await request(app.getHttpServer())
      .get('/user-change-requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const changeRequest = getAllChangesResponse.body.find(req =>
      req.requestedBy.login === 'testuser_e2e' && req.status === 'PENDING'
    );

    if (changeRequest) {
      const approveChangeResponse = await request(app.getHttpServer())
        .patch(`/user-change-requests/${changeRequest.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: 'Approved for testing' })
        .expect(200);

      expect(approveChangeResponse.body.status).toBe('APPROVED');
    }
  });

  it('should deactivate a user', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.message).toBe('User deactivated successfully');
  });
});