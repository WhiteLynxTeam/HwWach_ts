import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env') });

export interface AppConfig {
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
  };
  jwt: {
    secret: string;
    // access короткий: права в токене не меняются до его истечения (5)
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  internal: {
    apiKey: string;
    // адрес go-сервиса для внутренних запросов (5.1)
    mainUrl: string;
  };
  // сроки автоудаления (8.6) — в днях
  retention: {
    emptyOrgDays: number;
    inactiveOrgDays: number;
    softDeleteDays: number;
    registrationExpireDays: number;
  };
  // число прокси Render перед приложением для app.set('trust proxy', N) (8.7)
  trustProxy: number;
  publicUrl: string;
}

export function getConfig(): AppConfig {
  const required = (name: string): string => {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required env variable: ${name}`);
    }
    return value;
  };
  const int = (name: string, fallback: number): number => {
    const v = parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(v) ? v : fallback;
  };

  return {
    db: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT_IN || '5432', 10),
      username: required('DB_USERNAME'),
      password: required('DB_PASSWORD'),
      database: process.env.DB_NAME || 'hwwach_db',
      ssl: process.env.DB_SSL === 'true',
    },
    jwt: {
      secret: required('JWT_SECRET'),
      accessExpiresIn: process.env.JWT_EXPIRATION_TIME || '10m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION_TIME || '7d',
    },
    internal: {
      apiKey: process.env.INTERNAL_API_KEY || '',
      mainUrl: (process.env.MAIN_INTERNAL_URL || 'https://hwwach.onrender.com').replace(/\/$/, ''),
    },
    retention: {
      emptyOrgDays: int('ORG_EMPTY_DELETE_DAYS', 14),
      inactiveOrgDays: int('ORG_INACTIVE_DELETE_DAYS', 365),
      softDeleteDays: int('ORG_SOFT_DELETE_DAYS', 30),
      registrationExpireDays: int('REGISTRATION_EXPIRE_DAYS', 30),
    },
    trustProxy: int('TRUST_PROXY_HOPS', 1),
    publicUrl: (process.env.PUBLIC_URL || 'https://ts-back-hwwach.onrender.com').replace(/\/$/, ''),
  };
}
