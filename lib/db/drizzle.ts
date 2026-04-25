import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getAppEnv } from '../env/schema';
import * as schema from './schema';

type Database = PostgresJsDatabase<typeof schema>;

let client: ReturnType<typeof postgres> | undefined;
let database: Database | undefined;

export function getDb(): Database {
  if (!database) {
    client = postgres(getAppEnv().DATABASE_URL, {
      max: 1,
      prepare: false,
    });
    database = drizzle(client, { schema });
  }

  return database;
}

export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});
