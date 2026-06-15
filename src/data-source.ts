import { DataSource } from 'typeorm';
import { getConfig } from './config/configuration';

const config = getConfig();

export default new DataSource({
  type: 'postgres',
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  synchronize: false, // Отключаем автоматическую синхронизацию
  extra: config.db.ssl ? { sslmode: 'require' } : {},
});