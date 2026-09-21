import bcrypt from "bcryptjs";

export async function hashPassword(plainPassword: string, costFactor: number = 12): Promise<string> {
  const salt = await bcrypt.genSalt(costFactor);
  const hash = await bcrypt.hash(plainPassword, salt);
  return hash;
}

export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
