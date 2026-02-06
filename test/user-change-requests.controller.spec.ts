import { Test, TestingModule } from '@nestjs/testing';
import { UserChangeRequestsController } from '../src/users/user-change-requests.controller';
import { UsersService } from '../src/users/users.service';
import { PendingChanges } from '../src/users/entities/pending-changes.entity';
import { RequestUserChangeDto } from '../src/users/dto/request-user-change.dto';

// Мок для сервиса пользователей
const mockUsersService = () => ({
  requestUserChange: jest.fn(),
  getAllChangeRequests: jest.fn(),
  getChangeRequestById: jest.fn(),
  approveChangeRequest: jest.fn(),
  rejectChangeRequest: jest.fn(),
});

describe('UserChangeRequestsController', () => {
  let controller: UserChangeRequestsController;
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserChangeRequestsController],
      providers: [
        {
          provide: UsersService,
          useFactory: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UserChangeRequestsController>(UserChangeRequestsController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('requestChange', () => {
    it('should create a change request', async () => {
      const req = {
        user: {
          id: '1',
          login: 'testuser',
        },
      };

      const requestUserChangeDto: RequestUserChangeDto = {
        firstName: 'UpdatedFirstName',
        position: 'Senior Developer',
      };

      const changeRequest: PendingChanges = {
        id: '1',
        requestedBy: {
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
        requestedByUserId: '1',
        firstName: 'UpdatedFirstName',
        position: 'Senior Developer',
        status: 'PENDING',
        requestedAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'requestUserChange').mockResolvedValue(changeRequest as never);

      const result = await controller.requestChange(req, requestUserChangeDto);
      expect(result).toEqual(changeRequest);
      expect(service.requestUserChange).toHaveBeenCalledWith('1', requestUserChangeDto);
    });
  });

  describe('getAllChangeRequests', () => {
    it('should return all change requests', async () => {
      const changeRequests: PendingChanges[] = [
        {
          id: '1',
          requestedBy: {
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
          requestedByUserId: '1',
          firstName: 'UpdatedFirstName',
          position: 'Senior Developer',
          status: 'PENDING',
          requestedAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(service, 'getAllChangeRequests').mockResolvedValue(changeRequests as never);

      const result = await controller.getAllChangeRequests();
      expect(result).toEqual(changeRequests);
      expect(service.getAllChangeRequests).toHaveBeenCalled();
    });
  });

  describe('getChangeRequest', () => {
    it('should return a change request by id', async () => {
      const changeRequest: PendingChanges = {
        id: '1',
        requestedBy: {
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
        requestedByUserId: '1',
        firstName: 'UpdatedFirstName',
        position: 'Senior Developer',
        status: 'PENDING',
        requestedAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'getChangeRequestById').mockResolvedValue(changeRequest as never);

      const result = await controller.getChangeRequest('1');
      expect(result).toEqual(changeRequest);
      expect(service.getChangeRequestById).toHaveBeenCalledWith('1');
    });
  });

  describe('approveChangeRequest', () => {
    it('should approve a change request', async () => {
      const req = {
        user: {
          id: '2',
          login: 'admin',
        },
      };

      const changeRequest: PendingChanges = {
        id: '1',
        requestedBy: {
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
        requestedByUserId: '1',
        firstName: 'UpdatedFirstName',
        position: 'Senior Developer',
        status: 'APPROVED',
        requestedAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'approveChangeRequest').mockResolvedValue(changeRequest as never);

      const result = await controller.approveChangeRequest('1', 'Approved', req);
      expect(result).toEqual(changeRequest);
      expect(service.approveChangeRequest).toHaveBeenCalledWith('1', '2', 'Approved');
    });
  });

  describe('rejectChangeRequest', () => {
    it('should reject a change request', async () => {
      const changeRequest: PendingChanges = {
        id: '1',
        requestedBy: {
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
        requestedByUserId: '1',
        firstName: 'UpdatedFirstName',
        position: 'Senior Developer',
        status: 'REJECTED',
        requestedAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'rejectChangeRequest').mockResolvedValue(changeRequest as never);

      const result = await controller.rejectChangeRequest('1', 'Does not meet requirements');
      expect(result).toEqual(changeRequest);
      expect(service.rejectChangeRequest).toHaveBeenCalledWith('1', 'Does not meet requirements');
    });
  });
});