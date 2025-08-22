import type { Request, Response, NextFunction } from "express";
import { AuditLogger } from "./audit-service";

// Enhanced request interface for audit tracking
interface AuditRequest extends Request {
  auditContext?: {
    action?: string;
    resourceType?: string;
    resourceId?: number;
    details?: Record<string, any>;
  };
}

// Middleware to automatically log API access
export function auditMiddleware(req: AuditRequest, res: Response, next: NextFunction): void {
  const start = Date.now();
  const context = AuditLogger.extractContext(req);

  // Track response to log successful operations
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    
    // Log the request if it succeeded
    if (res.statusCode < 400 && req.auditContext) {
      AuditLogger.log({
        action: req.auditContext.action || 'API_ACCESS',
        resourceType: req.auditContext.resourceType,
        resourceId: req.auditContext.resourceId,
        details: {
          ...req.auditContext.details,
          duration,
          statusCode: res.statusCode,
          path: req.path,
          method: req.method,
        },
        context,
      }).catch(err => console.error('Audit logging failed:', err));
    }

    return originalSend.call(this, data);
  };

  next();
}

// Helper function to set audit context for specific routes
export function setAuditContext(action: string, resourceType?: string, resourceId?: number, details?: Record<string, any>) {
  return (req: AuditRequest, res: Response, next: NextFunction): void => {
    req.auditContext = {
      action,
      resourceType,
      resourceId,
      details,
    };
    next();
  };
}

// Middleware specifically for patient data access logging
export function auditPatientAccess(req: AuditRequest, res: Response, next: NextFunction): void {
  const patientId = parseInt(req.params.id || req.params.patientId || req.body.patientId);
  
  if (!patientId) {
    return next();
  }

  let action = 'VIEW_PATIENT';
  if (req.method === 'POST') action = 'CREATE_PATIENT';
  else if (req.method === 'PUT' || req.method === 'PATCH') action = 'UPDATE_PATIENT';
  else if (req.method === 'DELETE') action = 'DELETE_PATIENT';

  // Track which PHI fields are being accessed
  const phiFields = extractPhiFieldsFromRequest(req);

  req.auditContext = {
    action,
    resourceType: 'patient',
    resourceId: patientId,
    details: {
      phiFields,
      endpoint: req.path,
    },
  };

  next();
}

// Middleware for document access logging
export function auditDocumentAccess(req: AuditRequest, res: Response, next: NextFunction): void {
  const documentId = parseInt(req.params.documentId);
  const patientId = parseInt(req.params.id || req.params.patientId);
  
  if (!documentId) {
    return next();
  }

  let action = 'VIEW_DOCUMENT';
  if (req.method === 'POST') action = 'UPLOAD_DOCUMENT';
  else if (req.method === 'DELETE') action = 'DELETE_DOCUMENT';

  req.auditContext = {
    action,
    resourceType: 'patient_document',
    resourceId: documentId,
    details: {
      patientId,
      documentType: req.body?.documentType,
      fileName: req.body?.fileName,
    },
  };

  next();
}

// Middleware for authentication event logging
export function auditAuthenticationMiddleware(action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const context = AuditLogger.extractContext(req);
    
    // Log the authentication event
    try {
      await AuditLogger.logAuthentication(action, context, {
        email: req.body?.email, // Only for login attempts
        endpoint: req.path,
      });
    } catch (error) {
      console.error('Failed to log authentication event:', error);
    }

    next();
  };
}

// Helper function to extract PHI fields from request
function extractPhiFieldsFromRequest(req: Request): string[] {
  const phiFields: string[] = [];
  
  // Common PHI fields in patient records
  const possiblePhiFields = [
    'firstName', 'lastName', 'dateOfBirth', 'ssn', 'mrn',
    'email', 'phone', 'address', 
    'primaryInsuranceNumber', 'secondaryInsuranceNumber',
    'leqvioPatientId', 'leqvioCopayIdNumber',
  ];

  // Check if request is accessing these fields
  possiblePhiFields.forEach(field => {
    if (req.body?.[field] !== undefined || req.query?.[field] !== undefined) {
      phiFields.push(field);
    }
  });

  // For GET requests, assume all PHI fields are being accessed
  if (req.method === 'GET' && req.path.includes('/patients/')) {
    phiFields.push(...possiblePhiFields);
  }

  return phiFields;
}

// Rate limiting audit logger
export function auditRateLimitExceeded(req: Request, res: Response): void {
  const context = AuditLogger.extractContext(req);
  AuditLogger.logRateLimitExceeded(req.path, context).catch(err => 
    console.error('Failed to log rate limit exceeded:', err)
  );
}