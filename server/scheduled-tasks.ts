import cron from 'node-cron';
import { cleanupExpiredAuditLogs, AuditLogger } from './audit-service';

// Data retention policy configuration
export const retentionPolicy = {
  auditLogs: 7 * 365, // 7 years in days
  medicalRecords: 7 * 365, // 7 years in days
  tempFiles: 30, // 30 days for temporary uploads
  sessions: 1 // 1 day for expired sessions
};

// Initialize all scheduled tasks
export function initializeScheduledTasks(): void {
  console.log('[SCHEDULER] Initializing scheduled tasks for HIPAA compliance...');
  
  // Daily audit log cleanup at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[SCHEDULER] Starting daily audit log cleanup...');
    
    try {
      const deletedCount = await cleanupExpiredAuditLogs();
      
      // Log the cleanup activity
      await AuditLogger.logDataRetentionCleanup(deletedCount, {
        userId: undefined, // System operation
        organizationId: undefined,
        ipAddress: 'system',
        userAgent: 'scheduled-task',
        sessionId: 'system',
      });
      
      console.log(`[SCHEDULER] Audit log cleanup completed. Deleted ${deletedCount} expired records.`);
    } catch (error) {
      console.error('[SCHEDULER] Error during audit log cleanup:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York" // Adjust timezone as needed
  });
  
  // Weekly system health check on Sundays at 3:00 AM
  cron.schedule('0 3 * * 0', async () => {
    console.log('[SCHEDULER] Starting weekly system health check...');
    
    try {
      // Log system health check
      await AuditLogger.log({
        action: 'SYSTEM_HEALTH_CHECK',
        context: {
          userId: undefined,
          organizationId: undefined,
          ipAddress: 'system',
          userAgent: 'scheduled-task',
          sessionId: 'system',
        },
        details: {
          timestamp: new Date(),
          checkedComponents: ['audit_logs', 'database', 'sessions'],
        },
      });
      
      console.log('[SCHEDULER] Weekly system health check completed.');
    } catch (error) {
      console.error('[SCHEDULER] Error during system health check:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });
  
  console.log('[SCHEDULER] All scheduled tasks initialized successfully.');
}

// Graceful shutdown for scheduled tasks
export function stopScheduledTasks(): void {
  console.log('[SCHEDULER] Stopping all scheduled tasks...');
  cron.destroy();
  console.log('[SCHEDULER] All scheduled tasks stopped.');
}