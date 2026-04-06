import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Ensure the database URL is present
if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL environment variable is missing');
}

// Create the serverless connection
const sql = neon(process.env.DATABASE_URL);

// Initialize Drizzle with the connection and your schema
export const db = drizzle(sql, { schema });
