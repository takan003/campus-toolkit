import bcrypt from "bcryptjs";
import { clampCostFactor } from "@/lib/validation";

export async function hashPassword(plainPassword: string, costFactor: number = 12): Promise<string> {
  const cost = clampCostFactor(costFactor, 12);
  const salt = await bcrypt.genSalt(cost);
  const hash = await bcrypt.hash(plainPassword, salt);
  return hash;
}

export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
