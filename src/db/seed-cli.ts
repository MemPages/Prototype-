import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig } from '../config.ts';
import { openDb, migrate } from './sqlite.ts';
import { seed } from './seed.ts';
const cfg = loadConfig();
mkdirSync(dirname(cfg.dbPath), { recursive: true });
const db = openDb(cfg.dbPath); migrate(db); seed(db);
console.log(`Seeded DEMO data into ${cfg.dbPath}`);
