import argon2 from 'argon2'

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
}

export function hashPassword(password) {
  return argon2.hash(password, ARGON2_OPTIONS)
}

export function verifyPassword(passwordHash, password) {
  return argon2.verify(passwordHash, password)
}
