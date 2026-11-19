import { randomBytes, scryptSync } from 'node:crypto';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const password = input.replace(/[\r\n]+$/, '');
if (password.length < 12) {
  console.error('Password must be at least 12 characters. Pass it through stdin.');
  process.exitCode = 1;
} else {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  process.stdout.write(`${salt}:${hash}\n`);
}
