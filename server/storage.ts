import { 
  users, 
  organizations,
  organizationMemberships,
  loginTokens,
  automationLogs, 
  customChains,
  apiAnalytics,
  patients,
  patientDocuments,
  eSignatureForms,
  appointments,
  type User, 
  type InsertUser,
  type Organization,
  type InsertOrganization,
  type OrganizationMembership,
  type InsertOrganizationMembership,
  type LoginToken,
  type InsertLoginToken,
  type AutomationLog,
  type InsertAutomationLog,
  type CustomChain,
  type InsertCustomChain,
  type ApiAnalytics,
  type InsertApiAnalytics,
  type Patient,
  type InsertPatient,
  type PatientDocument,
  type InsertPatientDocument,
  type ESignatureForm,
  type InsertESignatureForm,
  type Appointment,
  type InsertAppointment
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, and } from "drizzle-orm";

export interface IStorage {
  // Organization management
  createOrganization(organization: InsertOrganization): Promise<Organization>;
  getOrganization(id: number): Promise<Organization | undefined>;
  updateOrganization(organizationId: number, updates: { name?: string; description?: string }): Promise<Organization>;
  getOrganizationMembers(organizationId: number): Promise<User[]>;
  addOrganizationMember(membership: InsertOrganizationMembership): Promise<OrganizationMembership>;
  removeOrganizationMember(userId: number, organizationId: number): Promise<void>;
  removeUserFromOrganization(userId: number, organizationId: number): Promise<void>;
  
  // Multi-organization support
  getUserOrganizations(userId: number): Promise<Array<{ organization: Organization; role: string; isActive: boolean }>>;
  switchUserOrganization(userId: number, organizationId: number): Promise<void>;
  getUserCurrentOrganization(userId: number): Promise<{ organization: Organization; role: string } | null>;
  updateMemberRole(userId: number, organizationId: number, role: string): Promise<void>;

  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  updateUserLastLogin(id: number): Promise<void>;
  updateUserProfile(id: number, updates: { name: string; email: string }): Promise<User>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;
  deleteUser(id: number): Promise<void>;
  deleteOrganization(id: number): Promise<void>;
  
  // Login tokens
  createLoginToken(token: InsertLoginToken): Promise<LoginToken>;
  getLoginToken(token: string): Promise<LoginToken | undefined>;
  markTokenAsUsed(token: string): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
  
  // Automation logs
  createAutomationLog(log: InsertAutomationLog): Promise<AutomationLog>;
  getAutomationLogs(limit?: number, dateFilter?: Date | null): Promise<AutomationLog[]>;
  getPatientAutomationLogs(patientId: number): Promise<AutomationLog[]>;
  clearAutomationLogs(): Promise<void>;
  updateAutomationLogWithEmailResponse(uniqueId: string, emailResponse: string): Promise<AutomationLog | null>;
  updateAutomationLogWithAgentResponse(uniqueId: string, agentResponse: string, agentName: string, webhookPayload?: any): Promise<AutomationLog | null>;
  
  // Custom chains
  createCustomChain(chain: InsertCustomChain): Promise<CustomChain>;
  getCustomChains(): Promise<CustomChain[]>;
  deleteCustomChain(id: number): Promise<void>;
  
  // API Analytics
  createApiAnalytics(analytics: InsertApiAnalytics): Promise<ApiAnalytics>;
  getApiAnalytics(timeRange?: string): Promise<ApiAnalytics[]>;
  getAnalyticsSummary(timeRange?: string): Promise<any>;
  getEndpointStats(timeRange?: string): Promise<any[]>;
  getResponseTimeStats(timeRange?: string): Promise<any>;
  getErrorRateStats(timeRange?: string): Promise<any>;
  
