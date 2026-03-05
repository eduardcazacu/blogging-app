import { compare, genSalt, hash } from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const BCRYPT_PREFIX_REGEX = /^\$2[aby]\$\d{2}\$/;

export function isBcryptHash(value: string) {
  return BCRYPT_PREFIX_REGEX.test(value);
}

export async function hashPassword(plainPassword: string) {
  const salt = await genSalt(BCRYPT_ROUNDS);
  return hash(plainPassword, salt);
}

export async function verifyPassword({
  plainPassword,
  storedPassword,
}: {
  plainPassword: string;
  storedPassword: string;
}) {
  if (isBcryptHash(storedPassword)) {
    return compare(plainPassword, storedPassword);
  }

  // Legacy plaintext rows are accepted once and upgraded on successful sign-in.
  return plainPassword === storedPassword;
}
