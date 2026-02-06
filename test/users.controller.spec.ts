import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { User } from '../src/users/entities/user.entity';
import { PendingRegistration } from '../src/users/entities/pending-registration.entity';
import { CreateUserDto } from '../src/users/dto/create-user.dto';
import { UpdateUserDto } from '../src/users/dto/update-user.dto';
import { UserRole } from '../src/users/entities/user.entity';

// Мок для сервиса пользователей
const mockUsersService = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  getPendingRegistrations: jest.fn(),
  getRegistrationById: jest.fn(),
  approveRegistration: jest.fn(),
  rejectRegistration: jest.fn(),
});

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useFactory: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users: Omit<User, 'password'>[] = [
        {
          id: '1',
          login: 'user1',
          firstName: 'User',
          lastName: 'One',
          phone: '+375291234567',
          position: 'Developer',
          role: UserRole.USER,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(service, 'findAll').mockResolvedValue(users as never);

      const result = await controller.findAll();
      expect(result).toEqual(users);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const user: Omit<User, 'password'> = {
        id: '1',
        login: 'user1',
        firstName: 'User',
        lastName: 'One',
        phone: '+375291234567',
        position: 'Developer',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(user as never);

      const result = await controller.findOne('1');
      expect(result).toEqual(user);
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto: CreateUserDto = {
        login: 'newuser',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
        phone: '+375291234567',
        position: 'Developer',
        role: UserRole.USER,
      };

      const createdUser: Omit<User, 'password'> = {
        id: '2',
        login: 'newuser',
        firstName: 'New',
        lastName: 'User',
        phone: '+375291234567',
        position: 'Developer',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'create').mockResolvedValue(createdUser as never);

      const result = await controller.create(createUserDto);
      expect(result).toEqual(createdUser);
      expect(service.create).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const userId = '1';
      const updateUserDto: UpdateUserDto = {
        firstName: 'Updated',
        position: 'Senior Developer',
      };

      const updatedUser: Omit<User, 'password'> = {
        id: userId,
        login: 'user1',
        firstName: 'Updated',
        lastName: 'One',
        phone: '+375291234567',
        position: 'Senior Developer',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'update').mockResolvedValue(updatedUser as never);

      const result = await controller.update(userId, updateUserDto);
      expect(result).toEqual(updatedUser);
      expect(service.update).toHaveBeenCalledWith(userId, updateUserDto);
    });
  });

  describe('remove', () => {
    it('should deactivate a user', async () => {
      const userId = '1';
      const message = { message: 'User deactivated successfully' };

      jest.spyOn(service, 'remove').mockResolvedValue(undefined as never);

      const result = await controller.remove(userId);
      expect(result).toEqual(message);
      expect(service.remove).toHaveBeenCalledWith(userId);
    });
  });

  describe('getPendingRegistrations', () => {
    it('should return pending registrations', async () => {
      const registrations: Array<Omit<PendingRegistration, 'passwordHash'>> = [
        {
          id: '1',
          login: 'pendinguser',
          firstName: 'Pending',
          lastName: 'User',
          phone: '+375291234567',
          position: 'Tester',
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(service, 'getPendingRegistrations').mockResolvedValue(registrations as never);

      const result = await controller.getPendingRegistrations();
      expect(result).toEqual(registrations);
      expect(service.getPendingRegistrations).toHaveBeenCalled();
    });
  });

  describe('getRegistrationById', () => {
    it('should return a pending registration by id', async () => {
      const registration: Omit<PendingRegistration, 'passwordHash'> = {
        id: '1',
        login: 'pendinguser',
        firstName: 'Pending',
        lastName: 'User',
        phone: '+375291234567',
        position: 'Tester',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'getRegistrationById').mockResolvedValue(registration as never);

      const result = await controller.getRegistrationById('1');
      expect(result).toEqual(registration);
      expect(service.getRegistrationById).toHaveBeenCalledWith('1');
    });
  });
});