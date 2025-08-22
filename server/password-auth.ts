import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { UserLogin, UserRegister, User } from "@shared/schema";
import { AuditLogger } from "./audit-service";
import type { Request } from "express";

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

export async function loginUser(credentials: UserLogin, req?: Request): Promise<AuthResult> {
  const context = req ? AuditLogger.extractContext(req) : { ipAddress: 'unknown', userAgent: 'unknown' };
  
  try {
    // Find user by email
    const user = await storage.getUserByEmail(credentials.email);
    if (!user) {
      // Log failed login attempt
      await AuditLogger.logAuthentication('LOGIN_FAILED', context, {
        email: credentials.email,
        reason: 'user_not_found',
      });
      return { success: false, error: "Invalid email or password" };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(credentials.password, user.password);
    if (!isValidPassword) {
      // Log failed login attempt
      await AuditLogger.logAuthentication('LOGIN_FAILED', {
        ...context,
        userId: user.id,
      }, {
        email: credentials.email,
        reason: 'invalid_password',
      });
      return { success: false, error: "Invalid email or password" };
    }

    // Update last login
    await storage.updateUserLastLogin(user.id);

    // Log successful login
    await AuditLogger.logAuthentication('LOGIN', {
      ...context,
      userId: user.id,
      organizationId: user.currentOrganizationId || undefined,
    }, {
      email: credentials.email,
    });

    // Don't return password in response
    const { password: _, ...userWithoutPassword } = user;
    
    return { success: true, user: userWithoutPassword as User };
  } catch (error) {
    console.error("Login error:", error);
    // Log system error during login
    await AuditLogger.logAuthentication('LOGIN_FAILED', context, {
      email: credentials.email,
      reason: 'system_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { success: false, error: "Login failed" };
  }
}

export function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export async function getUserFromSession(req: any): Promise<User | null> {
  const userId = req.session?.userId;
  if (!userId) {
    return null;
  }
  
  try {
    const { storage } = await import("./storage");
    const user = await storage.getUser(userId);
    if (!user) {
      return null;
    }
    
    // Don't return password in response
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  } catch (error) {
    console.error("Error getting user from session:", error);
    return null;
  }
}