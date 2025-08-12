import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { UserLogin, UserRegister, User } from "@shared/schema";

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export async function registerUser(userData: UserRegister): Promise<AuthResult> {
  try {
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      return { success: false, error: "User already exists with this email" };
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

    // Create user
    const user = await storage.createUser({
      email: userData.email,
      name: userData.name,
      password: hashedPassword,
    });

    // Don't return password in response
    const { password: _, ...userWithoutPassword } = user;
    
    return { success: true, user: userWithoutPassword as User };
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, error: "Registration failed" };
  }
}

export async function loginUser(credentials: UserLogin): Promise<AuthResult> {
  try {
    // Find user by email
    const user = await storage.getUserByEmail(credentials.email);
    if (!user) {
      return { success: false, error: "Invalid email or password" };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(credentials.password, user.password);
    if (!isValidPassword) {
      return { success: false, error: "Invalid email or password" };
    }

    // Update last login
    await storage.updateUserLastLogin(user.id);

    // Don't return password in response
    const { password: _, ...userWithoutPassword } = user;
    
    return { success: true, user: userWithoutPassword as User };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Login failed" };
  }
}

export function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function getUserFromSession(req: any): User | null {
  return req.session?.user || null;
}