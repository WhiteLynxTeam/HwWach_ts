import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { LocalAuthGuard } from '../src/auth/local-auth.guard';
import { LoginDto } from '../src/auth/dto/login.dto';
import { RegisterDto } from '../src/auth/dto/register.dto';
import { PendingRegistration } from '../src/users/entities/pending-registration.entity';

// Моки для сервисов
const mockAuthService = () => ({
  login: jest.fn(),
  refresh: jest.fn(),
});

const mockUsersService = () => ({
  registerUser: jest.fn(),
  findByLogin: jest.fn(),
});

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useFactory: mockAuthService,
        },
        {
          provide: UsersService,
          useFactory: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should login user and return tokens', async () => {
      const req = {
        user: {
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
        },
      };

      const tokens = {
        access_token: 'access_token_mock',
        refresh_token: 'refresh_token_mock',
      };

      jest.spyOn(authService, 'login').mockResolvedValue(tokens);

      const result = await controller.login(req);
      expect(result).toEqual(tokens);
      expect(authService.login).toHaveBeenCalledWith(req.user);
    });
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto: RegisterDto = {
        login: 'newuser',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
        phone: '+375291234567',
        position: 'Developer',
      };

      const pendingRegistration: Omit<PendingRegistration, 'passwordHash'> = {
        id: '1',
        login: 'newuser',
        firstName: 'New',
        lastName: 'User',
        phone: '+375291234567',
        position: 'Developer',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(usersService, 'registerUser').mockResolvedValue(pendingRegistration as never);

      const result = await controller.register(registerDto);
      expect(result).toEqual(pendingRegistration);
      expect(usersService.registerUser).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('refresh', () => {
    it('should refresh JWT token', async () => {
      const refreshToken = 'refresh_token_mock';
      const decodedToken = {
        sub: '1',
        login: 'testuser',
        role: 'USER',
      };

      const refreshedTokens = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
      };

      (authService as any).jwtService = {
        decode: jest.fn().mockReturnValue(decodedToken),
      };
      jest.spyOn(authService, 'refresh').mockResolvedValue(refreshedTokens);

      const result = await controller.refresh(refreshToken);
      expect(result).toEqual(refreshedTokens);
    });

    it('should return unauthorized error if token is invalid', async () => {
      const refreshToken = 'invalid_token';

      (authService as any).jwtService = {
        decode: jest.fn().mockReturnValue(null),
      };

      const result = await controller.refresh(refreshToken);
      expect(result).toEqual({
        statusCode: 401,
        message: 'Invalid token',
      });
    });
  });
});