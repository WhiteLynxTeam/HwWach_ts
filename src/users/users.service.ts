import { Injectable, UnauthorizedException, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  )  {
    console.log('🏗️ UsersService CONSTRUCTOR called');  // <--- Сработает ли?
  }

  async onModuleInit() {
    console.log('⚙️ UsersService onModuleInit called');
    // throw new Error('TEST ERROR - onModuleInit is running!');

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
      console.error('❌ Error during admin initialization:', error.message);
      throw error; // Не запускать приложение, если админ не создался
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
}
