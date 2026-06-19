import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsController } from '../src/users/registrations.controller';
import { UsersService } from '../src/users/users.service';
import { PendingRegistration } from '../src/users/entities/pending-registration.entity';

// Мок для сервиса пользователей
const mockUsersService = () => ({
  getPendingRegistrations: jest.fn(),
  getRegistrationById: jest.fn(),
  approveRegistration: jest.fn(),
  rejectRegistration: jest.fn(),
});

describe('RegistrationsController', () => {
  let controller: RegistrationsController;
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegistrationsController],
      providers: [
        {
          provide: UsersService,
          useFactory: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<RegistrationsController>(RegistrationsController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPendingRegistrations', () => {
    it('should return pending registrations', async () => {
      const registrations: Array<Omit<PendingRegistration, 'password'>> = [
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
      const registration: Omit<PendingRegistration, 'password'> = {
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

  describe('approveRegistration', () => {
    it('should approve a pending registration', async () => {
      const registration: Omit<PendingRegistration, 'password'> = {
        id: '1',
        login: 'pendinguser',
        firstName: 'Pending',
        lastName: 'User',
        phone: '+375291234567',
        position: 'Tester',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'approveRegistration').mockResolvedValue(registration as never);

      const req = { user: { id: 'admin-id' } };
      const result = await controller.approveRegistration('1', 'Approved comment', req);
      expect(result).toEqual(registration);
      expect(service.approveRegistration).toHaveBeenCalledWith('1', 'admin-id', 'Approved comment');
    });
  });

  describe('rejectRegistration', () => {
    it('should reject a pending registration', async () => {
      const registration: Omit<PendingRegistration, 'password'> = {
        id: '1',
        login: 'pendinguser',
        firstName: 'Pending',
        lastName: 'User',
        phone: '+375291234567',
        position: 'Tester',
        status: 'REJECTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'rejectRegistration').mockResolvedValue(registration as never);

      const result = await controller.rejectRegistration('1', 'Reason for rejection');
      expect(result).toEqual(registration);
      expect(service.rejectRegistration).toHaveBeenCalledWith('1', 'Reason for rejection');
    });
  });
});
