#!/bin/bash

# Script to create GitHub issues for HIPAA compliance
# Usage: ./create-security-issues.sh

REPO="jeffbander/leqvio-patient-management"

echo "Creating HIPAA Compliance GitHub Issues..."

# Issue 1: HTTPS and Security Headers
gh issue create \
  --repo $REPO \
  --title "[SECURITY] Implement HTTPS and Security Headers" \
  --body "## Priority
P0 - Critical

## Description
Implement HTTPS enforcement and security headers for all application routes.

## Tasks
- [ ] Add helmet middleware for security headers
- [ ] Configure HSTS, CSP, X-Frame-Options
- [ ] Enforce HTTPS redirect in production
- [ ] Configure secure session cookies
- [ ] Add CORS configuration with whitelisted origins

## Files to Modify
- \`server/index.ts\`
- \`server/routes.ts\`
- \`.env.example\`

## Dependencies
\`\`\`json
{
  \"helmet\": \"^7.1.0\",
  \"express-rate-limit\": \"^7.1.5\"
}
\`\`\`

## Success Criteria
- All responses include security headers
- HTTPS enforced in production
- Session cookies marked secure and httpOnly" \
  --label "security,hipaa,priority:critical"

# Issue 2: Audit Logging
gh issue create \
  --repo $REPO \
  --title "[SECURITY] Implement Comprehensive Audit Logging" \
  --body "## Priority
P0 - Critical

## Description
Create audit logging system for all PHI access and modifications.

## Tasks
- [ ] Create audit_logs table in database
- [ ] Add middleware to log all patient data access
- [ ] Log authentication events (login, logout, failed attempts)
- [ ] Log data modifications with before/after values
- [ ] Implement log retention policy (7 years)
- [ ] Add audit log viewer for admins

## Files to Create
- \`server/audit-logger.ts\`
- \`server/middleware/audit.ts\`
- \`shared/schema/audit.ts\`

## Success Criteria
- Every PHI access is logged
- Audit logs are immutable
- Logs retained for 7 years" \
  --label "security,hipaa,priority:critical,compliance"

# Issue 3: File Encryption
gh issue create \
  --repo $REPO \
  --title "[SECURITY] Encrypt File Storage" \
  --body "## Priority
P0 - Critical

## Description
Implement encryption for all uploaded files (insurance cards, documents).

## Tasks
- [ ] Implement AES-256 encryption for file uploads
- [ ] Encrypt existing files in attached_assets/
- [ ] Store encryption keys securely
- [ ] Add decryption for file downloads
- [ ] Update file upload/download endpoints

## Files to Create
- \`server/encryption-service.ts\`
- \`server/file-storage.ts\`

## Success Criteria
- All files encrypted at rest
- Encryption keys properly managed
- No performance degradation" \
  --label "security,hipaa,priority:critical,encryption"

# Issue 4: Session Security
gh issue create \
  --repo $REPO \
  --title "[SECURITY] Implement Session Security" \
  --body "## Priority
P0 - Critical

## Description
Enhance session security with timeout and secure configuration.

## Tasks
- [ ] Implement 15-minute idle timeout
- [ ] Add session regeneration on login
- [ ] Configure secure session cookies
- [ ] Add session invalidation on logout
- [ ] Implement concurrent session limits

## Files to Modify
- \`server/routes.ts\`
- \`server/auth.ts\`
- \`client/src/hooks/useAuth.ts\`

## Success Criteria
- Sessions timeout after 15 minutes idle
- No session hijacking possible
- Secure cookie configuration" \
  --label "security,hipaa,priority:critical,authentication"

# Issue 5: RBAC
gh issue create \
  --repo $REPO \
  --title "[SECURITY] Implement Role-Based Access Control (RBAC)" \
  --body "## Priority
P1 - High

## Description
Add role-based access control system with different permission levels.

## Tasks
- [ ] Create roles table and user_roles junction table
- [ ] Define roles: Admin, Provider, Staff, ReadOnly
- [ ] Add role checking middleware
- [ ] Update API endpoints with role requirements
- [ ] Add role management UI for admins

## Success Criteria
- Users have appropriate roles
- Access restricted by role
- Principle of least privilege enforced" \
  --label "security,hipaa,priority:high,feature"

# Issue 6: Field Encryption
gh issue create \
  --repo $REPO \
  --title "[SECURITY] Add Field-Level Encryption" \
  --body "## Priority
P1 - High

## Description
Implement field-level encryption for sensitive PHI fields.

## Tasks
- [ ] Encrypt SSN, DOB, and other sensitive fields
- [ ] Implement transparent encryption/decryption
- [ ] Add key rotation capability
- [ ] Update search functionality for encrypted fields
- [ ] Create migration script for existing data

## Fields to Encrypt
- \`patients.ssn\`
- \`patients.dateOfBirth\`
- \`patients.primaryInsuranceNumber\`
- \`patients.secondaryInsuranceNumber\`

## Success Criteria
- Sensitive fields encrypted in database
- No performance impact on queries
- Key rotation implemented" \
  --label "security,hipaa,priority:high,encryption,database"

# Issue 7: Rate Limiting
gh issue create \
  --repo $REPO \
  --title "[SECURITY] Implement Rate Limiting and DDoS Protection" \
  --body "## Priority
P1 - High

## Description
Add rate limiting to prevent abuse and protect against DDoS attacks.

## Tasks
- [ ] Implement rate limiting per endpoint
- [ ] Add progressive delays for failed login attempts
- [ ] Implement CAPTCHA after multiple failures
- [ ] Add IP-based blocking for suspicious activity
- [ ] Create monitoring alerts for rate limit violations

## Configuration
\`\`\`javascript
{
  login: \"5 requests per 15 minutes\",
  api: \"100 requests per minute\",
  upload: \"10 requests per hour\"
}
\`\`\`

## Success Criteria
- API abuse prevented
- Brute force attacks blocked
- Legitimate users unaffected" \
  --label "security,hipaa,priority:high,infrastructure"

# Issue 8: DLP
gh issue create \
  --repo $REPO \
  --title "[SECURITY] Implement Data Loss Prevention (DLP)" \
  --body "## Priority
P2 - Medium

## Description
Add DLP measures to prevent unauthorized data exposure.

## Tasks
- [ ] Implement data masking for non-privileged users
- [ ] Add watermarks to downloaded PDFs
- [ ] Prevent copy/paste of sensitive data
- [ ] Add export restrictions
- [ ] Implement screen capture prevention

## Success Criteria
- PHI cannot be exported without authorization
- Data masking works correctly
- Audit trail for all exports" \
  --label "security,hipaa,priority:medium,compliance"

# Issue 9: MFA
gh issue create \
  --repo $REPO \
  --title "[SECURITY] Add Multi-Factor Authentication (MFA)" \
  --body "## Priority
P2 - Medium

## Description
Implement MFA using TOTP (Time-based One-Time Password).

## Tasks
- [ ] Add MFA setup flow
- [ ] Implement TOTP generation and validation
- [ ] Add backup codes
- [ ] Create MFA management UI
- [ ] Add SMS fallback option

## Dependencies
\`\`\`json
{
  \"speakeasy\": \"^2.0.0\",
  \"qrcode\": \"^1.5.3\"
}
\`\`\`

## Success Criteria
- MFA required for all users
- Backup codes available
- Recovery process documented" \
  --label "security,hipaa,priority:medium,authentication,feature"

# Issue 10: Backups
gh issue create \
  --repo $REPO \
  --title "[SECURITY] Implement Automated Backups" \
  --body "## Priority
P2 - Medium

## Description
Set up automated, encrypted backups with point-in-time recovery.

## Tasks
- [ ] Configure daily automated backups
- [ ] Implement backup encryption
- [ ] Set up off-site backup storage
- [ ] Create restoration procedures
- [ ] Test backup restoration regularly

## Success Criteria
- Daily backups running
- Restoration tested successfully
- RTO < 4 hours" \
  --label "security,hipaa,priority:medium,infrastructure,disaster-recovery"

echo "✅ All GitHub issues created successfully!"
echo "View issues at: https://github.com/$REPO/issues"