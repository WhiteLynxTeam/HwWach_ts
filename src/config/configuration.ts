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
    expiresIn: string;
  };
}

export function getConfig(): AppConfig {
  const required = (name: string): string => {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required env variable: ${name}`);
    }
    return value;
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
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
  };
}