import bcrypt from 'bcrypt';

const pin = process.argv[2];
if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
  console.error('Usage: npx tsx scripts/generatePinHash.ts <4-digit-pin>');
  process.exit(1);
}

const hash = bcrypt.hashSync(pin, 10);
console.log(hash);
