# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LEQVIO Patient Management System - A HIPAA-compliant healthcare application for managing cardiovascular patients, featuring e-signature workflows, OCR document processing with Mistral AI, and clinical automation.

## Healthcare Application Technical Requirements

This application must follow HIPAA compliance standards and healthcare-specific implementation patterns as detailed below.

### FHIR Resource Management

When working with FHIR resources:
```typescript
// Always validate FHIR resources before processing
import { FhirValidator } from './fhir-validator';

const validateAndProcess = async (resource: any) => {
  const validation = await FhirValidator.validate(resource);
  if (!validation.isValid) {
    throw new Error(`Invalid FHIR resource: ${validation.errors}`);
  }
  // Process validated resource
};
```

### PHI Data Handling Patterns

1. **Encryption at Rest**
   ```typescript
   // All PHI fields must be encrypted before database storage
   const encryptedPatient = {
     ...patientData,
     ssn: await encryptField(patientData.ssn),
     dateOfBirth: await encryptField(patientData.dateOfBirth),
     insuranceNumber: await encryptField(patientData.insuranceNumber)
   };
   ```

2. **Audit Logging**
   ```typescript
   // Log all PHI access with context
   await auditLog.record({
     userId: session.userId,
     action: 'VIEW_PATIENT',
     resourceId: patientId,
     ipAddress: req.ip,
     timestamp: new Date(),
     metadata: { fields: ['ssn', 'dob'] }
   });
   ```

3. **Data Minimization**
   - Only request necessary PHI fields
   - Implement field-level permissions
   - Use data masking for display (e.g., SSN: ***-**-1234)

### Mistral OCR Implementation Details

```typescript
// Mistral OCR API pattern for medical documents
const extractMedicalDocument = async (pdfBuffer: Buffer) => {
  const response = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        document_url: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`
      },
      // Healthcare-specific prompting
      system_prompt: 'Extract medical information preserving all PHI data, diagnosis codes, and clinical notes'
    })
  });
  
  const ocrData = await response.json();
  // Always preserve full document text for audit trail
  return {
    fullText: ocrData.pages.map(p => p.markdown).join('\n'),
    extractedFields: parseHealthcareFields(ocrData),
    confidence: ocrData.confidence
  };
};
```

### Session Management for Healthcare

```typescript
// HIPAA-compliant session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // HTTPS only
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15-minute timeout per HIPAA
  },
  // Auto-logout on idle
  rolling: true
}));
```

### Insurance Verification Patterns

```typescript
// Pattern for insurance eligibility checks
const verifyInsurance = async (patient: Patient) => {
  // Log the verification attempt
  await auditLog.record({ action: 'INSURANCE_VERIFICATION', patientId: patient.id });
  
  // Check primary insurance
  if (patient.primaryInsurance) {
    const eligibility = await checkEligibility({
      payerId: patient.primaryInsurance,
      memberId: patient.primaryInsuranceNumber,
      serviceType: 'LEQVIO_INJECTION'
    });
    
    // Store verification result
    await updatePatient(patient.id, {
      authStatus: eligibility.requiresPriorAuth ? 'Pending Auth' : 'No PA Required',
      authNumber: eligibility.authNumber
    });
  }
};
```

### Document Processing Workflow

1. **Upload**: Encrypt file immediately
2. **OCR Processing**: Use Mistral for extraction
3. **Validation**: Verify extracted data against FHIR schemas
4. **Storage**: Encrypt PHI fields, store full text for audit
5. **Access**: Log all document views/downloads

### Error Handling for Healthcare Context

```typescript
// Never expose PHI in error messages
app.use((err, req, res, next) => {
  // Log full error internally
  logger.error({
    error: err.message,
    stack: err.stack,
    userId: req.session?.userId,
    path: req.path
  });
  
  // Return sanitized error to client
  res.status(err.status || 500).json({
    error: 'An error occurred processing your request',
    reference: generateErrorReference() // For support lookup
  });
});
```

### Rate Limiting for Healthcare APIs

```typescript
import rateLimit from 'express-rate-limit';

// Strict limits for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  // Log blocked attempts
  handler: (req, res) => {
    auditLog.record({
      action: 'RATE_LIMIT_EXCEEDED',
      ipAddress: req.ip,
      endpoint: req.path
    });
    res.status(429).json({ error: 'Too many attempts' });
  }
});

app.use('/api/auth/login', authLimiter);
```

### Data Retention and Purging

```typescript
// Automated PHI retention management
const retentionPolicy = {
  medicalRecords: 7 * 365, // 7 years in days
  auditLogs: 7 * 365,
  tempFiles: 30, // 30 days for temporary uploads
  sessions: 1 // 1 day for expired sessions
};

// Daily cleanup job
cron.schedule('0 2 * * *', async () => {
  await purgeExpiredData(retentionPolicy);
  await auditLog.record({ action: 'DATA_RETENTION_CLEANUP' });
});
```

### Testing Healthcare Features

```typescript
// Test with synthetic PHI only
const testPatient = {
  firstName: 'Test',
  lastName: 'Patient',
  dateOfBirth: '1990-01-01',
  ssn: '000-00-0000', // Never use real SSN in tests
  mrn: 'TEST-' + Date.now()
};

