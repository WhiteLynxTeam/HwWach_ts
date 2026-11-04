import { randomInt } from 'crypto';
import { EntityManager } from 'typeorm';
import { Organization } from '../entities/organization.entity';

// Номер организации (9.2): 6 случайных цифр + 7-я контрольная по алгоритму Луна, как у банковских карт.
// Контрольная цифра ловит одну неверную цифру и почти любую перестановку соседних — опечатку при диктовке.

// Контрольная цифра для payload: справа налево удваивается каждая вторая цифра, начиная с крайней
// (контрольная встанет правее её), из удвоенного > 9 вычитается 9; контрольная дополняет сумму до кратного 10.
export function luhnCheckDigit(payload: string): number {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    let d = payload.charCodeAt(payload.length - 1 - i) - 48;
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

// Номер из ввода пользователя («482 913 5», «482-9135»): только цифры, 7 штук и верная контрольная; иначе null.
export function normalizeOrgNumber(raw?: string | null): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!/^[1-9]\d{6}$/.test(digits)) return null;
  return luhnCheckDigit(digits.slice(0, 6)) === Number(digits[6]) ? digits : null;
}

// Случайный номер, не по порядку: первая цифра не 0 — номер не теряет ведущий ноль при наборе.
export function randomOrgNumber(): string {
  const payload = String(randomInt(100_000, 1_000_000));
  return payload + luhnCheckDigit(payload);
}

// «4829135» → «482 913 5» — для показа и «Поделиться».
export function formatOrgNumber(n: string): string {
  return n.length === 7 ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : n;
}

// Свободный номер для новой организации. Коллизия при 900 000 вариантах редка — несколько попыток с запасом;
// гонку двух одновременных регистраций ловит уникальный индекс UQ_organizations_number.
export async function allocateOrgNumber(m: EntityManager): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const n = randomOrgNumber();
    const taken = await m.getRepository(Organization).count({ where: { number: n } });
    if (!taken) return n;
  }
  throw new Error('Не удалось подобрать свободный номер организации');
}
