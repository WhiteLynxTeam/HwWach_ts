import { Injectable, UnauthorizedException, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { PendingRegistration, RegistrationStatus } from './entities/pending-registration.entity';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(PendingRegistration)
    private pendingRegistrationsRepository: Repository<PendingRegistration>,
  )  {
    console.log('🏗️ UsersService CONSTRUCTOR called');  // <--- Сработает ли?
  }

  async onModuleInit() {
    console.log('⚙️ UsersService onModuleInit called');

    try {
      console.log('🔍 Checking for default admin...');

      const adminExists = await this.usersRepository.findOne({
        where: { role: UserRole.ADMIN },
      });

      if (!adminExists) {
        const adminLogin = process.env.DEFAULT_ADMIN_LOGIN || 'admin';
        const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || '123!';

        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const defaultAdmin = this.usersRepository.create({
          login: adminLogin,
          password: hashedPassword,
          role: UserRole.ADMIN,
        });

        await this.usersRepository.save(defaultAdmin);
        console.log(`✅ Default admin created: ${adminLogin}`);
      } else {
        console.log('ℹ️ Admin already exists');
      }
    } catch (error) {
      // Логируем ошибку, но не прерываем запуск приложения
      console.error('⚠️ Warning: Could not initialize default admin:', error.message);
      console.error('This might happen if tables do not exist yet. Admin will be created when tables are ready.');
    }
  }

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

  async findAll(): Promise<User[]> {
    return await this.usersRepository.find({
      select: ['id', 'login', 'phone', 'lastName', 'firstName', 'middleName', 'position', 'role', 'isActive', 'createdAt', 'updatedAt'],
    });
  }

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

  async findByLogin(login: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { login },
    });
  }

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

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.isActive = false; // Soft delete by deactivating
    await this.usersRepository.save(user);
  }

  async validateUser(login: string, password: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.findByLogin(login);
    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Return user without password
    const { password: _, ...result } = user;
    return user;
  }

  async registerUser(userData: Partial<CreateUserDto>): Promise<Omit<PendingRegistration, 'passwordHash'>> {
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

    // Проверяем, не существует ли уже запрос на регистрацию с таким логином или телефоном
    const existingPendingRegistration = await this.pendingRegistrationsRepository.findOne({
      where: [
        { login: userData.login },
        { phone: userData.phone }
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
    pendingRegistration.passwordHash = hashedPassword;
    pendingRegistration.firstName = userData.firstName;
    pendingRegistration.lastName = userData.lastName;
    pendingRegistration.middleName = userData.middleName;
    pendingRegistration.phone = userData.phone;
    pendingRegistration.position = userData.position;
    pendingRegistration.status = RegistrationStatus.PENDING;

    const savedRegistration = await this.pendingRegistrationsRepository.save(pendingRegistration);

    // Возвращаем объект без passwordHash
    const { passwordHash, ...result } = savedRegistration;
    return result;
  }

  async approveRegistration(registrationId: string, approvedById: string, comment?: string): Promise<PendingRegistration> {
    const registration = await this.pendingRegistrationsRepository.findOne({
      where: { id: registrationId }
    });

    if (!registration) {
      throw new NotFoundException('Registration request not found');
    }

    if (registration.status !== RegistrationStatus.PENDING) {
      throw new ConflictException('Registration request is not in pending status');
    }

    // Получаем пользователя, который одобряет регистрацию
    const approvingUser = await this.usersRepository.findOne({
      where: { id: approvedById }
    });

    if (!approvingUser) {
      throw new NotFoundException('Approving user not found');
    }

    // Создаем нового пользователя из данных регистрации
    const newUser = new User();
    newUser.login = registration.login;
    newUser.password = registration.passwordHash; // Сохраняем уже захэшированный пароль
    newUser.firstName = registration.firstName;
    newUser.lastName = registration.lastName;
    newUser.middleName = registration.middleName;
    newUser.phone = registration.phone;
    newUser.position = registration.position;
    newUser.role = UserRole.USER; // Новый пользователь получает роль USER по умолчанию
    newUser.isActive = true;

    // Сохраняем нового пользователя
    await this.usersRepository.save(newUser);

    // Обновляем статус запроса на регистрацию
    registration.status = RegistrationStatus.APPROVED;
    registration.approvedByUser = approvingUser;
    registration.approvalComment = comment;
    registration.approvedAt = new Date();

    return await this.pendingRegistrationsRepository.save(registration);
  }

  async rejectRegistration(registrationId: string, rejectedReason?: string): Promise<PendingRegistration> {
    const registration = await this.pendingRegistrationsRepository.findOne({
      where: { id: registrationId }
    });

    if (!registration) {
      throw new NotFoundException('Registration request not found');
    }

    if (registration.status !== RegistrationStatus.PENDING) {
      throw new ConflictException('Registration request is not in pending status');
    }

    registration.status = RegistrationStatus.REJECTED;
    registration.rejectedReason = rejectedReason;

    return await this.pendingRegistrationsRepository.save(registration);
  }

  async getPendingRegistrations(): Promise<PendingRegistration[]> {
    return await this.pendingRegistrationsRepository.find({
      where: { status: RegistrationStatus.PENDING },
      relations: ['approvedByUser']
    });
  }

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
}