// Ensure test data is clearly marked
if (process.env.NODE_ENV === 'test') {
  db.patients.beforeCreate((patient) => {
    patient.firstName = 'TEST-' + patient.firstName;
  });
}
```

## HIPAA Compliance Checklist

When implementing any feature that handles PHI, ensure:
- [ ] Data is encrypted at rest and in transit
- [ ] All access is logged to audit trail
- [ ] Session timeout is enforced (15 minutes)
- [ ] Rate limiting is applied to prevent abuse
- [ ] Error messages don't expose PHI
- [ ] Test data uses synthetic PHI only
- [ ] Retention policies are enforced
- [ ] Minimum necessary access principle is followed

## Essential Commands

```bash
# Development
npm run dev              # Start development server (http://localhost:3000)
npx kill-port 3000      # Kill existing process on port 3000 (Windows)

# Build & Production
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run db:push         # Apply database schema changes to PostgreSQL

# Type Checking
npm run check           # TypeScript type checking

# Testing - No test framework currently configured
# Tests should be added using Jest or Vitest when needed
```

## Architecture & Key Components

### Stack Overview
- **Frontend**: React + TypeScript with Vite bundler, TanStack Query for data fetching, Tailwind CSS
- **Backend**: Express.js with TypeScript (tsx), PostgreSQL with Drizzle ORM
- **AI Services**: Mistral AI for OCR, OpenAI for fallback extraction
- **Authentication**: Magic links via SendGrid + password auth

### Critical Service Integrations

1. **Mistral OCR API** (`server/mistral-service.ts`)
   - Primary PDF/document extraction service
   - API endpoint: `https://api.mistral.ai/v1/ocr`
   - Falls back to local pdf2json extraction if API fails
   - Returns markdown-formatted text preserving document structure

2. **OpenAI Service** (`server/openai-service.ts`)
   - Fallback for document extraction
   - Insurance card and medical screenshot processing
   - Vision API for image-based extraction

3. **Document Processing Flow**
   - Upload → Async processing → Mistral OCR → Structured data extraction → Database storage
   - Rejection letters preserve full document text in `extractedData` field
   - Documents visible in UI with extracted content

### Database Schema (Drizzle ORM)
- Schema defined in `shared/schema.ts`
- Key tables: `users`, `organizations`, `patients`, `patientDocuments`, `automationLogs`
- Session-based auth with 15-minute timeout for HIPAA compliance
- All PHI data encrypted at rest (PostgreSQL on Neon)

### Security Implementation Status
- HTTPS headers and enforcement (helmet middleware) - PR #13
- Session security with 15-minute timeout
- CORS configuration with origin restrictions
- Pending: Audit logging, field encryption, MFA, rate limiting (see GitHub issues #5-#12)

## HIPAA Compliance Requirements

When implementing features involving PHI:
1. All patient data access must be logged (audit trail pending implementation)
2. Session timeout: 15 minutes (configured)
3. Use secure cookies with httpOnly, secure, sameSite flags
4. Encrypt sensitive fields at rest
5. Implement rate limiting on authentication endpoints

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://...          # Neon PostgreSQL
OPENAI_API_KEY=sk-proj-...            # OpenAI API
MISTRAL_API_KEY=...                   # Mistral AI for OCR
SENDGRID_API_KEY=SG...                # Email service
SESSION_SECRET=...                     # 32+ char random string
NODE_ENV=development|production
```

## API Endpoints Pattern

- `/api/patients/*` - Patient CRUD operations
- `/api/extract-patient-info` - OCR extraction endpoint (uses Mistral)
- `/api/patients/:id/documents` - Document upload with async processing
- `/api/auth/*` - Authentication (magic links + passwords)
- `/webhook/aigents` - External automation integration

## Common Development Tasks

### Adding New Document Types
1. Update `processDocumentAsync()` in `server/routes.ts`
2. Add extraction logic using Mistral service
3. Map extracted fields to patient data
4. Store full text in `extractedData` for visibility

### Modifying Database Schema
1. Edit `shared/schema.ts`
2. Run `npm run db:push` to apply changes
3. Update related TypeScript types

### Working with Mistral OCR
- Always try Mistral first, fallback to OpenAI or local extraction
- Preserve markdown formatting from Mistral response
- Store full document text, not just extracted fields
- Log extraction confidence scores

## Project-Specific Patterns

- Async document processing with status updates
- Automatic patient data updates from insurance cards
- Magic link authentication with SendGrid
- LocalTunnel for webhook development (not ngrok)
- Voice dictation tool at `voice-to-claude-windows.py`

## Active Development Notes

- Server logs appear in terminal, not browser console
- Port 3000 conflicts common - use `npx kill-port 3000`
- Mistral OCR returns `pages` array with `markdown` field per page
- PDF extraction must handle both scanned and text PDFs
- Session timeout (15 min) may require frequent re-authentication during development