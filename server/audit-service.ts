import { db } from "./db";
import { auditLogs } from "@shared/schema";
import type { InsertAuditLog } from "@shared/schema";
import type { Request } from "express";
import { lt } from "drizzle-orm";

export interface AuditContext {
  userId?: number;
  organizationId?: number;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export class AuditLogger {
  private static getClientIp(req: Request): string {
    // Get client IP, considering proxies and load balancers
    return (
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.headers['x-real-ip']?.toString() ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  private static getSessionId(req: Request): string | undefined {
    // Extract session ID from session store
    return req.session?.id || req.sessionID;
  }

  public static extractContext(req: Request): AuditContext {
    return {
      userId: req.session?.userId,
      organizationId: req.session?.organizationId,
      ipAddress: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: this.getSessionId(req),
    };
  }

  public static async log(params: {
    action: string;
    resourceType?: string;
    resourceId?: number;
    details?: Record<string, any>;
    context: AuditContext;
  }): Promise<void> {
    try {
      const auditEntry: InsertAuditLog = {
        userId: params.context.userId,
        organizationId: params.context.organizationId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        details: params.details,
        ipAddress: params.context.ipAddress,
        userAgent: params.context.userAgent,
        sessionId: params.context.sessionId,
        retentionDate: new Date(Date.now() + (7 * 365 * 24 * 60 * 60 * 1000)), // 7 years
      };

      await db.insert(auditLogs).values(auditEntry);
      
      console.log(`[AUDIT] ${params.action}${params.resourceType ? ` on ${params.resourceType}` : ''}${params.resourceId ? ` (ID: ${params.resourceId})` : ''} by user ${params.context.userId || 'anonymous'}`);
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw error to avoid disrupting main application flow
    }
  }

  // Convenience methods for common audit actions
  
  public static async logAuthentication(action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED', context: AuditContext, details?: Record<string, any>): Promise<void> {
    await this.log({
      action,
      resourceType: 'authentication',
      details,
      context,
    });
  }

  public static async logPatientAccess(action: 'VIEW_PATIENT' | 'CREATE_PATIENT' | 'UPDATE_PATIENT' | 'DELETE_PATIENT', patientId: number, context: AuditContext, details?: Record<string, any>): Promise<void> {
    await this.log({
      action,
      resourceType: 'patient',
      resourceId: patientId,
      details: {
        ...details,
        // Log which PHI fields were accessed for VIEW actions
        phiFields: details?.fields || [],
      },
      context,
    });
  }

  public static async logDocumentAccess(action: 'VIEW_DOCUMENT' | 'UPLOAD_DOCUMENT' | 'DELETE_DOCUMENT', documentId: number, patientId: number, context: AuditContext, details?: Record<string, any>): Promise<void> {
    await this.log({
      action,
      resourceType: 'patient_document',
      resourceId: documentId,
      details: {
        ...details,
        patientId,
      },
      context,
    });
  }

  public static async logUserAccess(action: 'VIEW_USER' | 'CREATE_USER' | 'UPDATE_USER' | 'DELETE_USER', userId: number, context: AuditContext, details?: Record<string, any>): Promise<void> {
    await this.log({
      action,
      resourceType: 'user',
      resourceId: userId,
      details,
      context,
    });
  }

  public static async logInsuranceVerification(patientId: number, context: AuditContext, details?: Record<string, any>): Promise<void> {
    await this.log({
      action: 'INSURANCE_VERIFICATION',
      resourceType: 'patient',
      resourceId: patientId,
      details,
      context,
    });
  }

  public static async logDataRetentionCleanup(recordsDeleted: number, context: AuditContext): Promise<void> {
    await this.log({
      action: 'DATA_RETENTION_CLEANUP',
      details: { recordsDeleted },
      context,
    });
  }

  public static async logRateLimitExceeded(endpoint: string, context: AuditContext): Promise<void> {
    await this.log({
      action: 'RATE_LIMIT_EXCEEDED',
      details: { endpoint },
      context,
    });
  }
}

// Data retention cleanup function
export async function cleanupExpiredAuditLogs(): Promise<number> {
  try {
    const result = await db.delete(auditLogs).where(
      lt(auditLogs.retentionDate, new Date())
    );
    
    const deletedCount = Array.isArray(result) ? result.length : (result as any).rowCount || 0;
    console.log(`[AUDIT CLEANUP] Deleted ${deletedCount} expired audit log records`);
    
    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup expired audit logs:', error);
    return 0;
  }
}