import { 
  users, 
  loginTokens,
  automationLogs, 
  customChains,
  type User, 
  type InsertUser,
  type LoginToken,
  type InsertLoginToken,
  type AutomationLog,
  type InsertAutomationLog,
  type CustomChain,
  type InsertCustomChain
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(id: number): Promise<void>;
  
  // Login tokens
  createLoginToken(token: InsertLoginToken): Promise<LoginToken>;
  getLoginToken(token: string): Promise<LoginToken | undefined>;
  markTokenAsUsed(token: string): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
  
  // Automation logs
  createAutomationLog(log: InsertAutomationLog): Promise<AutomationLog>;
  getAutomationLogs(limit?: number): Promise<AutomationLog[]>;
  clearAutomationLogs(): Promise<void>;
  updateAutomationLogWithEmailResponse(uniqueId: string, emailResponse: string): Promise<AutomationLog | null>;
  
  // Custom chains
  createCustomChain(chain: InsertCustomChain): Promise<CustomChain>;
  getCustomChains(): Promise<CustomChain[]>;
  deleteCustomChain(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async createLoginToken(token: InsertLoginToken): Promise<LoginToken> {
    const [newToken] = await db
      .insert(loginTokens)
      .values(token)
      .returning();
    return newToken;
  }

  async getLoginToken(token: string): Promise<LoginToken | undefined> {
    const [tokenRecord] = await db
      .select()
      .from(loginTokens)
      .where(eq(loginTokens.token, token));
    return tokenRecord || undefined;
  }

  async markTokenAsUsed(token: string): Promise<void> {
    await db
      .update(loginTokens)
      .set({ used: true })
      .where(eq(loginTokens.token, token));
  }

  async cleanupExpiredTokens(): Promise<void> {
    await db
      .delete(loginTokens)
      .where(eq(loginTokens.expiresAt, new Date()));
  }

  async createAutomationLog(log: InsertAutomationLog): Promise<AutomationLog> {
    const [newLog] = await db
      .insert(automationLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async getAutomationLogs(limit: number = 50): Promise<any[]> {
    const logs = await db
      .select()
      .from(automationLogs)
      .orderBy(desc(automationLogs.createdAt))
      .limit(limit);
    
    // Transform field names to match frontend expectations
    return logs.map(log => ({
      id: log.id,
      chainname: log.chainName,
      email: log.email,
      response: log.response,
      status: log.status,
      timestamp: log.timestamp,
      uniqueid: log.uniqueId,
      emailresponse: log.emailResponse,
      emailreceivedat: log.emailReceivedAt,
      createdat: log.createdAt
    }));
  }

  async clearAutomationLogs(): Promise<void> {
    await db.delete(automationLogs);
  }

  async createCustomChain(chain: InsertCustomChain): Promise<CustomChain> {
    const [newChain] = await db
      .insert(customChains)
      .values(chain)
      .returning();
    return newChain;
  }

  async getCustomChains(): Promise<CustomChain[]> {
    return await db
      .select()
      .from(customChains)
      .orderBy(desc(customChains.createdAt));
  }

  async deleteCustomChain(id: number): Promise<void> {
    await db.delete(customChains).where(eq(customChains.id, id));
  }

  async updateAutomationLogWithEmailResponse(uniqueId: string, emailResponse: string): Promise<AutomationLog | null> {
    const [updatedLog] = await db
      .update(automationLogs)
      .set({ 
        emailResponse, 
        emailReceivedAt: new Date() 
      })
      .where(eq(automationLogs.uniqueId, uniqueId))
      .returning();
    return updatedLog || null;
  }
}

export const storage = new DatabaseStorage();