  // Patient Management
  createPatient(patient: InsertPatient, userId: number, organizationId: number): Promise<Patient>;
  getPatient(id: number, organizationId: number): Promise<Patient | undefined>;
  getOrganizationPatients(organizationId: number): Promise<Patient[]>;
  getUserPatients(userId: number): Promise<Patient[]>; // Keep for backward compatibility
  getAllPatients(): Promise<Patient[]>; // Keep for backward compatibility
  updatePatient(id: number, patient: Partial<InsertPatient>, organizationId: number): Promise<Patient | undefined>;
  updatePatientStatus(id: number, status: string, organizationId: number): Promise<Patient | undefined>;
  deletePatient(id: number, organizationId: number): Promise<boolean>;
  
  // Patient Documents
  createPatientDocument(document: InsertPatientDocument): Promise<PatientDocument>;
  getPatientDocuments(patientId: number): Promise<PatientDocument[]>;
  deletePatientDocument(documentId: number): Promise<boolean>;
  
  // E-Signature Forms
  createESignatureForm(form: InsertESignatureForm): Promise<ESignatureForm>;
  getESignatureForm(id: number): Promise<ESignatureForm | undefined>;
  updateESignatureFormEmailStatus(id: number, emailSentTo: string): Promise<ESignatureForm | undefined>;
  
