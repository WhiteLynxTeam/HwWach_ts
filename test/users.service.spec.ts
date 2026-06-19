import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UsersService } from '../src/users/users.service';
import { User } from '../src/users/entities/user.entity';
import { PendingRegistration } from '../src/users/entities/pending-registration.entity';
import { PendingChanges } from '../src/users/entities/pending-changes.entity';
import { PendingResetPass } from '../src/users/entities/pending-reset-pass.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from '../src/users/dto/create-user.dto';
import { UpdateUserDto } from '../src/users/dto/update-user.dto';
import { RequestUserChangeDto } from '../src/users/dto/request-user-change.dto';

// Мок bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

// Моки репозиториев
const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
};

const mockUserRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
});

const mockPendingRegistrationRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

const mockPendingChangesRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

const mockPendingResetPassRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

const mockDataSource = () => ({
  transaction: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Repository<User>;
  let pendingRegistrationRepository: Repository<PendingRegistration>;
  let pendingChangesRepository: Repository<PendingChanges>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useFactory: mockUserRepository,
        },
        {
          provide: getRepositoryToken(PendingRegistration),
          useFactory: mockPendingRegistrationRepository,
        },
        {
          provide: getRepositoryToken(PendingChanges),
          useFactory: mockPendingChangesRepository,
        },
        {
          provide: getRepositoryToken(PendingResetPass),
          useFactory: mockPendingResetPassRepository,
        },
        {
          provide: DataSource,
          useFactory: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    pendingRegistrationRepository = module.get<Repository<PendingRegistration>>(getRepositoryToken(PendingRegistration));
    pendingChangesRepository = module.get<Repository<PendingChanges>>(getRepositoryToken(PendingChanges));
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto: CreateUserDto = {
        login: 'testuser',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        phone: '+375291234567',
        position: 'Developer',
        role: 'USER',
      };

      const hashedPassword = 'hashed_password';
      
      const savedUser = {
        id: '1',
        ...createUserDto,
        password: hashedPassword,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      (bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>).mockResolvedValue(hashedPassword);
      jest.spyOn(userRepository, 'create').mockReturnValue(savedUser as never);
      jest.spyOn(userRepository, 'save').mockResolvedValue(savedUser as never);

      const result = await service.create(createUserDto);
      expect(result).toEqual(savedUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: [
          { login: createUserDto.login },
          { phone: createUserDto.phone }
        ],
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
    });

    it('should throw ConflictException if user with login already exists', async () => {
      const createUserDto: CreateUserDto = {
        login: 'existinguser',
        password: 'password123',
        firstName: 'Existing',
        lastName: 'User',
        phone: '+375291234567',
        position: 'Developer',
        role: 'USER',
      };

      const existingUser = {
        id: '1',
        ...createUserDto,
        password: 'hashedpassword',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(existingUser as never);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users = [
        {
          id: '1',
          login: 'user1',
          password: 'password1',
          firstName: 'User',
          lastName: 'One',
          phone: '+375291234567',
          position: 'Developer',
          role: 'USER',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(userRepository, 'find').mockResolvedValue(users as never);

      const result = await service.findAll();
      expect(result).toEqual(users);
      expect(userRepository.find).toHaveBeenCalledWith({
        select: ['id', 'login', 'phone', 'lastName', 'firstName', 'middleName', 'position', 'role', 'isActive', 'isPassReset', 'createdAt', 'updatedAt'],
      });
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const user = {
        id: '1',
        login: 'user1',
        password: 'password1',
        firstName: 'User',
        lastName: 'One',
        phone: '+375291234567',
        position: 'Developer',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user as never);

      const result = await service.findOne('1');
      expect(result).toEqual(user);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        select: ['id', 'login', 'phone', 'lastName', 'firstName', 'middleName', 'position', 'role', 'isActive', 'isPassReset', 'createdAt', 'updatedAt'],
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByLogin', () => {
    it('should return a user by login', async () => {
      const user = {
        id: '1',
        login: 'user1',
        password: 'password1',
        firstName: 'User',
        lastName: 'One',
        phone: '+375291234567',
        position: 'Developer',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user as never);

      const result = await service.findByLogin('user1');
      expect(result).toEqual(user);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { login: 'user1' },
      });
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const userId = '1';
      const updateUserDto: UpdateUserDto = {
        firstName: 'Updated',
        position: 'Senior Developer',
      };

      const existingUser = {
        id: userId,
        login: 'user1',
        password: 'password1',
        firstName: 'User',
        lastName: 'One',
        phone: '+375291234567',
        position: 'Developer',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedUser = {
        ...existingUser,
        ...updateUserDto,
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(existingUser as never);
      jest.spyOn(userRepository, 'save').mockResolvedValue(updatedUser as never);

      const result = await service.update(userId, updateUserDto);
      expect(result).toEqual(updatedUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({ 
        where: { id: userId },
        select: ['id', 'login', 'phone', 'lastName', 'firstName', 'middleName', 'position', 'role', 'isActive', 'isPassReset', 'createdAt', 'updatedAt'],
      });
    });
  });

  describe('remove', () => {
    it('should deactivate a user', async () => {
      const userId = '1';
      const existingUser = {
        id: userId,
        login: 'user1',
        password: 'password1',
        firstName: 'User',
        lastName: 'One',
        phone: '+375291234567',
        position: 'Developer',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const deactivatedUser = {
        ...existingUser,
        isActive: false,
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(existingUser as never);
      jest.spyOn(userRepository, 'save').mockResolvedValue(deactivatedUser as never);

      await service.remove(userId);
      expect(userRepository.findOne).toHaveBeenCalledWith({ 
        where: { id: userId },
        select: ['id', 'login', 'phone', 'lastName', 'firstName', 'middleName', 'position', 'role', 'isActive', 'isPassReset', 'createdAt', 'updatedAt'],
      });
      expect(userRepository.save).toHaveBeenCalledWith(deactivatedUser);
    });
  });

  describe('validateUser', () => {
    it('should return user without password if credentials are valid', async () => {
      const login = 'user1';
      const password = 'password123';
      const hashedPassword = 'hashed_password';

      const user = {
        id: '1',
        login,
        password: hashedPassword,
        firstName: 'User',
        lastName: 'One',
        phone: '+375291234567',
        position: 'Developer',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const userWithoutPassword = {
        id: '1',
        login,
        firstName: 'User',
        lastName: 'One',
        phone: '+375291234567',
        position: 'Developer',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(mockQueryBuilder, 'getOne').mockResolvedValue(user as never);
      (bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(true);

      const result = await service.validateUser(login, password);
      expect(result).toEqual(userWithoutPassword);
    });

    it('should return null if user not found', async () => {
      jest.spyOn(mockQueryBuilder, 'getOne').mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password');
      expect(result).toBeNull();
    });

    it('should return null if password is invalid', async () => {
      const login = 'user1';
      const password = 'password123';
      const wrongPassword = 'wrongpassword';
      const hashedPassword = 'hashed_password';

      const user = {
        id: '1',
        login,
        password: hashedPassword,
        firstName: 'User',
        lastName: 'One',
        phone: '+375291234567',
        position: 'Developer',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(mockQueryBuilder, 'getOne').mockResolvedValue(user as never);
      (bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(false);

      const result = await service.validateUser(login, wrongPassword);
      expect(result).toBeNull();
    });
  });

  describe('requestUserChange', () => {
    it('should create a change request', async () => {
      const userId = '1';
      const changes: RequestUserChangeDto = {
        firstName: 'UpdatedFirstName',
        position: 'Senior Developer',
        password: 'newpassword123',
      };

      const user = {
        id: userId,
        login: 'user1',
        password: 'password1',
        firstName: 'User',
        lastName: 'One',
        phone: '+375291234567',
        position: 'Developer',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const changeRequest = {
        id: '1',
        requestedBy: user,
        requestedByUserId: userId,
        firstName: 'UpdatedFirstName',
        position: 'Senior Developer',
        password: 'hashed_new_password',
        status: 'PENDING',
        requestedAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(user as never);
      jest.spyOn(pendingChangesRepository, 'findOne').mockResolvedValue(null as never);
      (bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>).mockResolvedValue('hashed_new_password');
      jest.spyOn(pendingChangesRepository, 'create').mockReturnValue(changeRequest as never);
      jest.spyOn(pendingChangesRepository, 'save').mockResolvedValue(changeRequest as never);

      const result = await service.requestUserChange(userId, changes);
      expect(result).toEqual(changeRequest);
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
    });

    it('should throw ConflictException if user already has a pending request', async () => {
      const userId = '1';
      const changes: RequestUserChangeDto = {
        firstName: 'UpdatedFirstName',
      };

      const user = {
        id: userId,
        login: 'user1',
        password: 'password1',
        firstName: 'User',
        lastName: 'One',
        phone: '+375291234567',
        position: 'Developer',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const existingRequest = {
        id: '1',
        requestedBy: user,
        requestedByUserId: userId,
        firstName: 'UpdatedFirstName',
        status: 'PENDING',
        requestedAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(user as never);
      jest.spyOn(pendingChangesRepository, 'findOne').mockResolvedValue(existingRequest as never);

      await expect(service.requestUserChange(userId, changes)).rejects.toThrow(ConflictException);
    });
  });
});