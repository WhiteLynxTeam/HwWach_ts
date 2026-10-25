import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { QueryFailedError } from 'typeorm';

export async function hashPassword(password: string): Promise<string> {
  const rounds = process.env.BCRYPT_ROUNDS ? parseInt(process.env.BCRYPT_ROUNDS, 10) : 10;
  return bcrypt.hash(password, rounds);
}

// Временный пароль: заданный админом, иначе пароль по умолчанию из DEFAULT_NULL_PASSWORD,
// иначе случайный. Возвращаем его админу, чтобы передать человеку (кроме пароля по умолчанию — он его знает)
export async function tempPassword(given?: string): Promise<{ hash: string; plain?: string; isDefault: boolean }> {
  if (given && given.trim() !== '') {
    return { hash: await hashPassword(given), plain: given, isDefault: false };
  }
  const def = process.env.DEFAULT_NULL_PASSWORD;
  if (def) {
    return { hash: await hashPassword(def), isDefault: true };
  }
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let plain = '';
  for (let i = 0; i < 8; i++) plain += alphabet[randomInt(0, alphabet.length)];
  return { hash: await hashPassword(plain), plain, isDefault: false };
}

const FORBIDDEN_LOGINS = ['null', 'nul', 'nil'];

export function checkForbiddenLogin(login?: string): void {
  if (login && FORBIDDEN_LOGINS.includes(login.toLowerCase())) {
    throw new BadRequestException(`Использование логина "${login}" запрещено.`);
  }
}

// Нарушения частичных UNIQUE (2.3) → понятный 409
export function rethrowUnique(e: unknown): never {
  if (e instanceof QueryFailedError && (e as any).driverError?.code === '23505') {
    const c: string = (e as any).driverError?.constraint ?? '';
    if (c.includes('login')) throw new ConflictException('Логин уже занят');
    if (c.includes('email')) throw new ConflictException('Почта уже используется');
    if (c.includes('person')) throw new ConflictException('У этого человека уже есть активная учётная запись');
    if (c.includes('one_admin')) throw new ConflictException('В организации уже есть администратор');
    throw new ConflictException('Запись уже существует');
  }
  throw e;
}