  // Appointments
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  getPatientAppointments(patientId: number): Promise<Appointment[]>;
  updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Organization methods
  async createOrganization(organization: InsertOrganization): Promise<Organization> {
    const [org] = await db.insert(organizations).values(organization).returning();
    return org;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async updateOrganization(organizationId: number, updates: { name?: string; description?: string }): Promise<Organization> {
    const [organization] = await db
      .update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.id, organizationId))
      .returning();
    return organization;
  }

  async getOrganizationMembers(organizationId: number): Promise<User[]> {
    const memberships = await db
      .select({
        user: users,
        membership: organizationMemberships
      })
      .from(organizationMemberships)
      .leftJoin(users, eq(organizationMemberships.userId, users.id))
      .where(and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.isActive, true)
      ));

    return memberships.map(m => ({
      ...m.user!,
      role: m.membership.role, // Use role from membership, not user table
      tempPassword: m.user!.tempPassword // Include temp password for display
    }));
  }

  async addOrganizationMember(membership: InsertOrganizationMembership): Promise<OrganizationMembership> {
    const [member] = await db.insert(organizationMemberships).values(membership).returning();
    return member;
  }

  async removeOrganizationMember(userId: number, organizationId: number): Promise<void> {
    await db.delete(organizationMemberships)
      .where(and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, organizationId)));
  }

  async updateMemberRole(userId: number, organizationId: number, role: string): Promise<void> {
    await db.update(organizationMemberships)
      .set({ role })
      .where(and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, organizationId)));
  }

  async removeUserFromOrganization(userId: number, organizationId: number): Promise<void> {
    // Deactivate the membership instead of deleting it
    await db
      .update(organizationMemberships)
      .set({ isActive: false })
      .where(and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.organizationId, organizationId)
      ));
    
    // If this was the user's current organization, clear it
    const user = await this.getUser(userId);
    if (user?.currentOrganizationId === organizationId) {
      await db
        .update(users)
        .set({ currentOrganizationId: null })
        .where(eq(users.id, userId));
    }
  }
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

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  // Multi-organization support methods
  async getUserOrganizations(userId: number): Promise<Array<{ organization: Organization; role: string; isActive: boolean }>> {
    const memberships = await db
      .select({
        organization: organizations,
        membership: organizationMemberships
      })
      .from(organizationMemberships)
      .leftJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
      .where(eq(organizationMemberships.userId, userId));

    return memberships.map(m => ({
      organization: m.organization!,
      role: m.membership.role,
      isActive: m.membership.isActive
    }));
  }

  async switchUserOrganization(userId: number, organizationId: number): Promise<void> {
    // Verify user is a member of this organization
    const membership = await db
      .select()
      .from(organizationMemberships)
      .where(and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.isActive, true)
      ))
      .limit(1);

    if (membership.length === 0) {
      throw new Error('User is not a member of this organization');
    }

    await db
      .update(users)
      .set({ currentOrganizationId: organizationId })
      .where(eq(users.id, userId));
  }

  async getUserCurrentOrganization(userId: number): Promise<{ organization: Organization; role: string } | null> {
    const result = await db
      .select({
        organization: organizations,
        membership: organizationMemberships
      })
      .from(users)
      .leftJoin(organizations, eq(users.currentOrganizationId, organizations.id))
      .leftJoin(organizationMemberships, and(
        eq(organizationMemberships.userId, users.id),
        eq(organizationMemberships.organizationId, organizations.id),
        eq(organizationMemberships.isActive, true)
      ))
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0 || !result[0].organization || !result[0].membership) {
      return null;
    }

    return {
      organization: result[0].organization,
      role: result[0].membership.role
    };
  }

  async updateUserProfile(id: number, updates: { name: string; email: string }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ name: updates.name, email: updates.email })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id));
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async deleteOrganization(id: number): Promise<void> {
    await db.delete(organizations).where(eq(organizations.id, id));
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

  async getAutomationLogs(limit: number = 50, dateFilter: Date | null = null): Promise<any[]> {
    let query = db
      .select()
      .from(automationLogs)
      .orderBy(desc(automationLogs.createdAt));
    
    // Apply date filter if provided
    if (dateFilter) {
      query = query.where(gte(automationLogs.createdAt, dateFilter)) as any;
    }
    
    const logs = await query.limit(limit);
    
    // Transform field names to match frontend expectations
    return logs.map(log => ({
      id: log.id,
      chainname: log.chainName,
      email: log.email,
      response: log.response,
      status: log.status,
      timestamp: log.timestamp,
      uniqueid: log.uniqueId,
      requestdata: log.requestData,
      emailresponse: log.emailResponse,
      emailreceivedat: log.emailReceivedAt,
      agentresponse: log.agentResponse,
      agentname: log.agentName,
      agentreceivedat: log.agentReceivedAt,
      webhookpayload: log.webhookPayload,
      chaintype: log.chainType,
      iscompleted: log.isCompleted,
      createdat: log.createdAt
    }));
  }

  async clearAutomationLogs(): Promise<void> {
    await db.delete(automationLogs);
  }

  async getPatientAutomationLogs(patientId: number): Promise<any[]> {
    // Get automation logs for this specific patient using the new patient_id column
    const logs = await db
      .select()
      .from(automationLogs)
      .where(eq(automationLogs.patientId, patientId))
      .orderBy(desc(automationLogs.createdAt))
      .limit(10);
    
    // Transform field names to match frontend expectations
    return logs.map(log => ({
      id: log.id,
      chainname: log.chainName,
      status: log.status,
      timestamp: log.timestamp,
      uniqueid: log.uniqueId,
      iscompleted: log.isCompleted,
      createdat: log.createdAt,
      agentresponse: log.agentResponse,
      agentname: log.agentName,
      requestdata: log.requestData,
      webhookpayload: log.webhookPayload
    }));
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
      
      console.log(`[STORAGE] Updating with chainType: ${chainType}, isCompleted: true`);
      console.log(`[STORAGE] webhookPayload:`, JSON.stringify(webhookPayload, null, 2));
      
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

  // API Analytics methods
  async createApiAnalytics(analytics: InsertApiAnalytics): Promise<ApiAnalytics> {
    try {
      // Sanitize data to avoid null values that cause DB issues
      const sanitizedData = {
        endpoint: analytics.endpoint || '',
        method: analytics.method || 'GET',
        statusCode: analytics.statusCode || 200,
        responseTime: analytics.responseTime || 0,
        userAgent: analytics.userAgent || '',
        ipAddress: analytics.ipAddress || '',
        chainType: analytics.chainType || undefined,
        uniqueId: analytics.uniqueId || undefined,
        requestSize: analytics.requestSize || 0,
        responseSize: analytics.responseSize || 0,
        errorMessage: analytics.errorMessage || undefined,
        requestData: analytics.requestData || undefined
      };
      
      const [newAnalytics] = await db.insert(apiAnalytics).values(sanitizedData).returning();
      return newAnalytics;
    } catch (error) {
      console.error('Error creating API analytics:', error);
      throw error;
    }
  }

  async getApiAnalytics(timeRange: string = '24h'): Promise<ApiAnalytics[]> {
    let dateFilter: Date | null = null;
    
    switch (timeRange) {
      case '1h':
        dateFilter = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case '24h':
        dateFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    const query = db.select().from(apiAnalytics).orderBy(desc(apiAnalytics.timestamp));
    
    if (dateFilter) {
      return query.where(gte(apiAnalytics.timestamp, dateFilter));
    }
    
    return query;
  }

  async getAnalyticsSummary(timeRange: string = '24h'): Promise<any> {
    const analytics = await this.getApiAnalytics(timeRange);
    
    const totalRequests = analytics.length;
    const successfulRequests = analytics.filter(a => a.statusCode >= 200 && a.statusCode < 400).length;
    const errorRequests = analytics.filter(a => a.statusCode >= 400).length;
    const avgResponseTime = analytics.length > 0 
      ? Math.round(analytics.reduce((sum, a) => sum + a.responseTime, 0) / analytics.length)
      : 0;
    
    const uniqueEndpoints = Array.from(new Set(analytics.map(a => a.endpoint)));
    const chainTypes = Array.from(new Set(analytics.filter(a => a.chainType).map(a => a.chainType)));
    
    return {
      totalRequests,
      successfulRequests,
      errorRequests,
      successRate: totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 0,
      avgResponseTime,
      uniqueEndpoints: uniqueEndpoints.length,
      chainTypes: chainTypes.length,
      timeRange
    };
  }

  async getEndpointStats(timeRange: string = '24h'): Promise<any[]> {
    const analytics = await this.getApiAnalytics(timeRange);
    
    const endpointStats = analytics.reduce((acc, curr) => {
      const key = `${curr.method} ${curr.endpoint}`;
      if (!acc[key]) {
        acc[key] = {
          endpoint: curr.endpoint,
          method: curr.method,
          requests: 0,
          successfulRequests: 0,
          errorRequests: 0,
          totalResponseTime: 0,
          avgResponseTime: 0
        };
      }
      
      acc[key].requests++;
      if (curr.statusCode >= 200 && curr.statusCode < 400) {
        acc[key].successfulRequests++;
      } else {
        acc[key].errorRequests++;
      }
      acc[key].totalResponseTime += curr.responseTime;
      acc[key].avgResponseTime = Math.round(acc[key].totalResponseTime / acc[key].requests);
      
      return acc;
    }, {} as Record<string, any>);
    
    return Object.values(endpointStats).sort((a, b) => b.requests - a.requests);
  }

  async getResponseTimeStats(timeRange: string = '24h'): Promise<any> {
    const analytics = await this.getApiAnalytics(timeRange);
    
    if (analytics.length === 0) {
      return { min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
    }
    
    const responseTimes = analytics.map(a => a.responseTime).sort((a, b) => a - b);
    const min = responseTimes[0];
    const max = responseTimes[responseTimes.length - 1];
    const avg = Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    const p95 = responseTimes[p95Index] || max;
    const p99 = responseTimes[p99Index] || max;
    
    return { min, max, avg, p95, p99 };
  }

  async getErrorRateStats(timeRange: string = '24h'): Promise<any> {
    const analytics = await this.getApiAnalytics(timeRange);
    
    const errorsByStatus = analytics
      .filter(a => a.statusCode >= 400)
      .reduce((acc, curr) => {
        const status = curr.statusCode.toString();
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const errorsByEndpoint = analytics
      .filter(a => a.statusCode >= 400)
      .reduce((acc, curr) => {
        const endpoint = curr.endpoint;
        acc[endpoint] = (acc[endpoint] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    return {
      errorsByStatus,
      errorsByEndpoint,
      totalErrors: Object.values(errorsByStatus).reduce((sum, count) => sum + count, 0)
    };
  }
  
  // Patient Management methods
  async createPatient(patient: InsertPatient, userId: number, organizationId: number): Promise<Patient> {
    const [newPatient] = await db.insert(patients).values({ ...patient, userId, organizationId }).returning();
    return newPatient;
  }

  async getPatient(id: number, organizationId: number): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    // Only return patient if it belongs to the organization
    return patient && patient.organizationId === organizationId ? patient : undefined;
  }

  async getOrganizationPatients(organizationId: number): Promise<Patient[]> {
    return db.select().from(patients).where(eq(patients.organizationId, organizationId)).orderBy(desc(patients.createdAt));
  }

  async getUserPatients(userId: number): Promise<Patient[]> {
    return db.select().from(patients).where(eq(patients.userId, userId)).orderBy(desc(patients.createdAt));
  }

  async getAllPatients(): Promise<Patient[]> {
    return db.select().from(patients).orderBy(desc(patients.createdAt));
  }

  // Helper function to determine auth status based on auth info
  private determineAuthStatus(patient: Partial<InsertPatient>, existingPatient?: Patient): string {
    // If auth status is being explicitly set, use that
    if (patient.authStatus) {
      return patient.authStatus;
    }

    // Get current or updated values
    const authNumber = patient.authNumber !== undefined ? patient.authNumber : existingPatient?.authNumber;
    const startDate = patient.startDate !== undefined ? patient.startDate : existingPatient?.startDate;
    const endDate = patient.endDate !== undefined ? patient.endDate : existingPatient?.endDate;
    const currentAuthStatus = existingPatient?.authStatus || "Pending Review";

    // Check expiration status if we have an end date
    if (endDate && endDate.trim()) {
      const authEndDate = new Date(endDate);
      const currentDate = new Date();
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(currentDate.getDate() + 7);
      
      // Check if authorization has already expired
      if (authEndDate < currentDate) {
        return "Expired";
      }
      
      // Check if authorization expires within a week
      if (authEndDate <= oneWeekFromNow) {
        return "Needs Renewal";
      }
    }

    // If auth number is provided but no dates, status should be "Approved"
    if (authNumber && authNumber.trim() && (!startDate || !endDate)) {
      // Set schedule status to "Needs Scheduling" when user has auth
      if (!patient.scheduleStatus || patient.scheduleStatus !== "Needs Scheduling") {
        patient.scheduleStatus = "Needs Scheduling";
      }
      return "Approved";
    }

    // If auth number and dates are provided, check expiration status
    if (authNumber && authNumber.trim() && startDate && startDate.trim() && endDate && endDate.trim()) {
      // Expiration logic already handled above, so if we reach here it's valid
      // Set schedule status to "Needs Scheduling" when user has valid auth
      if (!patient.scheduleStatus || patient.scheduleStatus !== "Needs Scheduling") {
        patient.scheduleStatus = "Needs Scheduling";
      }
      return "Approved";
    }

    // If auth number is cleared/removed, reset to pending
    if (patient.authNumber === "" || patient.authNumber === null) {
      return "Pending Review";
    }

    // If only dates are provided without auth number, keep current status but allow "Approved" if was already approved
    if ((startDate && startDate.trim()) || (endDate && endDate.trim())) {
      if (currentAuthStatus === "Approved" || currentAuthStatus === "APT SCHEDULED W/O AUTH") {
        return currentAuthStatus; // Keep existing status
      }
      return "Pending Review"; // Default for partial info
    }

    // No auth info changes, return current status
    return currentAuthStatus;
  }

  async updatePatient(id: number, patient: Partial<InsertPatient>, organizationId: number): Promise<Patient | undefined> {
    // Check if patient belongs to organization first
    const existingPatient = await this.getPatient(id, organizationId);
    if (!existingPatient) return undefined;

    // Auto-determine auth status if auth-related fields are being updated
    const authFieldsBeingUpdated = ['authNumber', 'refNumber', 'startDate', 'endDate'].some(field => 
      patient[field as keyof InsertPatient] !== undefined
    );

    if (authFieldsBeingUpdated && !patient.authStatus) {
      patient.authStatus = this.determineAuthStatus(patient, existingPatient);
    }

    const [updatedPatient] = await db
      .update(patients)
      .set({ ...patient, updatedAt: new Date() })
      .where(eq(patients.id, id))
      .returning();
    return updatedPatient;
  }

  async updatePatientStatus(id: number, status: string, organizationId: number): Promise<Patient | undefined> {
    // Check if patient belongs to organization first
    const existingPatient = await this.getPatient(id, organizationId);
    if (!existingPatient) return undefined;

    const [updatedPatient] = await db
      .update(patients)
      .set({ status, updatedAt: new Date() })
      .where(eq(patients.id, id))
      .returning();
    return updatedPatient;
  }

  async deletePatient(id: number, organizationId: number): Promise<boolean> {
    try {
      // Check if patient belongs to organization first
      const existingPatient = await this.getPatient(id, organizationId);
      if (!existingPatient) return false;

      // Delete related records first (cascade delete)
      await db.delete(patientDocuments).where(eq(patientDocuments.patientId, id));
      await db.delete(appointments).where(eq(appointments.patientId, id));
      await db.delete(automationLogs).where(eq(automationLogs.patientId, id));
      await db.delete(eSignatureForms).where(eq(eSignatureForms.patientId, id));
      
      // Delete the patient record
      await db.delete(patients).where(eq(patients.id, id));
      
      return true;
    } catch (error) {
      console.error('Error deleting patient:', error);
      return false;
    }
  }

  // Patient Documents methods
  async createPatientDocument(document: InsertPatientDocument): Promise<PatientDocument> {
    const [newDocument] = await db.insert(patientDocuments).values(document).returning();
    return newDocument;
  }

  async getPatientDocuments(patientId: number): Promise<PatientDocument[]> {
    return db
      .select()
      .from(patientDocuments)
      .where(eq(patientDocuments.patientId, patientId))
      .orderBy(desc(patientDocuments.createdAt));
  }

  async deletePatientDocument(documentId: number): Promise<boolean> {
    try {
      await db.delete(patientDocuments).where(eq(patientDocuments.id, documentId));
      return true;
    } catch (error) {
      console.error('Error deleting patient document:', error);
      return false;
    }
  }

  // E-Signature Forms methods
  async createESignatureForm(form: InsertESignatureForm): Promise<ESignatureForm> {
    const [newForm] = await db.insert(eSignatureForms).values(form).returning();
    return newForm;
  }

  async getESignatureForm(id: number): Promise<ESignatureForm | undefined> {
    const [form] = await db.select().from(eSignatureForms).where(eq(eSignatureForms.id, id));
    return form;
  }

  async updateESignatureFormEmailStatus(id: number, emailSentTo: string): Promise<ESignatureForm | undefined> {
    const [updatedForm] = await db
      .update(eSignatureForms)
      .set({ emailSent: true, emailSentTo, emailSentAt: new Date() })
      .where(eq(eSignatureForms.id, id))
      .returning();
    return updatedForm;
  }

  // Appointment methods
  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [newAppointment] = await db.insert(appointments).values(appointment).returning();
    return newAppointment;
  }

  async getPatientAppointments(patientId: number): Promise<Appointment[]> {
    return db
      .select()
      .from(appointments)
      .where(eq(appointments.patientId, patientId))
      .orderBy(desc(appointments.createdAt));
  }

  async updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const [updatedAppointment] = await db
      .update(appointments)
      .set({ ...appointment, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    return updatedAppointment;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    try {
      await db.delete(appointments).where(eq(appointments.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting appointment:', error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();
