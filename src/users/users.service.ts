import { Injectable, UnauthorizedException, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { PendingRegistration } from './entities/pending-registration.entity';
import { PendingChanges } from './entities/pending-changes.entity';
import { RequestStatus } from '../common/enums/request-status.enum';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequestUserChangeDto } from './dto/request-user-change.dto';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(PendingRegistration)
    private pendingRegistrationsRepository: Repository<PendingRegistration>,
    @InjectRepository(PendingChanges)
    private changeRequestsRepository: Repository<PendingChanges>,
    private dataSource: DataSource,
  )  {
    console.log('🏗️ UsersService CONSTRUCTOR called');  // <--- Сработает ли?
  }

  /**
   * Метод инициализации модуля - создает администратора по умолчанию при старте приложения
   * и обновляет пароль, если он изменился в .env
   */
  async onModuleInit() {
    console.log('⚙️ UsersService onModuleInit called');

    try {
      console.log('🔍 Checking for default admin...');

      const adminLogin = process.env.DEFAULT_ADMIN_LOGIN;
      const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

      if (!adminLogin || !adminPassword) {
        console.error('❌ DEFAULT_ADMIN_LOGIN and DEFAULT_ADMIN_PASSWORD are required in .env');
        console.error('This is a security requirement to prevent default credentials in production.');
        return;
      }

      // Ищем админа по логину (не только по роли)
      const admin = await this.usersRepository.findOne({
        where: { login: adminLogin },
        select: ['id', 'password', 'role'], // password нужен для сравнения
      });

      if (!admin) {
        // Админ не найден — создаем нового
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const defaultAdmin = this.usersRepository.create({
          login: adminLogin,
          password: hashedPassword,
          role: UserRole.ADMIN,
        });

        await this.usersRepository.save(defaultAdmin);
        console.log(`✅ Default admin created: ${adminLogin}`);
      } else {
        // Админ существует — проверяем, нужно ли обновить пароль
        const isPasswordValid = await bcrypt.compare(adminPassword, admin.password);
        
        if (!isPasswordValid) {
          // Пароль изменился в .env — обновляем хэш в БД
          const newHashedPassword = await bcrypt.hash(adminPassword, 10);
          
          await this.usersRepository.update(admin.id, {
            password: newHashedPassword,
          });
          
          console.log(`🔄 Admin password updated for: ${adminLogin}`);
        } else {
          console.log('ℹ️ Admin already exists with correct password');
        }
      }
    } catch (error) {
      // Логируем ошибку, но не прерываем запуск приложения
      console.error('⚠️ Warning: Could not initialize default admin:', error.message);
      console.error('This might happen if tables do not exist yet. Admin will be created when tables are ready.');
    }
  }

  /**
   * Создает нового пользователя в системе
   * @param createUserDto - данные для создания пользователя
   * @returns созданный пользователь
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if login or phone already exists
    const existingUser = await this.usersRepository.findOne({
      where: [
        { login: createUserDto.login },
        { phone: createUserDto.phone }
      ],
    });

    if (existingUser) {
      throw new ConflictException('User with this login or phone already exists');
    }

    // Hash the password
    const saltRounds = process.env.BCRYPT_ROUNDS ? parseInt(process.env.BCRYPT_ROUNDS) : 10;
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

    const user = new User();
    user.login = createUserDto.login;
    user.password = hashedPassword;
    user.phone = createUserDto.phone;
    user.lastName = createUserDto.lastName;
    user.firstName = createUserDto.firstName;
    user.middleName = createUserDto.middleName;
    user.position = createUserDto.position;
    user.role = createUserDto.role || UserRole.USER;
    user.isActive = true;

    return await this.usersRepository.save(user);
  }

  /**
   * [yellow flag] - нужны ли нам эти функции?
   * Возвращает список всех пользователей в системе
   * @returns массив пользователей
   */
  async findAll(): Promise<User[]> {
    return await this.usersRepository.find({
      select: ['id', 'login', 'phone', 'lastName', 'firstName', 'middleName', 'position', 'role', 'isActive', 'createdAt', 'updatedAt'],
    });
  }

  /**
   * [yellow flag] - нужны ли нам эти функции?
   * Возвращает пользователя по его ID
   * @param id - идентификатор пользователя
   * @returns найденный пользователь или ошибка
   */
  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: ['id', 'login', 'phone', 'lastName', 'firstName', 'middleName', 'position', 'role', 'isActive', 'createdAt', 'updatedAt'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * [yellow flag] - нужны ли нам эти функции?
   * Находит пользователя по логину
   * @param login - логин пользователя
   * @returns найденный пользователь или null
   */
  async findByLogin(login: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { login },
    });
  }

  /**
   * Обновляет данные пользователя по ID
   * @param id - идентификатор пользователя
   * @param updateUserDto - новые данные пользователя
   * @returns обновленный пользователь
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Check if login or phone is being changed to an existing one
    if (updateUserDto.login && updateUserDto.login !== user.login) {
      const existingUser = await this.usersRepository.findOne({
        where: { login: updateUserDto.login },
      });
      if (existingUser) {
        throw new ConflictException('User with this login already exists');
      }
    }

    if (updateUserDto.phone && updateUserDto.phone !== user.phone) {
      const existingUser = await this.usersRepository.findOne({
        where: { phone: updateUserDto.phone },
      });
      if (existingUser) {
        throw new ConflictException('User with this phone already exists');
      }
    }

    // Hash password if it's being updated
    if (updateUserDto.password) {
      const saltRounds = process.env.BCRYPT_ROUNDS ? parseInt(process.env.BCRYPT_ROUNDS) : 10;
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, saltRounds);
    }

    Object.assign(user, updateUserDto);
    return await this.usersRepository.save(user);
  }

  /**
   * Деактивирует пользователя (мягкое удаление)
   * @param id - идентификатор пользователя
   */
  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.isActive = false; // Soft delete by deactivating
    await this.usersRepository.save(user);
  }

  /**
   * Проверяет действительность учетных данных пользователя
   * @param login - логин пользователя
   * @param password - пароль пользователя
   * @returns данные пользователя без пароля или null
   */
  async validateUser(login: string, password: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.login = :login', { login })
      .addSelect('user.password')
      .getOne();

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Return user without password
    const { password: _, ...result } = user;
    return result;
  }

  /**
   * Создает запрос на регистрацию нового пользователя
   * @param userData - данные пользователя для регистрации
   * @returns созданный запрос на регистрацию
   */
  async registerUser(userData: Partial<CreateUserDto>): Promise<Omit<PendingRegistration, 'password'>> {
    // Проверяем, существует ли уже пользователь с таким логином или телефоном
    const existingUser = await this.usersRepository.findOne({
      where: [
        { login: userData.login },
        { phone: userData.phone }
      ],
    });

    if (existingUser) {
      throw new ConflictException('User with this login or phone already exists');
    }

    // Проверяем, не существует ли уже ЗАЯВКА НА РАССМОТРЕНИИ с таким логином или телефоном
    // Отклоненные заявки не блокируют повторную регистрацию
    const existingPendingRegistration = await this.pendingRegistrationsRepository.findOne({
      where: [
        { login: userData.login, status: RequestStatus.PENDING },
        { phone: userData.phone, status: RequestStatus.PENDING }
      ],
    });

    if (existingPendingRegistration) {
      throw new ConflictException('Registration request with this login or phone already exists');
    }

    // Хэшируем пароль
    const saltRounds = process.env.BCRYPT_ROUNDS ? parseInt(process.env.BCRYPT_ROUNDS) : 10;
    const hashedPassword = await bcrypt.hash(userData.password!, saltRounds);

    const pendingRegistration = new PendingRegistration();
    pendingRegistration.login = userData.login!;
    pendingRegistration.password = hashedPassword;
    pendingRegistration.firstName = userData.firstName;
    pendingRegistration.lastName = userData.lastName;
    pendingRegistration.middleName = userData.middleName;
    pendingRegistration.phone = userData.phone;
    pendingRegistration.position = userData.position;
    pendingRegistration.status = RequestStatus.PENDING;

    const savedRegistration = await this.pendingRegistrationsRepository.save(pendingRegistration);

    // Возвращаем объект без password
    const { password, ...result } = savedRegistration;
    return result;
  }

  /**
   * Одобряет запрос на регистрацию пользователя
   * @param registrationId - идентификатор запроса на регистрацию
   * @param approvedById - идентификатор пользователя, одобрившего запрос
   * @param comment - комментарий к одобрению
   * @returns обновленный запрос на регистрацию
   */
  async approveRegistration(registrationId: string, approvedById: string, comment?: string): Promise<PendingRegistration> {
    // Получаем данные регистрации вне транзакции
    const registration = await this.pendingRegistrationsRepository.findOne({
      where: { id: registrationId }
    });

    if (!registration) {
      throw new NotFoundException('Registration request not found');
    }

    if (registration.status !== RequestStatus.PENDING) {
      throw new ConflictException('Registration request is not in pending status');
    }

    // Получаем пользователя, который одобряет регистрацию
    const approvingUser = await this.usersRepository.findOne({
      where: { id: approvedById }
    });

    if (!approvingUser) {
      throw new NotFoundException('Approving user not found');
    }

    // Выполняем транзакцию
    const result = await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Повторная проверка статуса внутри транзакции с пессимистичной блокировкой
      const freshRegistration = await transactionalEntityManager
        .createQueryBuilder(PendingRegistration, 'pr')
        .where('pr.id = :id', { id: registrationId })
        .addSelect('pr.password')
        .setLock('pessimistic_write')
        .getOne();

      if (!freshRegistration) {
        throw new NotFoundException('Registration request not found');
      }

      if (freshRegistration.status !== RequestStatus.PENDING) {
        throw new ConflictException('Registration request is already processed');
      }

      // 1. Создаем пользователя
      const newUser = transactionalEntityManager.create(User, {
        login: freshRegistration.login,
        password: freshRegistration.password,
        firstName: freshRegistration.firstName,
        lastName: freshRegistration.lastName,
        middleName: freshRegistration.middleName,
        phone: freshRegistration.phone,
        position: freshRegistration.position,
        role: UserRole.USER,
        isActive: true
      });
      await transactionalEntityManager.save(newUser);

      // 2. Обновляем статус заявки
      await transactionalEntityManager.update(PendingRegistration, registrationId, {
        status: RequestStatus.APPROVED,
        approvedByUser: approvingUser,
        adminComment: comment,
        processedAt: new Date()
      });

      // Возвращаем обновленную регистрацию
      const result = await transactionalEntityManager.findOne(PendingRegistration, {
        where: { id: registrationId }
      });

      if (!result) {
        throw new NotFoundException('Registration request not found');
      }

      return result;
    });

    return result;
  }

  /**
   * Отклоняет запрос на регистрацию пользователя
   * @param registrationId - идентификатор запроса на регистрацию
   * @param rejectedReason - причина отклонения
   * @returns обновленный запрос на регистрацию
   */
  async rejectRegistration(registrationId: string, rejectedReason?: string): Promise<PendingRegistration> {
    const registration = await this.pendingRegistrationsRepository.findOne({
      where: { id: registrationId }
    });

    if (!registration) {
      throw new NotFoundException('Registration request not found');
    }

    if (registration.status !== RequestStatus.PENDING) {
      throw new ConflictException('Registration request is not in pending status');
    }

    // Выполняем транзакцию
    const result = await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Проверка статуса внутри транзакции с пессимистичной блокировкой
      const freshRegistration = await transactionalEntityManager.findOne(PendingRegistration, {
        where: { id: registrationId },
        lock: { mode: 'pessimistic_write' } // Никто другой не сможет даже прочитать эту строку, пока мы не закончим
      });

      if (!freshRegistration) {
        throw new NotFoundException('Registration request not found');
      }

      if (freshRegistration.status !== RequestStatus.PENDING) {
        throw new ConflictException('Registration request is already processed');
      }

      // Обновляем статус заявки
      await transactionalEntityManager.update(PendingRegistration, registrationId, {
        status: RequestStatus.REJECTED,
        adminComment: rejectedReason,
        processedAt: new Date()
      });

      // Возвращаем обновленную регистрацию
      const result = await transactionalEntityManager.findOne(PendingRegistration, {
        where: { id: registrationId }
      });
      
      if (!result) {
        throw new NotFoundException('Registration request not found');
      }
      
      return result;
    });

    return result;
  }

  /**
   * Возвращает все нерассмотренные запросы на регистрацию
   * @returns массив запросов на регистрацию
   */
  async getPendingRegistrations(): Promise<PendingRegistration[]> {
    return await this.pendingRegistrationsRepository.find({
      where: { status: RequestStatus.PENDING },
      relations: ['approvedByUser']
    });
  }

  /**
   * Возвращает запрос на регистрацию по ID
   * @param id - идентификатор запроса
   * @returns найденный запрос на регистрацию
   */
  async getRegistrationById(id: string): Promise<PendingRegistration> {
    const registration = await this.pendingRegistrationsRepository.findOne({
      where: { id },
      relations: ['approvedByUser']
    });

    if (!registration) {
      throw new NotFoundException('Registration request not found');
    }

    return registration;
  }

  /**
   * Возвращает статус регистрации по ID
   * @param id - идентификатор запроса
   * @returns статус регистрации
   */
  async getRegistrationStatusById(id: string): Promise<PendingRegistration> {
    const registration = await this.pendingRegistrationsRepository.findOne({
      where: { id },
      select: [
        'id',
        'login',
        'status',
        'createdAt',
        'updatedAt',
        'adminComment',
        'processedAt'
      ]
    });

    if (!registration) {
      throw new NotFoundException('Registration request not found');
    }

    return registration;
  }

  /**
   * Создает запрос на изменение данных пользователя
   * @param userId - идентификатор пользователя
   * @param changes - новые данные пользователя
   * @returns созданный запрос на изменение
   */
  async requestUserChange(userId: string, changes: RequestUserChangeDto): Promise<PendingChanges> {
    console.log('Service received userId:', userId);
    const user = await this.findOne(userId);

    // Проверяем, есть ли уже нерассмотренный запрос от этого пользователя
    const existingRequest = await this.changeRequestsRepository.findOne({
      where: {
        requestedByUserId: userId,
        status: RequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new ConflictException('У вас уже есть нерассмотренный запрос на изменение данных');
    }

    // Создаем новый запрос на изменение с отдельными полями
    const changeRequest = new PendingChanges();
    changeRequest.requestedBy = user;
    changeRequest.requestedByUserId = userId;

    // Устанавливаем значения полей, если они отличаются от текущих значений пользователя
    if (changes.firstName && user.firstName !== changes.firstName) {
      changeRequest.firstName = changes.firstName;
    }
    if (changes.lastName && user.lastName !== changes.lastName) {
      changeRequest.lastName = changes.lastName;
    }
    if (changes.middleName && user.middleName !== changes.middleName) {
      changeRequest.middleName = changes.middleName;
    }
    if (changes.phone && user.phone !== changes.phone) {
      changeRequest.phone = changes.phone;
    }
    if (changes.position && user.position !== changes.position) {
      changeRequest.position = changes.position;
    }

    // Если нет изменений в профиле, выбрасываем ошибку
    if (
      !changeRequest.firstName &&
      !changeRequest.lastName &&
      !changeRequest.middleName &&
      !changeRequest.phone &&
      !changeRequest.position
    ) {
      throw new ConflictException('Нет изменений профиля для сохранения');
    }

    changeRequest.status = RequestStatus.PENDING;

    console.log('Saving change request for user ID:', userId);
    return await this.changeRequestsRepository.save(changeRequest);
  }

  /**
   * Возвращает все запросы на изменение данных пользователей
   * @returns массив запросов на изменение
   */
  async getAllChangeRequests(): Promise<PendingChanges[]> {
    return await this.changeRequestsRepository.find({
      relations: ['approvedByUser', 'requestedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Возвращает запрос на изменение по ID
   * @param id - идентификатор запроса
   * @returns найденный запрос на изменение
   */
  async getChangeRequestById(id: string): Promise<PendingChanges> {
    const request = await this.changeRequestsRepository.findOne({
      where: { id },
      relations: ['approvedByUser', 'requestedBy'],
    });

    if (!request) {
      throw new NotFoundException('Запрос на изменение не найден');
    }

    return request;
  }

  /**
   * Одобряет запрос на изменение данных пользователя
   * @param requestId - идентификатор запроса на изменение
   * @param approvedById - идентификатор пользователя, одобрившего запрос
   * @param comment - комментарий к одобрению
   * @returns обновленный запрос на изменение
   */
  async approveChangeRequest(requestId: string, approvedById: string, comment?: string): Promise<PendingChanges> {
    const request = await this.changeRequestsRepository.findOne({
      where: { id: requestId },
      relations: ['requestedBy'],
    });

    if (!request) {
      throw new NotFoundException('Запрос на изменение не найден');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException('Запрос на изменение уже обработан');
    }

    // Получаем пользователя, который одобряет изменения
    const approvingUser = await this.usersRepository.findOne({
      where: { id: approvedById }
    });

    if (!approvingUser) {
      throw new NotFoundException('Approving user not found');
    }

    // Выполняем транзакцию
    const result = await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Проверка статуса внутри транзакции с пессимистичной блокировкой
      const freshRequest = await transactionalEntityManager.findOne(PendingChanges, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' }, // Никто другой не сможет даже прочитать эту строку, пока мы не закончим
        relations: ['requestedBy']
      });

      if (!freshRequest) {
        throw new NotFoundException('Запрос на изменение не найден');
      }

      if (freshRequest.status !== RequestStatus.PENDING) {
        throw new ConflictException('Запрос на изменение уже обработан');
      }

      // Обновляем данные пользователя с учетом отдельных полей
      if (freshRequest.firstName) {
        freshRequest.requestedBy.firstName = freshRequest.firstName;
      }
      if (freshRequest.lastName) {
        freshRequest.requestedBy.lastName = freshRequest.lastName;
      }
      if (freshRequest.middleName) {
        freshRequest.requestedBy.middleName = freshRequest.middleName;
      }
      if (freshRequest.phone) {
        freshRequest.requestedBy.phone = freshRequest.phone;
      }
      if (freshRequest.position) {
        freshRequest.requestedBy.position = freshRequest.position;
      }

      await transactionalEntityManager.save(freshRequest.requestedBy);

      // Обновляем статус запроса
      freshRequest.status = RequestStatus.APPROVED;
      freshRequest.approvedByUser = approvingUser;
      freshRequest.adminComment = comment;
      freshRequest.processedAt = new Date();
      freshRequest.updatedAt = new Date();

      // Сохраняем обновленный запрос
      const updatedRequest = await transactionalEntityManager.save(freshRequest);

      // Загружаем обновленный запрос с правильным пользователем (без пароля)
      const finalRequest = await transactionalEntityManager.findOne(PendingChanges, {
        where: { id: updatedRequest.id },
        relations: ['approvedByUser', 'requestedBy'],
      });

      if (!finalRequest) {
        throw new NotFoundException('Не удалось загрузить обновленный запрос');
      }

      return finalRequest;
    });

    return result;
  }

  /**
   * Отклоняет запрос на изменение данных пользователя
   * @param requestId - идентификатор запроса на изменение
   * @param reason - причина отклонения
   * @returns обновленный запрос на изменение
   */
  async rejectChangeRequest(requestId: string, reason?: string): Promise<PendingChanges> {
    const request = await this.changeRequestsRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Запрос на изменение не найден');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException('Запрос на изменение уже обработан');
    }

    // Выполняем транзакцию
    const result = await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Проверка статуса внутри транзакции с пессимистичной блокировкой
      const freshRequest = await transactionalEntityManager.findOne(PendingChanges, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' } // Никто другой не сможет даже прочитать эту строку, пока мы не закончим
      });

      if (!freshRequest) {
        throw new NotFoundException('Запрос на изменение не найден');
      }

      if (freshRequest.status !== RequestStatus.PENDING) {
        throw new ConflictException('Запрос на изменение уже обработан');
      }

      // Обновляем статус запроса
      await transactionalEntityManager.update(PendingChanges, requestId, {
        status: RequestStatus.REJECTED,
        adminComment: reason,
        processedAt: new Date(),
        updatedAt: new Date()
      });

      // Возвращаем обновленный запрос
      const result = await transactionalEntityManager.findOne(PendingChanges, {
        where: { id: requestId }
      });
      
      if (!result) {
        throw new NotFoundException('Change request not found');
      }
      
      return result;
    });

    return result;
  }
}
