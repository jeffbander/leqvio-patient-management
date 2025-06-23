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
  updateAutomationLogWithAgentResponse(uniqueId: string, agentResponse: string, agentName: string, webhookPayload?: any): Promise<AutomationLog | null>;
  
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

  async updateAutomationLogWithAgentResponse(uniqueId: string, agentResponse: string, agentName: string, webhookPayload?: any): Promise<AutomationLog | null> {
    console.log(`[STORAGE] updateAutomationLogWithAgentResponse called`);
    console.log(`[STORAGE] - uniqueId: ${uniqueId}`);
    console.log(`[STORAGE] - agentResponse length: ${agentResponse.length}`);
    console.log(`[STORAGE] - agentName: ${agentName}`);
    
    try {
      // First check if the automation log exists
      const existingLog = await db
        .select()
        .from(automationLogs)
        .where(eq(automationLogs.uniqueId, uniqueId))
        .limit(1);
      
      console.log(`[STORAGE] Found ${existingLog.length} matching logs for uniqueId: ${uniqueId}`);
      
      if (existingLog.length === 0) {
        console.log(`[STORAGE] ERROR: No automation log found with uniqueId: ${uniqueId}`);
        console.log(`[STORAGE] Available logs in database:`);
        const allLogs = await db.select({ id: automationLogs.id, uniqueId: automationLogs.uniqueId, chainName: automationLogs.chainName }).from(automationLogs);
        allLogs.forEach(log => {
          console.log(`[STORAGE] - ID: ${log.id}, uniqueId: ${log.uniqueId}, chainName: ${log.chainName}`);
        });
        return null;
      }
      
      // Determine chain type from webhook payload
      const chainType = this.determineChainType(webhookPayload);
      
      const [updatedLog] = await db
        .update(automationLogs)
        .set({ 
          agentResponse, 
          agentName,
          agentReceivedAt: new Date(),
          webhookPayload: webhookPayload || null,
          chainType,
          isCompleted: true, // Mark as completed when webhook received
        })
        .where(eq(automationLogs.uniqueId, uniqueId))
        .returning();
      
      console.log(`[STORAGE] Successfully updated automation log:`);
      console.log(`[STORAGE] - ID: ${updatedLog.id}`);
      console.log(`[STORAGE] - chainName: ${updatedLog.chainName}`);
      console.log(`[STORAGE] - uniqueId: ${updatedLog.uniqueId}`);
      console.log(`[STORAGE] - agentReceivedAt: ${updatedLog.agentReceivedAt}`);
      
      return updatedLog || null;
    } catch (error) {
      console.error(`[STORAGE] ERROR in updateAutomationLogWithAgentResponse:`, error);
      throw error;
    }
  }

  private determineChainType(webhookPayload: any): string {
    if (!webhookPayload) return 'unknown';
    
    const fields = Object.keys(webhookPayload);
    
    // Research chain has 'summ' field
    if (fields.includes('summ')) {
      return 'research';
    }
    
    // Pre Pre Chart has specific v2, v3, output fields
    if (fields.includes('Pre Pre Chart V2') || fields.includes('Pre Pre Chart V3') || fields.includes('pre_pre_output')) {
      return 'pre_pre_chart';
    }
    
    // Default to unknown for other chain types
    return 'unknown';
  }
}

export const storage = new DatabaseStorage();
