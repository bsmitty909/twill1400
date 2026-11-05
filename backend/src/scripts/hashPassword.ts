/*
 * Prints an ARCHIVE_PASSWORD_HASH line for backend/.env.
 *
 *   ARCHIVE_PASSWORD=... node dist/scripts/hashPassword.js
 *   echo -n 'password' | node dist/scripts/hashPassword.js
 *
 * Only the scrypt hash is printed, never the password.
 */
import * as fs from 'fs';
import { hashPassword } from '../auth';

const password = process.env.ARCHIVE_PASSWORD ?? fs.readFileSync(0, 'utf8').replace(/\r?\n$/, '');
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}
console.log(`ARCHIVE_PASSWORD_HASH=${hashPassword(password)}`);
