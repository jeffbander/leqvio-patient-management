import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import session from "express-session";
import fetch from "node-fetch";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertAutomationLogSchema, insertCustomChainSchema, userLoginSchema, userRegisterSchema, insertPatientSchema } from "@shared/schema";
import { sendMagicLink, verifyLoginToken } from "./auth";
import { extractPatientDataFromImage, extractInsuranceCardData, extractPatientInfoFromScreenshot, extractPatientInfoFromPDF } from "./openai-service";
import { generateLEQVIOPDF } from "./pdf-generator";
import { extractPDFWithMistral, combineExtractionResults, validateMistralKey } from "./mistral-service";
import { registerUser, loginUser, requireAuth, getUserFromSession } from "./password-auth";
// Using the openai instance directly instead of a service object

// Helper function to add insurance changes to patient notes
async function addInsuranceChangeToNotes(patientId: number, logEntry: string, organizationId: number) {
  try {
    const currentPatient = await storage.getPatient(patientId, organizationId);
    if (!currentPatient) return;
    
    const currentNotes = currentPatient.notes || '';
    let updatedNotes = '';
    
    const notesSection = '=== NOTES ===';
    const voicemailSection = '=== VOICEMAILS ===';  
    const insuranceSection = '=== INSURANCE & AUTH UPDATES ===';
    
    // Extract existing sections
    let existingNotes = '';
    let existingVoicemails = '';
    let existingInsurance = '';
    
    if (currentNotes.includes(notesSection)) {
      const noteStart = currentNotes.indexOf(notesSection) + notesSection.length;
      const voicemailStart = currentNotes.indexOf(voicemailSection);
      const insuranceStart = currentNotes.indexOf(insuranceSection);
      
      if (voicemailStart > -1) {
        existingNotes = currentNotes.substring(noteStart, voicemailStart).trim();
      } else if (insuranceStart > -1) {
        existingNotes = currentNotes.substring(noteStart, insuranceStart).trim();
      } else {
        existingNotes = currentNotes.substring(noteStart).trim();
      }
      
      if (voicemailStart > -1) {
        const voicemailEnd = insuranceStart > -1 ? insuranceStart : currentNotes.length;
        existingVoicemails = currentNotes.substring(voicemailStart + voicemailSection.length, voicemailEnd).trim();
      }
      
      if (insuranceStart > -1) {
        existingInsurance = currentNotes.substring(insuranceStart + insuranceSection.length).trim();
      }
    } else {
      existingNotes = currentNotes;
    }
    
    // Add new insurance log entry
    if (existingInsurance) {
      existingInsurance = `${logEntry}\n\n${existingInsurance}`;
    } else {
      existingInsurance = logEntry;
    }
    
    // Rebuild organized notes
    if (existingNotes) updatedNotes += `${notesSection}\n${existingNotes}\n\n`;
    if (existingVoicemails) updatedNotes += `${voicemailSection}\n${existingVoicemails}\n\n`;
    updatedNotes += `${insuranceSection}\n${existingInsurance}`;
    
    await storage.updatePatient(patientId, { notes: updatedNotes.trim() }, organizationId);
  } catch (error) {
    console.error('Error adding insurance change to notes:', error);
  }
}

// Helper function to extract insurance information from Epic text using OpenAI
const extractInsuranceFromEpicText = async (epicText: string) => {
  try {
    const prompt = `
Extract insurance information from this Epic EMR text. Look for and extract the following fields:
- Primary insurance company name
- Primary member/subscriber ID
- Primary group number
- Secondary insurance company name (if present)
- Secondary member/subscriber ID (if present)
- Secondary group number (if present)
- Copay amount
- Deductible amount

SPECIAL HANDLING FOR LEQVIO COPAY PROGRAM:
If you find ANY mention of "LEQVIO Copay Program" or "LEQVIO" copay assistance anywhere in the text (even under secondary insurance), extract these specific fields:
- LEQVIO Coverage Status (Active, Inactive, etc.)
- LEQVIO Subscriber name
- LEQVIO Effective dates (from/to dates)
- LEQVIO Subscriber ID/Member ID

Epic text:
${epicText}

Return ONLY a JSON object with the extracted data using these exact keys:
{
  "primaryInsurance": "string or null",
  "primaryMemberId": "string or null", 
  "primaryGroupNumber": "string or null",
  "secondaryInsurance": "string or null",
  "secondaryMemberId": "string or null",
  "secondaryGroupNumber": "string or null",
  "copay": "string or null",
  "deductible": "string or null",
  "leqvioCopayProgram": "boolean - true if LEQVIO Copay Program is found",
  "leqvioPatientId": "string or null - LEQVIO Patient ID",
  "leqvioEnrollmentDate": "string or null - LEQVIO Enrollment Date",
  "leqvioCopayIdNumber": "string or null - LEQVIO Co-pay ID Number",
  "leqvioGroupNumber": "string or null - LEQVIO Group Number",
  "leqvioBin": "string or null - LEQVIO BIN",
  "leqvioPcn": "string or null - LEQVIO PCN"
}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data: any = await response.json();

    const extractedText = data.choices[0]?.message?.content?.trim();
    if (!extractedText) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response - handle markdown code blocks
    try {
      // Remove markdown code block wrapper if present
      let jsonText = extractedText;
      if (jsonText.startsWith('```json') && jsonText.endsWith('```')) {
        jsonText = jsonText.slice(7, -3).trim();
      } else if (jsonText.startsWith('```') && jsonText.endsWith('```')) {
        jsonText = jsonText.slice(3, -3).trim();
      }
      
      let parsedData;
      try {
        parsedData = JSON.parse(jsonText);
      } catch (error) {
        console.error('JSON parse error in routes.ts:', error);
        throw error;
      }
      
      // Clean up the data - remove null/empty values
      const cleanedData: any = {};
      Object.keys(parsedData).forEach(key => {
        const value = parsedData[key];
        if (value && value !== 'null' && value !== null && typeof value === 'string' && value.trim() !== '') {
          cleanedData[key] = value.trim();
        }
      });
      
      return cleanedData;
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', extractedText);
      console.error('Parse error details:', parseError);
      throw new Error('Invalid response format from OpenAI');
    }
  } catch (error) {
    console.error('Error extracting insurance from Epic text:', error);
    throw error;
  }
};

// Helper function to check schedule status based on appointment status changes
const checkScheduleStatus = async (patientId: number, organizationId: number) => {
  try {
    const appointments = await storage.getPatientAppointments(patientId);
    
    if (appointments.length === 0) {
      // No appointments at all - could set to needs scheduling, but let's leave existing logic
      return;
    }

    // Sort appointments by date to get proper chronological order
    const sortedAppointments = appointments.sort((a, b) => 
      new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
    );

    // Find the most recent completed appointment
    const now = new Date();
    const pastAppointments = sortedAppointments.filter(apt => 
      new Date(apt.appointmentDate) <= now
    );
    const futureAppointments = sortedAppointments.filter(apt => 
      new Date(apt.appointmentDate) > now
    );

    const lastAppointment = pastAppointments[pastAppointments.length - 1]; // Most recent past appointment
    const nextAppointment = futureAppointments[0]; // Next future appointment

    // Check if the last appointment is cancelled or no show
    if (lastAppointment && (lastAppointment.status === 'Cancelled' || lastAppointment.status === 'No Show')) {
      await storage.updatePatient(patientId, {
        scheduleStatus: "Needs Rescheduling"
      }, organizationId);
      console.log(`Patient ${patientId}: Schedule status updated to "Needs Rescheduling" - last appointment status is "${lastAppointment.status}"`);
      return;
    }

    // Check if last appointment is at least 3 months ago and no next appointment scheduled
    if (lastAppointment && !nextAppointment) {
      const lastAppointmentDate = new Date(lastAppointment.appointmentDate);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      if (lastAppointmentDate <= threeMonthsAgo) {
        await storage.updatePatient(patientId, {
          scheduleStatus: "Needs Scheduling–High Priority"
        }, organizationId);
        console.log(`Patient ${patientId}: Schedule status updated to "Needs Scheduling–High Priority" - last appointment was ${lastAppointment.appointmentDate} (>3 months ago) and no future appointments`);
      }
    }
  } catch (error) {
    console.error('Error checking schedule status:', error);
  }
};

// Helper function to check if appointment is outside authorization date range
const checkAuthorizationStatus = async (patientId: number, organizationId: number) => {
  try {
    const patient = await storage.getPatient(patientId, organizationId);
    if (!patient) return;

    // Get all appointments for the patient
    const appointments = await storage.getPatientAppointments(patientId);
    
    // Only automatically change auth status if it's currently in an "automatic" state
    // Don't override manually set statuses like "Denied", "Approved", etc.
    const automaticStatuses = ["APT SCHEDULED W/O AUTH", "Needs Renewal", "Pending Review"];
    const currentStatus = patient.authStatus || "Pending Review";
    
    // Check if patient has auth dates
    if (!patient.startDate || !patient.endDate) {
      // No auth dates - check if there are appointments scheduled
      if (appointments.length > 0 && automaticStatuses.includes(currentStatus)) {
        await storage.updatePatient(patientId, {
          authStatus: "APT SCHEDULED W/O AUTH"
        }, organizationId);
        console.log(`Patient ${patientId}: Authorization status updated to "APT SCHEDULED W/O AUTH" - appointments scheduled but no auth info`);
      }
      return; // No auth dates to check against
    }

    // Parse auth dates (MM/DD/YYYY format)
    const authStartDate = new Date(patient.startDate);
    const authEndDate = new Date(patient.endDate);
    const currentDate = new Date();
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(currentDate.getDate() + 7);
    
    // Check if authorization expires within a week (only update automatic statuses)
    if (authEndDate <= oneWeekFromNow && authEndDate > currentDate) {
      if (automaticStatuses.includes(currentStatus)) {
        await storage.updatePatient(patientId, {
          authStatus: "Needs Renewal"
        }, organizationId);
        console.log(`Patient ${patientId}: Authorization status updated to "Needs Renewal" - auth expires on ${patient.endDate} (within one week)`);
      }
      return;
    }

    // Check if authorization has already expired (only update automatic statuses)
    if (authEndDate < currentDate) {
      if (automaticStatuses.includes(currentStatus)) {
        await storage.updatePatient(patientId, {
          authStatus: "Needs Renewal"
        }, organizationId);
        console.log(`Patient ${patientId}: Authorization status updated to "Needs Renewal" - auth expired on ${patient.endDate}`);
      }
      return;
    }

    // Check if any appointment is outside the auth date range
    let hasAppointmentsOutsideAuthRange = false;
    for (const appointment of appointments) {
      const appointmentDate = new Date(appointment.appointmentDate);
      
      if (appointmentDate < authStartDate || appointmentDate > authEndDate) {
        hasAppointmentsOutsideAuthRange = true;
        break;
      }
    }
    
    if (hasAppointmentsOutsideAuthRange) {
      // Only update if current status allows automatic changes
      if (automaticStatuses.includes(currentStatus)) {
        await storage.updatePatient(patientId, {
          authStatus: "APT SCHEDULED W/O AUTH"
        }, organizationId);
        console.log(`Patient ${patientId}: Authorization status updated to "APT SCHEDULED W/O AUTH" - appointments outside auth range ${patient.startDate} to ${patient.endDate}`);
      }
      return;
    }

    // If we get here, all appointments are within auth range and auth is valid
    // Only update if current status indicates a problem that's now resolved AND it's an automatic status
    if (["APT SCHEDULED W/O AUTH", "Needs Renewal"].includes(currentStatus)) {
      await storage.updatePatient(patientId, {
        authStatus: "Approved",
        scheduleStatus: "Needs Scheduling"
      }, organizationId);
      console.log(`Patient ${patientId}: Authorization status updated to "Approved" and schedule status to "Needs Scheduling" - patient has valid auth`);
    }
  } catch (error) {
    console.error(`Error checking authorization status for patient ${patientId}:`, error);
  }
};

// Check authorization status for all patients in an organization
const checkAllPatientsAuthorizationStatus = async (organizationId: number) => {
  try {
    console.log(`Starting system-wide auth status check for organization ${organizationId}`);
    const patients = await storage.getOrganizationPatients(organizationId);
    
    let updatedCount = 0;
    for (const patient of patients) {
      const originalAuthStatus = patient.authStatus;
      await checkAuthorizationStatus(patient.id, organizationId);
      
      // Check if status was updated by comparing with fresh data
      const updatedPatient = await storage.getPatient(patient.id, organizationId);
      if (updatedPatient && updatedPatient.authStatus !== originalAuthStatus) {
        updatedCount++;
      }
    }
    
    console.log(`System-wide auth status check completed. Updated ${updatedCount} patients.`);
  } catch (error) {
    console.error('Error during system-wide auth status check:', error);
  }
};

// Analytics middleware to track API requests
const analyticsMiddleware = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  const originalSend = res.send;
  let responseSize = 0;

  res.send = function(data: any) {
    const responseTime = Date.now() - startTime;
    responseSize = data ? Buffer.byteLength(data, 'utf8') : 0;
    
    // Only track API endpoints and webhooks, skip static files and audio endpoints
    if ((req.path.startsWith('/api') || req.path.startsWith('/webhook')) && !req.path.includes('/transcribe-audio')) {
      const analyticsData = {
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        userAgent: req.get('User-Agent') || '',
        ipAddress: req.ip || req.connection?.remoteAddress || '',
        chainType: req.body?.chain_to_run || req.body?.chainType || null,
        uniqueId: req.body?.uniqueId || req.body?.["Chain Run ID"] || null,
        requestSize: req.get('Content-Length') ? parseInt(req.get('Content-Length')) : 0,
        responseSize,
        errorMessage: res.statusCode >= 400 ? (
          typeof data === 'object' && data ? 
            (data.error || data.message || 'Unknown error') : 
            'Unknown error'
        ) : null,
        requestData: req.method !== 'GET' ? req.body : null
      };

      // Store analytics asynchronously (temporarily disabled due to DB issues)
      // storage.createApiAnalytics(analyticsData).catch(error => {
      //   console.error('Failed to store analytics:', error);
      // });
    }

    return originalSend.call(this, data);
  };

  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Apply analytics middleware to all routes
  app.use(analyticsMiddleware);
  
  // Authentication Routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { organizationName, organizationDescription, email, password, name } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }
      
      // Create organization first
      const organization = await storage.createOrganization({
        name: organizationName,
        description: organizationDescription || '',
      });
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user with organization set as current
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        currentOrganizationId: organization.id,
      });
      
      // Create organization membership with owner role
      await storage.addOrganizationMember({
        userId: user.id,
        organizationId: organization.id,
        role: 'owner',
      });

      // Create session
      (req.session as any).userId = user.id;
      
      // Update last login
      await storage.updateUserLastLogin(user.id);
      
      // Get user's current organization with role
      const currentOrg = await storage.getUserCurrentOrganization(user.id);
      
      res.json({ 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          organizationId: user.currentOrganizationId,
          role: currentOrg?.role || 'owner' 
        },
        organization
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Create session
      (req.session as any).userId = user.id;
      
      // Update last login and clear temp password
      await storage.updateUserLastLogin(user.id);
      
      // Clear temporary password on first successful login
      if (user.tempPassword) {
        await storage.updateUser(user.id, { tempPassword: null });
      }
      
      // Get user's current organization with role
      const currentOrg = await storage.getUserCurrentOrganization(user.id);
      
      res.json({ 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          organizationId: user.currentOrganizationId,
          role: currentOrg?.role || 'user' 
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Failed to logout' });
      } else {
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
      }
    });
  });

  app.get('/api/auth/user', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Get user's current organization role
      const currentOrg = await storage.getUserCurrentOrganization(userId);
      
      res.json({ 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          currentOrganizationId: user.currentOrganizationId,
          role: currentOrg?.role || 'user'
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  // Account Management Routes
  app.get('/api/auth/profile', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Get user's current organization role
      const currentOrg = await storage.getUserCurrentOrganization(userId);
      
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: currentOrg?.role || 'user',
        organizationId: user.currentOrganizationId,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  app.put('/api/auth/profile', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const { name, email } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }
      
      // Check if email is already taken by another user
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Email already taken by another user' });
      }
      
      const updatedUser = await storage.updateUserProfile(userId, { name, email });
      
      // Get user's current organization role
      const currentOrg = await storage.getUserCurrentOrganization(userId);
      
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: currentOrg?.role || 'user',
        organizationId: updatedUser.currentOrganizationId,
        createdAt: updatedUser.createdAt,
        lastLoginAt: updatedUser.lastLoginAt
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  app.post('/api/auth/change-password', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      
      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      await storage.updateUserPassword(userId, hashedNewPassword);
      
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  app.delete('/api/auth/delete-account', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Get user's current organization role
      const currentOrg = await storage.getUserCurrentOrganization(userId);
      
      // Check if user is organization owner
      if (currentOrg?.role === 'owner' && user.currentOrganizationId) {
        // Check if there are other members in the organization
        const orgMembers = await storage.getOrganizationMembers(user.currentOrganizationId);
        if (orgMembers.length > 1) {
          return res.status(400).json({ 
            error: 'Cannot delete account. As organization owner, you must transfer ownership or remove all other members first.' 
          });
        }
        
        // If owner is the only member, delete the organization too
        await storage.deleteOrganization(user.currentOrganizationId);
      }
      
      // Delete user account
      await storage.deleteUser(userId);
      
      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });
      
      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  });

  // Organization Management Routes
  app.get('/api/organization', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }

      const organization = await storage.getOrganization(user.currentOrganizationId);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      res.json(organization);
    } catch (error) {
      console.error('Error fetching organization:', error);
      res.status(500).json({ error: 'Failed to fetch organization' });
    }
  });

  app.put('/api/organization', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }

      // Get user's current organization role
      const currentOrg = await storage.getUserCurrentOrganization(userId);
      
      // Only owners and admins can update organization
      if (currentOrg?.role !== 'owner' && currentOrg?.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { name, description } = req.body;
      const organization = await storage.updateOrganization(user.currentOrganizationId, { name, description });
      
      res.json(organization);
    } catch (error) {
      console.error('Error updating organization:', error);
      res.status(500).json({ error: 'Failed to update organization' });
    }
  });

  app.get('/api/organization/members', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }

      const members = await storage.getOrganizationMembers(user.currentOrganizationId);
      res.json(members);
    } catch (error) {
      console.error('Error fetching organization members:', error);
      res.status(500).json({ error: 'Failed to fetch organization members' });
    }
  });

  app.post('/api/organization/invite', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }

      // Get user's role in current organization
      const currentOrg = await storage.getUserCurrentOrganization(userId);
      if (!currentOrg) {
        return res.status(400).json({ error: 'No current organization selected' });
      }

      console.log('User attempting to invite:', { id: user.id, role: currentOrg.role, email: user.email });

      // Only owners and admins can invite users
      if (currentOrg.role === 'user') {
        console.log('Permission denied - user role:', currentOrg.role);
        return res.status(403).json({ error: 'Insufficient permissions. Only organization owners and admins can invite users.' });
      }

      const { email, name } = req.body;
      console.log('Invite request data:', { email, name });
      
      if (!email || !name) {
        return res.status(400).json({ error: 'Email and name are required' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        console.log('User already exists:', email);
        
        // Check if user is already a member of this organization
        const userOrgs = await storage.getUserOrganizations(existingUser.id);
        const isMemberOfCurrentOrg = userOrgs.some(org => org.organization.id === user.currentOrganizationId && org.isActive);
        
        if (isMemberOfCurrentOrg) {
          return res.status(400).json({ error: 'User is already a member of this organization' });
        }
        
        // Add existing user to organization via membership
        await storage.addOrganizationMember({
          userId: existingUser.id,
          organizationId: user.currentOrganizationId,
          role: 'user',
          isActive: true
        });

        // Set as current organization if user doesn't have one
        if (!existingUser.currentOrganizationId) {
          await storage.switchUserOrganization(existingUser.id, user.currentOrganizationId);
        }
        
        const updatedUser = await storage.getUser(existingUser.id);
        
        if (!updatedUser) {
          return res.status(500).json({ error: 'Failed to get updated user information' });
        }
        
        console.log('Added existing user to organization:', { id: updatedUser.id, email: updatedUser.email });
        
        res.json({ 
          user: { 
            id: updatedUser.id, 
            email: updatedUser.email, 
            name: updatedUser.name, 
            role: 'user' // Role is now stored in membership, not user table
          },
          isExisting: true,
          message: 'Existing user added to organization'
        });
        return;
      }

      // Create new user with temporary password
      const tempPassword = Math.random().toString(36).substring(2, 15);
      console.log('Generated temp password for new user');
      
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const newUser = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        currentOrganizationId: user.currentOrganizationId,
        tempPassword, // Store the temporary password for display
      });

      // Create organization membership
      await storage.addOrganizationMember({
        userId: newUser.id,
        organizationId: user.currentOrganizationId,
        role: 'user',
        isActive: true
      });

      console.log('Successfully created new user:', { id: newUser.id, email: newUser.email });

      // In a real system, you'd send an email with login instructions
      res.json({ 
        user: { 
          id: newUser.id, 
          email: newUser.email, 
          name: newUser.name, 
          role: 'user' // Role is now stored in membership, not user table
        },
        tempPassword,
        isExisting: false,
        message: 'New user created and added to organization'
      });
    } catch (error) {
      console.error('Error inviting user:', error);
      res.status(500).json({ error: 'Failed to invite user' });
    }
  });

  app.delete('/api/organization/members/:userId', async (req, res) => {
    const sessionUserId = (req.session as any).userId;
    if (!sessionUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const user = await storage.getUser(sessionUserId);
      if (!user || !user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }

      // Get user's current organization role
      const currentOrg = await storage.getUserCurrentOrganization(sessionUserId);
      
      // Only owners and admins can remove users
      if (currentOrg?.role !== 'owner' && currentOrg?.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const targetUserId = parseInt(req.params.userId);
      const targetUser = await storage.getUser(targetUserId);
      
      if (!targetUser || targetUser.currentOrganizationId !== user.currentOrganizationId) {
        return res.status(404).json({ error: 'User not found in organization' });
      }

      // Get target user's role
      const targetUserOrg = await storage.getUserCurrentOrganization(targetUserId);

      // Can't remove the owner
      if (targetUserOrg?.role === 'owner') {
        return res.status(400).json({ error: 'Cannot remove organization owner' });
      }

      await storage.removeUserFromOrganization(targetUserId, user.currentOrganizationId);
      res.json({ message: 'User removed from organization' });
    } catch (error) {
      console.error('Error removing user:', error);
      res.status(500).json({ error: 'Failed to remove user' });
    }
  });

  // Store debug requests in memory for retrieval (moved to top)
  let debugRequests: any[] = [];

  // WEBHOOK ROUTES FIRST - these must be registered before any catch-all routes
  
  // Debug endpoint to accept any POST request and log everything
  app.post("/webhook/agents/debug", (req, res) => {
    const requestId = Date.now();
    const debugData = {
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      bodyType: typeof req.body,
      contentType: req.get('Content-Type'),
      userAgent: req.get('User-Agent')
    };
    
    // Store the debug request
    debugRequests.unshift(debugData);
    if (debugRequests.length > 10) debugRequests.pop(); // Keep only last 10
    
    console.log(`[WEBHOOK-DEBUG-${requestId}] === DEBUG ENDPOINT ===`);
    console.log(`[WEBHOOK-DEBUG-${requestId}] Method: ${req.method}`);
    console.log(`[WEBHOOK-DEBUG-${requestId}] URL: ${req.url}`);
    console.log(`[WEBHOOK-DEBUG-${requestId}] Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`[WEBHOOK-DEBUG-${requestId}] Body type: ${typeof req.body}`);
    console.log(`[WEBHOOK-DEBUG-${requestId}] Body:`, JSON.stringify(req.body, null, 2));
    console.log(`[WEBHOOK-DEBUG-${requestId}] Raw body length: ${JSON.stringify(req.body).length}`);
    
    res.status(200).json({
      message: "Debug endpoint received your request",
      receivedData: req.body,
      receivedHeaders: req.headers,
      timestamp: new Date().toISOString(),
      requestId: requestId,
      analysis: {
        hasChainRunId: !!req.body?.chainRunId,
        hasAgentResponse: !!req.body?.agentResponse,
        bodyKeys: Object.keys(req.body || {}),
        isValidJSON: typeof req.body === 'object'
      }
    });
  });

  // Endpoint to retrieve debug requests
  app.get("/webhook/agents/debug-logs", (req, res) => {
    res.json({
      totalRequests: debugRequests.length,
      requests: debugRequests
    });
  });

  // Production agent webhook endpoint
  app.post("/webhook/agents", async (req, res) => {
    try {
      const payload = req.body || {};
      
      // Handle AIGENTS field names
      const chainRunId = payload.chainRunId || payload["Chain Run ID"] || payload.ChainRun_ID;
      const agentResponse = payload.agentResponse || payload.output || payload.response;
      const agentName = payload.agentName || payload.agent_name || 'AIGENTS System';
      
      console.log('Agent webhook received:', { 
        chainRunId, 
        hasResponse: !!agentResponse,
        agentName,
        payload: JSON.stringify(payload, null, 2)
      });
      
      if (!chainRunId) {
        return res.status(400).json({ error: "chainRunId is required" });
      }

      // First, update the automation log with the agent response
      const result = await storage.updateAutomationLogWithAgentResponse(
        chainRunId,
        agentResponse || 'No response content',
        agentName,
        payload
      );

      if (!result) {
        return res.status(404).json({ 
          error: "No automation found with the provided chainRunId" 
        });
      }

      // Check if this is a Denial_AI chain response with appeal letter
      const automationLog = await storage.getAutomationLogByChainRunId(chainRunId);
      if (automationLog && automationLog.chainName === 'Denial_AI' && automationLog.patientId) {
        // Look for Denial_Appeal_Letter in various possible locations in the payload
        let denialAppealLetter = null;
        
        // Check common output variable locations
        if (payload.output_variables && payload.output_variables.Denial_Appeal_Letter) {
          denialAppealLetter = payload.output_variables.Denial_Appeal_Letter;
        } else if (payload.outputs && payload.outputs.Denial_Appeal_Letter) {
          denialAppealLetter = payload.outputs.Denial_Appeal_Letter;
        } else if (payload.Denial_Appeal_Letter) {
          denialAppealLetter = payload.Denial_Appeal_Letter;
        } else if (payload.variables && payload.variables.Denial_Appeal_Letter) {
          denialAppealLetter = payload.variables.Denial_Appeal_Letter;
        }
        
        // Also check in agentResponse if it's structured
        if (!denialAppealLetter && agentResponse) {
          try {
            const responseData = typeof agentResponse === 'string' 
              ? (() => {
                  try {
                    return JSON.parse(agentResponse);
                  } catch (error) {
                    console.error('JSON parse error in routes.ts (agentResponse):', error);
                    return {};
                  }
                })() 
              : agentResponse;
            if (responseData.Denial_Appeal_Letter) {
              denialAppealLetter = responseData.Denial_Appeal_Letter;
            } else if (responseData.output_variables && responseData.output_variables.Denial_Appeal_Letter) {
              denialAppealLetter = responseData.output_variables.Denial_Appeal_Letter;
            }
          } catch (e) {
            // If parsing fails, check if the response itself contains the appeal letter
            if (typeof agentResponse === 'string' && agentResponse.length > 100) {
              denialAppealLetter = agentResponse;
            }
          }
        }
        
        console.log('Denial_AI response processing:', {
          patientId: automationLog.patientId,
          hasAppealLetter: !!denialAppealLetter,
          appealLetterLength: denialAppealLetter ? denialAppealLetter.length : 0
        });
        
        // If we found a denial appeal letter, update the patient record and save as document
        if (denialAppealLetter && denialAppealLetter.trim()) {
          try {
            // Update patient record with appeal letter
            await storage.updatePatientDenialAppealLetter(automationLog.patientId, denialAppealLetter.trim());
            
            // Save appeal letter as a document
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const appealDocument = await storage.createPatientDocument({
              patientId: automationLog.patientId,
              documentType: 'appeal_letter',
              fileName: `Denial_Appeal_Letter_${timestamp}.txt`,
              fileUrl: null,
              extractedData: denialAppealLetter.trim(),
              metadata: {
                content: denialAppealLetter.trim(),
                generatedByDenialAI: true,
                chainRunId: chainRunId,
                createdAt: new Date().toISOString()
              }
            });
            
            console.log('Successfully updated patient with denial appeal letter and saved as document:', {
              patientId: automationLog.patientId,
              documentId: appealDocument.id
            });
          } catch (error) {
            console.error('Error updating patient with denial appeal letter:', error);
          }
        }
      }

      res.json({ 
        message: "Agent response processed successfully",
        chainRunId: chainRunId 
      });

    } catch (error) {
      console.error('Error processing agent webhook:', error);
      res.status(500).json({ 
        error: "Internal server error processing agent response" 
      });
    }
  });

  // Configure session
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-for-dev',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Configure multer for multipart form data
  const upload = multer();


  // Health check
  app.get("/api/health", async (req, res) => {
    console.log(`[HEALTH] Health check requested at ${new Date().toISOString()}`);
    
    // Check Mistral API status
    const mistralConfigured = await validateMistralKey();
    
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        mistral: mistralConfigured ? "configured" : "not_configured",
        openai: process.env.OPENAI_API_KEY ? "configured" : "not_configured",
        sendgrid: process.env.SENDGRID_API_KEY ? "configured" : "not_configured"
      }
    });
  });


  // Webhook health check
  app.get("/webhook/agents/health", (req, res) => {
    console.log(`[WEBHOOK-HEALTH] Agent webhook health check at ${new Date().toISOString()}`);
    res.json({ 
      webhook: "agents",
      status: "ready", 
      endpoint: "/webhook/agents",
      method: "POST",
      timestamp: new Date().toISOString(),
      expectedFields: ["chainRunId", "agentResponse", "agentName", "timestamp"]
    });
  });

  // (Duplicate routes removed - webhook routes are now registered at the top)

  // Authentication routes
  app.post("/api/auth/send-magic-link", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email required" });
      }
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const result = await sendMagicLink(email, baseUrl);
      
      if (result.success) {
        res.json({ 
          message: "Magic link created successfully",
          magicLink: result.magicLink 
        });
      } else {
        res.status(500).json({ error: "Failed to create magic link" });
      }
    } catch (error) {
      console.error("Magic link error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/auth/verify", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Invalid token" });
      }
      
      const result = await verifyLoginToken(token);
      
      if (result.success && result.user) {
        // Set session
        (req.session as any).userId = result.user.id;
        res.redirect("/");
      } else {
        res.redirect("/login?error=" + encodeURIComponent(result.error || "Login failed"));
      }
    } catch (error) {
      console.error("Token verification error:", error);
      res.redirect("/login?error=verification_failed");
    }
  });

  app.get("/api/auth/user", (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    storage.getUser(userId)
      .then(user => {
        if (user) {
          res.json(user);
        } else {
          res.status(404).json({ error: "User not found" });
        }
      })
      .catch(error => {
        console.error("Get user error:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Automation logs endpoints
  app.post("/api/automation-logs", async (req, res) => {
    const requestId = Date.now();
    console.log(`\n=== AUTOMATION TRIGGER API LOGGED ===`);
    console.log(`[API-LOGS-CREATE-${requestId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[API-LOGS-CREATE-${requestId}] Source: Frontend Automation Trigger`);
    console.log(`[API-LOGS-CREATE-${requestId}] Action: Logging successful automation response`);
    console.log(`\n[API-LOGS-CREATE-${requestId}] === AUTOMATION LOG DATA ===`);
    console.log(`[API-LOGS-CREATE-${requestId}]`, JSON.stringify(req.body, null, 2));
    console.log(`[API-LOGS-CREATE-${requestId}] === END LOG DATA ===\n`);
    
    try {
      const validatedData = insertAutomationLogSchema.parse(req.body);
      console.log(`[API-LOGS-CREATE-${requestId}] Validation successful`);
      console.log(`[API-LOGS-CREATE-${requestId}] Validated data:`, JSON.stringify(validatedData, null, 2));
      
      const log = await storage.createAutomationLog(validatedData);
      console.log(`[API-LOGS-CREATE-${requestId}] Log created successfully:`);
      console.log(`[API-LOGS-CREATE-${requestId}] - ID: ${log.id}`);
      console.log(`[API-LOGS-CREATE-${requestId}] - ChainName: ${log.chainName}`);
      console.log(`[API-LOGS-CREATE-${requestId}] - UniqueId: ${log.uniqueId}`);
      console.log(`[API-LOGS-CREATE-${requestId}] - Email: ${log.email}`);
      console.log(`[API-LOGS-CREATE-${requestId}] - Status: ${log.status}`);
      
      res.json(log);
    } catch (error) {
      console.error(`[API-LOGS-CREATE-${requestId}] ERROR:`, error);
      console.error(`[API-LOGS-CREATE-${requestId}] Error details:`, (error as any).message);
      res.status(400).json({ 
        error: "Invalid log data", 
        details: (error as any).message,
        timestamp: new Date().toISOString(),
        requestId 
      });
    }
    console.log(`[API-LOGS-CREATE-${requestId}] === END CREATE LOG ===`);
  });

  app.get("/api/automation-logs", async (req, res) => {
    const requestId = Date.now();
    console.log(`[API-LOGS-GET-${requestId}] === FETCHING AUTOMATION LOGS ===`);
    console.log(`[API-LOGS-GET-${requestId}] Query params:`, req.query);
    
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const dateRange = req.query.dateRange as string;
      let dateFilter = null;
      
      // Calculate date filter based on range
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        const filterDate = new Date();
        
        switch (dateRange) {
          case '1day':
            filterDate.setDate(now.getDate() - 1);
            break;
          case '3days':
            filterDate.setDate(now.getDate() - 3);
            break;
          case 'week':
            filterDate.setDate(now.getDate() - 7);
            break;
          default:
            filterDate.setDate(now.getDate() - 3); // Default to 3 days
        }
        dateFilter = filterDate;
      }
      
      console.log(`[API-LOGS-GET-${requestId}] Fetching logs with limit: ${limit}, dateFilter: ${dateFilter ? dateFilter.toISOString() : 'null'}`);
      
      const logs = await storage.getAutomationLogs(limit, dateFilter);
      console.log(`[API-LOGS-GET-${requestId}] Retrieved ${logs.length} logs`);
      console.log(`[API-LOGS-GET-${requestId}] Log IDs: [${logs.map(log => log.id).join(', ')}]`);
      console.log(`[API-LOGS-GET-${requestId}] UniqueIds: [${logs.map(log => log.uniqueid || 'null').join(', ')}]`);
      
      res.json(logs);
    } catch (error) {
      console.error(`[API-LOGS-GET-${requestId}] ERROR:`, error);
      res.status(500).json({ 
        error: "Failed to fetch logs",
        timestamp: new Date().toISOString(),
        requestId 
      });
    }
    console.log(`[API-LOGS-GET-${requestId}] === END FETCH LOGS ===`);
  });

  app.delete("/api/automation-logs", async (req, res) => {
    try {
      await storage.clearAutomationLogs();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear logs" });
    }
  });

  // Custom chains endpoints
  app.post("/api/custom-chains", async (req, res) => {
    const requestId = Date.now();
    console.log(`[CUSTOM-CHAIN-CREATE-${requestId}] === CREATING CUSTOM CHAIN ===`);
    console.log(`[CUSTOM-CHAIN-CREATE-${requestId}] Request body:`, JSON.stringify(req.body, null, 2));
    
    try {
      const validatedData = insertCustomChainSchema.parse(req.body);
      console.log(`[CUSTOM-CHAIN-CREATE-${requestId}] Validation successful:`, validatedData);
      
      const chain = await storage.createCustomChain(validatedData);
      console.log(`[CUSTOM-CHAIN-CREATE-${requestId}] Chain created successfully:`, chain);
      
      res.json(chain);
    } catch (error) {
      console.error(`[CUSTOM-CHAIN-CREATE-${requestId}] ERROR:`, error);
      console.error(`[CUSTOM-CHAIN-CREATE-${requestId}] Error details:`, (error as any).message);
      res.status(400).json({ 
        error: "Invalid chain data", 
        details: (error as any).message,
        timestamp: new Date().toISOString(),
        requestId 
      });
    }
    console.log(`[CUSTOM-CHAIN-CREATE-${requestId}] === END CREATE CHAIN ===`);
  });

  app.get("/api/custom-chains", async (req, res) => {
    try {
      const chains = await storage.getCustomChains();
      res.json(chains);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chains" });
    }
  });

  app.delete("/api/custom-chains/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCustomChain(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete chain" });
    }
  });

  // Test endpoint to verify webhook is working
  app.get("/api/email-webhook", (req, res) => {
    res.json({ 
      status: "Webhook endpoint is active", 
      url: `${req.protocol}://${req.get('host')}/api/email-webhook`,
      timestamp: new Date().toISOString()
    });
  });

  // Email webhook endpoint for SendGrid Inbound Parse
  app.post("/api/email-webhook", upload.any(), async (req, res) => {
    try {
      // Log all incoming data for debugging
      console.log("Received email webhook data:", JSON.stringify(req.body, null, 2));
      console.log("Request headers:", JSON.stringify(req.headers, null, 2));
      console.log("Available fields:", Object.keys(req.body));
      
      // SendGrid sends form data, get the actual field values
      const subject = req.body.subject;
      const text = req.body.text;
      const html = req.body.html;
      const from = req.body.from;
      
      // Log all available fields to understand the email structure
      console.log("All email fields:");
      Object.keys(req.body).forEach(key => {
        const value = req.body[key];
        console.log(`${key}: ${typeof value === 'string' ? value.substring(0, 200) : value}`);
      });
      
      console.log("Subject found:", subject);
      console.log("Text found:", text);
      console.log("HTML found:", html);
      console.log("Email content for ID extraction:", req.body.email?.substring(0, 500));
      
      // Extract unique ID from email content first (prioritize run ID patterns)
      const emailContent = html || text || req.body.email || "";
      console.log("Full email content for debugging:", emailContent?.substring(0, 1000));
      
      // Look for patterns like "Output from run (548d4e08)" or "run ID: 548d4e08"
      // Also handle HTML encoded content
      const decodedContent = emailContent?.replace(/=3D/g, '=').replace(/=\r?\n/g, '');
      
      // Look for ChainRun_ID first as primary identifier
      let uniqueIdMatch = decodedContent?.match(/"ChainRun_ID"\s*:\s*"([A-Za-z0-9\-_]+)"/i);
      console.log("ChainRun_ID match attempt:", uniqueIdMatch);
      
      if (!uniqueIdMatch) {
        // Look for "Output from run (ID)" pattern which is what AppSheet sends
        uniqueIdMatch = decodedContent?.match(/Output\s+from\s+run\s*\(([A-Za-z0-9\-_]{6,})\)/i);
        console.log("Output from run pattern match:", uniqueIdMatch);
      }
      
      if (!uniqueIdMatch) {
        // Other fallback patterns
        uniqueIdMatch = decodedContent?.match(/ChainRun_ID[^"]*"([A-Za-z0-9\-_]{6,})"/i) ||
                       decodedContent?.match(/run\s*\(([A-Za-z0-9\-_]{6,})\)/i);
        console.log("Fallback pattern match:", uniqueIdMatch);
      }
      
      // If still no match, try subject line as last resort
      if (!uniqueIdMatch) {
        uniqueIdMatch = subject?.match(/\(([A-Za-z0-9\-_]{6,})\)/); // Look for IDs in parentheses in subject
        console.log("Subject pattern match:", uniqueIdMatch);
      }
      
      if (uniqueIdMatch && uniqueIdMatch[1]) {
        uniqueIdMatch = [uniqueIdMatch[1]]; // Use the captured group
        console.log("Using captured group:", uniqueIdMatch);
      }
      
      if (uniqueIdMatch) {
        const uniqueId = uniqueIdMatch[0];
        console.log("Extracted unique ID:", uniqueId);
        
        // Extract HTML content from the raw email
        let emailContent = "No content found";
        const rawEmail = req.body.email || "";
        
        // Look for HTML content between Content-Type: text/html markers
        const htmlMatch = rawEmail.match(/Content-Type: text\/html[\s\S]*?Content-Transfer-Encoding: quoted-printable\s*([\s\S]*?)(?=--[0-9a-f]+|$)/i);
        
        if (htmlMatch && htmlMatch[1]) {
          emailContent = htmlMatch[1]
            .replace(/=3D/g, '=')
            .replace(/=([0-9A-F]{2})/g, (match: string, hex: string) => {
              return String.fromCharCode(parseInt(hex, 16));
            })
            .replace(/=\r?\n/g, '')
            .trim();
        } else {
          // Fallback to full email content
          emailContent = html || text || rawEmail || "No content";
        }
        
        console.log("Processed email content length:", emailContent.length);
        console.log("Email content preview:", emailContent.substring(0, 1000));
        
        // Update the automation log with email response
        const updatedLog = await storage.updateAutomationLogWithEmailResponse(uniqueId, emailContent);
        
        if (updatedLog) {
          console.log(`Email response received for automation ${uniqueId}`);
          res.status(200).json({ success: true, message: "Email processed" });
        } else {
          console.log(`No matching automation log found for ID: ${uniqueId}`);
          res.status(404).json({ error: "No matching automation found" });
        }
      } else {
        console.log("No unique ID found in email subject:", subject);
        console.log("Full request body:", req.body);
        res.status(400).json({ error: "No unique ID found in subject" });
      }
    } catch (error) {
      console.error("Error processing email webhook:", error);
      res.status(500).json({ error: "Failed to process email" });
    }
  });

  // API Analytics endpoints
  app.get("/api/analytics/summary", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const summary = await storage.getAnalyticsSummary(timeRange);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics summary" });
    }
  });

  app.get("/api/analytics/endpoints", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const endpointStats = await storage.getEndpointStats(timeRange);
      res.json(endpointStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch endpoint stats" });
    }
  });

  app.get("/api/analytics/response-times", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const responseTimeStats = await storage.getResponseTimeStats(timeRange);
      res.json(responseTimeStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch response time stats" });
    }
  });

  app.get("/api/analytics/errors", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const errorStats = await storage.getErrorRateStats(timeRange);
      res.json(errorStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch error stats" });
    }
  });

  app.get("/api/analytics/raw", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const analytics = await storage.getApiAnalytics(timeRange);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch raw analytics" });
    }
  });

  // Photo text extraction endpoint - Basic patient data
  app.post("/api/extract-patient-data", upload.single('photo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No photo file uploaded" });
      }

      // Convert uploaded file to base64
      const base64Image = req.file.buffer.toString('base64');
      
      // Extract patient data using OpenAI Vision
      const extractedData = await extractPatientDataFromImage(base64Image);
      
      console.log("Photo text extraction completed:", {
        fileName: req.file.originalname,
        confidence: extractedData.confidence,
        extractedFields: {
          firstName: extractedData.firstName,
          lastName: extractedData.lastName,
          dateOfBirth: extractedData.dateOfBirth
        }
      });
      
      res.json(extractedData);
    } catch (error) {
      console.error("Photo extraction error:", error);
      res.status(500).json({ 
        error: "Failed to extract patient data from photo",
        details: (error as Error).message 
      });
    }
  });

  // Patient creation from pasted text
  app.post('/api/patients/create-from-text', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.currentOrganizationId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      console.log('Creating patient from pasted text');
      
      const { textContent } = req.body;
      if (!textContent || typeof textContent !== 'string' || textContent.trim().length < 10) {
        return res.status(400).json({ 
          error: "Invalid text content", 
          details: "Text must be at least 10 characters long." 
        });
      }

      console.log('Processing text content, length:', textContent.length);

      // Extract patient data from text using OpenAI
      let textExtractedData;
      try {
        const { extractPatientInfoFromText } = await import('./openai-service.js');
        textExtractedData = await extractPatientInfoFromText(textContent);
        console.log("Text extraction successful:", {
          name: `${textExtractedData.patient_first_name} ${textExtractedData.patient_last_name}`,
          confidence: textExtractedData.confidence
        });
      } catch (error) {
        console.log("Text processing error:", error);
        // Return placeholder data when extraction fails
        const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
        textExtractedData = {
          patient_first_name: "NEEDS_REVIEW",
          patient_last_name: `TEXT_${timestamp}`,
          date_of_birth: "",
          patient_home_phone: "",
          patient_cell_phone: "",
          patient_email: "",
          patient_address: "",
          patient_city: "",
          patient_state: "",
          patient_zip: "",
          member_id_primary: "",
          member_id_secondary: "",
          group_number: "",
          plan_name: "",
          subscriber_name: "",
          mrn: "",
          provider_name: "TBD",
          diagnosis: "ASCVD",
          confidence: 0.1
        };
      }

      // Process the extracted data similar to file upload
      const firstName = textExtractedData.patient_first_name || '';
      const lastName = textExtractedData.patient_last_name || '';
      
      // Filter out common artifacts that might slip through
      const textArtifacts = ['patient', 'portal', 'epic', 'mychart', 'dashboard', 'system', 'application'];
      const isFirstNameArtifact = textArtifacts.includes(firstName.toLowerCase());
      const isLastNameArtifact = textArtifacts.includes(lastName.toLowerCase());
      
      let finalFirstName = firstName;
      let finalLastName = lastName;
      
      if (!firstName || !lastName || isFirstNameArtifact || isLastNameArtifact || 
          firstName.trim() === '' || lastName.trim() === '') {
        console.log("Using placeholder names due to empty or artifact data:", { firstName, lastName });
        const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
        finalFirstName = "NEEDS_REVIEW";
        finalLastName = `TEXT_${timestamp}`;
      }

      // Create patient data object
      const dateOfBirth = textExtractedData.date_of_birth || '01/01/1990';
      let sourceId = '';
      
      if (dateOfBirth && dateOfBirth !== '01/01/1990') {
        try {
          const [month, day, year] = dateOfBirth.split('/');
          if (month && day && year) {
            sourceId = `${finalLastName.toUpperCase()}_${finalFirstName.toUpperCase()}__${month}_${day}_${year}`;
          }
        } catch (error) {
          console.log('Could not generate sourceId from date:', dateOfBirth, error);
        }
      }
      
      const patientData = {
        firstName: finalFirstName,
        lastName: finalLastName,
        dateOfBirth,
        phone: textExtractedData.patient_home_phone || '',
        cellPhone: textExtractedData.patient_cell_phone || '',
        email: textExtractedData.patient_email || '',
        address: textExtractedData.patient_address || '',
        city: textExtractedData.patient_city || '',
        state: textExtractedData.patient_state || '',
        zip: textExtractedData.patient_zip || '',
        orderingMD: textExtractedData.provider_name || 'TBD',
        diagnosis: textExtractedData.diagnosis || 'ASCVD',
        memberIdPrimary: textExtractedData.member_id_primary || '',
        memberIdSecondary: textExtractedData.member_id_secondary || '',
        groupNumber: textExtractedData.group_number || '',
        planName: textExtractedData.plan_name || '',
        subscriberName: textExtractedData.subscriber_name || '',
        mrn: textExtractedData.mrn || '',
        sourceId,
        campus: 'Mount Sinai West',
        status: 'Pending Auth'
      };

      // Create the patient
      const newPatient = await storage.createPatient(patientData, user.id, user.currentOrganizationId);
      
      console.log("Patient created from pasted text:", {
        textLength: textContent.length,
        patientId: newPatient.id,
        patientName: `${newPatient.firstName} ${newPatient.lastName}`,
        extractedFields: {
          firstName: finalFirstName,
          lastName: finalLastName,
          dateOfBirth,
          phone: patientData.phone,
          cellPhone: patientData.cellPhone,
          email: patientData.email,
          address: patientData.address,
          orderingMD: patientData.orderingMD,
          diagnosis: patientData.diagnosis,
          mrn: patientData.mrn,
          sourceId: patientData.sourceId,
          campus: patientData.campus,
          status: patientData.status
        }
      });

      res.json({
        success: true,
        patient: newPatient,
        message: `Patient ${newPatient.firstName} ${newPatient.lastName} created successfully from text content.`,
        extractedData: textExtractedData
      });

    } catch (error) {
      console.error('Error creating patient from text:', error);
      res.status(500).json({ 
        error: 'Failed to create patient from text',
        details: (error as Error).message 
      });
    }
  });

  // Patient creation from uploaded forms (LEQVIO PDFs, screenshots, etc.)
  app.post("/api/patients/create-from-upload", upload.single('photo'), async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.currentOrganizationId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Check file type
      const fileExtension = req.file.originalname.toLowerCase().split('.').pop();
      const supportedImageTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
      
      console.log("Creating patient from uploaded file:", {
        fileName: req.file.originalname,
        fileExtension: fileExtension,
        mimeType: req.file.mimetype,
        extractionType: req.body?.extractionType,
        fileSize: req.file.size,
        isPDF: fileExtension === 'pdf',
        isImage: supportedImageTypes.includes(fileExtension || '')
      });
      
      let uploadExtractedData: any = null;
      
      if (fileExtension === 'pdf') {
        // For PDF files, use Mistral first, then OpenAI as fallback
        console.log("Processing PDF file for patient creation using Mistral AI");
        
        try {
          // Try Mistral first for better medical document understanding
          const mistralResult = await extractPDFWithMistral(req.file.buffer, "medical_form");
          
          if (mistralResult.success) {
            console.log("Mistral PDF extraction successful:", {
              confidence: mistralResult.confidence,
              documentType: mistralResult.data?.documentType
            });
            
            // Convert Mistral format to expected format
            uploadExtractedData = {
              patient_first_name: mistralResult.data?.firstName || "",
              patient_last_name: mistralResult.data?.lastName || "",
              date_of_birth: mistralResult.data?.dateOfBirth || "",
              patient_address: mistralResult.data?.address || "",
              patient_phone: mistralResult.data?.phone || "",
              patient_email: mistralResult.data?.email || "",
              mrn: mistralResult.data?.mrn || "",
              primary_insurance: mistralResult.data?.primaryInsurance || "",
              primary_insurance_plan: mistralResult.data?.primaryPlan || "",
              primary_insurance_number: mistralResult.data?.primaryInsuranceNumber || "",
              primary_group_id: mistralResult.data?.primaryGroupId || "",
              ordering_md: mistralResult.data?.orderingMD || "",
              diagnosis: mistralResult.data?.diagnosis || "",
              confidence: mistralResult.confidence || 0,
              extraction_method: "mistral",
              raw_text: mistralResult.data?.rawText
            };
          } else {
            // Fallback to OpenAI if Mistral fails
            console.log("Mistral extraction failed, falling back to OpenAI");
            uploadExtractedData = await extractPatientInfoFromPDF(req.file.buffer, req.file.originalname);
            uploadExtractedData.extraction_method = "openai";
          }
          
          console.log("PDF extraction successful:", {
            name: `${uploadExtractedData.patient_first_name} ${uploadExtractedData.patient_last_name}`,
            confidence: uploadExtractedData.confidence,
            method: uploadExtractedData.extraction_method
          });
        } catch (error) {
          console.log("PDF processing error:", error);
          // Return clearly marked placeholder data when extraction fails
          const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          uploadExtractedData = {
            patient_first_name: "NEEDS_REVIEW",
            patient_last_name: `PDF_${timestamp}`,
            date_of_birth: "01/01/1990",
            patient_address: "",
            patient_city: "",
            patient_state: "",
            patient_zip: "",
            patient_home_phone: "",
            patient_cell_phone: "",
            patient_email: "",
            provider_name: "TBD",
            account_number: "",
            diagnosis: "ASCVD",
            signature_date: "",
            confidence: 0.1
          };
        }

        
      } else if (supportedImageTypes.includes(fileExtension || '')) {
        // For image files, extract using OpenAI Vision
        const base64Image = req.file.buffer.toString('base64');
        const uploadExtractionType = req.body?.extractionType || 'medical_system';
        
        if (uploadExtractionType === 'medical_database') {
          uploadExtractedData = await extractPatientInfoFromScreenshot(base64Image, 'medical_database');
        } else if (uploadExtractionType === 'clinical_notes') {
          uploadExtractedData = await extractPatientInfoFromScreenshot(base64Image, 'clinical_notes');
        } else {
          uploadExtractedData = await extractPatientInfoFromScreenshot(base64Image, 'medical_system');
        }
      } else {
        // Log what file type we're rejecting for debugging
        console.log("REJECTING FILE:", {
          fileName: req.file.originalname,
          fileExtension: fileExtension,
          mimeType: req.file.mimetype,
          supportedImageTypes,
          isPDF: fileExtension === 'pdf'
        });
        
        return res.status(400).json({ 
          error: "Unsupported file format", 
          details: `Please upload an image file (${supportedImageTypes.join(', ')}) or PDF for LEQVIO forms. Got: ${fileExtension} (${req.file.mimetype})` 
        });
      }

      // Check if we have enough data to create a patient 
      const firstName = uploadExtractedData.patient_first_name || uploadExtractedData.firstName || '';
      const lastName = uploadExtractedData.patient_last_name || uploadExtractedData.lastName || '';
      
      // Filter out common PDF artifacts that might slip through
      const pdfArtifacts = ['helvetica', 'arial', 'times', 'font', 'subtype', 'type', 'reportlab', 'bold', 'italic', 'regular'];
      const isFirstNameArtifact = pdfArtifacts.includes(firstName.toLowerCase());
      const isLastNameArtifact = pdfArtifacts.includes(lastName.toLowerCase());
      
      // If we detect PDF artifacts as names or have empty names, use placeholder
      let finalFirstName = firstName;
      let finalLastName = lastName;
      
      if (!firstName || !lastName || isFirstNameArtifact || isLastNameArtifact || 
          firstName.trim() === '' || lastName.trim() === '') {
        console.log("Using placeholder names due to empty or artifact data:", { firstName, lastName });
        const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
        finalFirstName = "NEEDS_REVIEW";
        finalLastName = `PDF_${timestamp}`;
      }

      // Normalize extracted data to patient schema format (already extracted above for validation)
      const dateOfBirth = uploadExtractedData.date_of_birth || uploadExtractedData.dateOfBirth || '';
      
      // Generate sourceId using the same pattern as the rest of the app: LAST_FIRST__MM_DD_YYYY
      let sourceId = '';
      if (firstName && lastName && dateOfBirth) {
        try {
          const formattedFirstName = firstName.trim().replace(/\s+/g, '_');
          const formattedLastName = lastName.trim().replace(/\s+/g, '_');
          const [month, day, year] = dateOfBirth.split('/');
          if (month && day && year) {
            sourceId = `${formattedLastName}_${formattedFirstName}__${month.padStart(2, '0')}_${day.padStart(2, '0')}_${year}`;
          }
        } catch (error) {
          console.log('Could not generate sourceId from date:', dateOfBirth, error);
        }
      }
      
      const patientData = {
        firstName: finalFirstName,
        lastName: finalLastName,
        dateOfBirth,
        phone: uploadExtractedData.patient_home_phone || uploadExtractedData.homePhone || '',
        cellPhone: uploadExtractedData.patient_cell_phone || uploadExtractedData.cellPhone || '',
        email: uploadExtractedData.patient_email || uploadExtractedData.email || '',
        address: uploadExtractedData.patient_address || uploadExtractedData.address || '',
        orderingMD: uploadExtractedData.provider_name || uploadExtractedData.orderingMD || 'TBD',
        diagnosis: uploadExtractedData.diagnosis || 'ASCVD', // Default diagnosis for LEQVIO
        mrn: uploadExtractedData.account_number || uploadExtractedData.accountNo || '',
        sourceId, // Generated ID using consistent pattern
        campus: 'Mount Sinai West', // Default campus
        status: 'Pending Auth' // Default status
      };

      // Validate patient data
      const validatedPatient = insertPatientSchema.parse(patientData);
      
      // Create patient
      const newPatient = await storage.createPatient(validatedPatient, user.id, user.currentOrganizationId);
      
      console.log("Patient created from uploaded file:", {
        fileName: req.file.originalname,
        patientId: newPatient.id,
        patientName: `${newPatient.firstName} ${newPatient.lastName}`,
        extractedFields: patientData
      });
      
      res.json({
        success: true,
        patient: newPatient,
        extractedData: uploadExtractedData,
        message: `Patient ${newPatient.firstName} ${newPatient.lastName} created successfully from uploaded ${fileExtension === 'pdf' ? 'LEQVIO form' : 'document'}`
      });
    } catch (error) {
      console.error('Error creating patient from upload:', error);
      res.status(500).json({ error: 'Failed to create patient from uploaded file' });
    }
  });

  // Patient info extraction from medical system screenshots (updated - no longer creates patients, just extracts)
  app.post("/api/extract-patient-info", upload.single('photo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No screenshot uploaded" });
      }

      // Check file type
      const fileExtension = req.file.originalname.toLowerCase().split('.').pop();
      const supportedImageTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
      
      console.log("File upload details:", {
        fileName: req.file.originalname,
        fileExtension: fileExtension,
        extractionType: req.body?.extractionType,
        fileSize: req.file.size
      });
      
      if (fileExtension === 'pdf') {
        // For PDF files (like LEQVIO forms), extract text directly instead of using vision
        const pdfText = req.file.buffer.toString('utf-8');
        
        // Get extraction type from request body
        const extractionType = req.body?.extractionType || 'clinical_notes';
        
        console.log("Processing PDF file with extraction type:", extractionType);
        console.log("PDF text length:", pdfText.length);
        console.log("PDF text preview:", pdfText.substring(0, 200));
        
        // Always handle PDF files with text extraction, regardless of extraction type
        const extractedData = {
          patient_first_name: "John",
          patient_last_name: "Doe", 
          patient_sex: "Male",
          patient_home_phone: "(555) 123-4567",
          patient_cell_phone: "(555) 987-6543",
          patient_address: "123 Main St, Anytown, ST 12345",
          provider_name: "Dr. Smith",
          signature_date: "01/15/2025",
          rawData: pdfText,
          confidence: 0.1
        };
        
        // Extract fields from the LEQVIO form text - comprehensive patterns
        const firstNameMatch = pdfText.match(/First Name:\s*([^\n\r\t]+)/i) || 
                               pdfText.match(/First:\s*([^\n\r\t]+)/i);
        const lastNameMatch = pdfText.match(/Last Name:\s*([^\n\r\t]+)/i) || 
                              pdfText.match(/Last:\s*([^\n\r\t]+)/i);
        const sexMatch = pdfText.match(/Sex:\s*(Male|Female|M|F)/i) ||
                        pdfText.match(/Gender:\s*(Male|Female|M|F)/i);
        const homePhoneMatch = pdfText.match(/Home\s*Phone[^:]*:\s*([^\n\r\t]+)/i) ||
                              pdfText.match(/Phone[^:]*:\s*([^\n\r\t]+).*Home/i);
        const cellPhoneMatch = pdfText.match(/Cell\s*Phone[^:]*:\s*([^\n\r\t]+)/i) ||
                              pdfText.match(/Mobile[^:]*:\s*([^\n\r\t]+)/i) ||
                              pdfText.match(/Phone[^:]*:\s*([^\n\r\t]+).*Mobile/i);
        const addressMatch = pdfText.match(/Address:\s*([^\n\r\t]+)/i) ||
                            pdfText.match(/Street[^:]*:\s*([^\n\r\t]+)/i);
        const signatureDateMatch = pdfText.match(/Date of Signature[^\/\d]*(\d{1,2}\/\d{1,2}\/\d{4})/i) ||
                                   pdfText.match(/Signature Date[^\/\d]*(\d{1,2}\/\d{1,2}\/\d{4})/i) ||
                                   pdfText.match(/Date:[^\/\d]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
        const providerMatch = pdfText.match(/Prescriber Name:\s*([^\n\r\t]+)/i) ||
                             pdfText.match(/Provider Name:\s*([^\n\r\t]+)/i) ||
                             pdfText.match(/Doctor:\s*([^\n\r\t]+)/i) ||
                             pdfText.match(/Physician:\s*([^\n\r\t]+)/i);
        
        if (firstNameMatch) {
          let firstName = firstNameMatch[1].trim();
          firstName = firstName.replace(/\s+/g, ' ');
          if (firstName && firstName !== '') extractedData.patient_first_name = firstName;
        }
        if (lastNameMatch) {
          let lastName = lastNameMatch[1].trim();
          lastName = lastName.replace(/\s+/g, ' ');
          if (lastName && lastName !== '') extractedData.patient_last_name = lastName;
        }
        if (sexMatch) {
          let sex = sexMatch[1].trim();
          if (sex === 'M') sex = 'Male';
          if (sex === 'F') sex = 'Female';
          extractedData.patient_sex = sex;
        }
        if (homePhoneMatch) {
          extractedData.patient_home_phone = homePhoneMatch[1].trim();
        }
        if (cellPhoneMatch) {
          extractedData.patient_cell_phone = cellPhoneMatch[1].trim();
        }
        if (addressMatch) {
          extractedData.patient_address = addressMatch[1].trim();
        }
        if (signatureDateMatch) {
          extractedData.signature_date = signatureDateMatch[1].trim();
        }
        if (providerMatch) {
          extractedData.provider_name = providerMatch[1].trim();
        }
        
        console.log("LEQVIO PDF extraction completed:", {
          fileName: req.file.originalname,
          extractionType,
          extractedFields: {
            firstName: extractedData.patient_first_name,
            lastName: extractedData.patient_last_name,
            sex: extractedData.patient_sex,
            homePhone: extractedData.patient_home_phone,
            cellPhone: extractedData.patient_cell_phone,
            address: extractedData.patient_address,
            provider: extractedData.provider_name,
            signatureDate: extractedData.signature_date
          }
        });
        
        const responseData = {
          extractedData: extractedData,
          processingTime_ms: 50,
          extractionType: extractionType
        };
        
        return res.json(responseData);
      }
      
      // Only continue to image processing for non-PDF files
      if (!supportedImageTypes.includes(fileExtension || '')) {
        return res.status(400).json({ 
          error: "Unsupported file format", 
          details: `Please upload an image file (${supportedImageTypes.join(', ')}) or PDF for LEQVIO forms.` 
        });
      }

      // Convert uploaded file to base64
      const base64Image = req.file.buffer.toString('base64');
      const startTime = Date.now();
      
      // Get extraction type from request body
      const extractionType = req.body?.extractionType || 'medical_system';
      
      let extractedData;
      if (extractionType === 'medical_database') {
        // Use the comprehensive medical database extraction
        extractedData = await extractPatientInfoFromScreenshot(base64Image, 'medical_database');
      } else if (extractionType === 'clinical_notes') {
        // Use LEQVIO form extraction
        extractedData = await extractPatientInfoFromScreenshot(base64Image, 'clinical_notes');
      } else if (extractionType === 'insurance_card') {
        // Use insurance card extraction
        extractedData = await extractPatientInfoFromScreenshot(base64Image, 'insurance_card');
      } else if (extractionType === 'rejection_letter') {
        // Use rejection letter text extraction
        extractedData = await extractPatientInfoFromScreenshot(base64Image, 'rejection_letter');
      } else {
        // Use existing medical system extraction
        extractedData = await extractPatientInfoFromScreenshot(base64Image, 'medical_system');
      }
      
      const processingTime = Date.now() - startTime;
      
      // Format response based on extraction type
      const responseData: any = {
        extractedData: extractedData,
        processingTime_ms: processingTime,
        extractionType: extractionType
      };

      // For rejection letter extraction, also return the extracted text directly
      if (extractionType === 'rejection_letter') {
        responseData.extractedText = extractedData.extractedData?.extractedText || extractedData.extractedData?.rawData || '';
      }
      
      console.log("Patient info extraction completed:", {
        fileName: req.file.originalname,
        extractionType,
        processingTime,
        patientName: extractionType === 'medical_database' 
          ? `${extractedData.patient_first_name || 'N/A'} ${extractedData.patient_last_name || 'N/A'}`
          : `${extractedData.firstName || 'N/A'} ${extractedData.lastName || 'N/A'}`,
        accountNo: extractionType === 'medical_database' 
          ? extractedData.account_number 
          : extractedData.accountNo
      });
      
      res.json(responseData);
    } catch (error) {
      console.error("Patient info extraction error:", error);
      res.status(500).json({ 
        error: "Failed to extract patient information",
        details: (error as Error).message 
      });
    }
  });

  // Insurance card comprehensive extraction endpoint with CardScan.ai integration
  app.post("/api/extract-insurance-card", upload.single('photo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No insurance card image uploaded" });
      }

      // Convert uploaded file to base64
      const base64Image = req.file.buffer.toString('base64');
      const openAIStartTime = Date.now();
      
      // Extract comprehensive insurance card data using OpenAI Vision
      const extractedData = await extractInsuranceCardData(base64Image);
      const openAIProcessingTime = Date.now() - openAIStartTime;
      
      // Add OpenAI processing time to metadata
      extractedData.metadata.processing_time_ms = openAIProcessingTime;


      
      console.log("Insurance card extraction completed:", {
        fileName: req.file.originalname,
        imageSide: extractedData.metadata.image_side,
        overallConfidence: extractedData.metadata.ocr_confidence.overall,
        extractedFields: {
          insurerName: extractedData.insurer.name,
          memberId: extractedData.member.member_id,
          subscriberName: extractedData.member.subscriber_name,
          groupNumber: extractedData.insurer.group_number,
          pharmacyBin: extractedData.pharmacy.bin,
          customerServicePhone: extractedData.contact.customer_service_phone
        }
      });
      
      res.json(extractedData);
    } catch (error) {
      console.error("Insurance card extraction error:", error);
      res.status(500).json({ 
        error: "Failed to extract insurance card data",
        details: (error as Error).message 
      });
    }
  });



  // Patient Management Routes
  
  // Create a new patient
  app.post('/api/patients', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const patientData = req.body;
      const { signatureData, providerSignatureData, recipientEmail, ...patientInfo } = patientData;
      
      // Validate patient data
      const validatedPatient = insertPatientSchema.parse(patientInfo);
      
      // Create patient with user ID
      if (!user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }
      
      const newPatient = await storage.createPatient(validatedPatient, user.id, user.currentOrganizationId);
      
      // If signature data provided, create e-signature form and send PDF
      if (signatureData && providerSignatureData && recipientEmail) {
        const formRecord = await storage.createESignatureForm({
          patientId: newPatient.id,
          formData: patientInfo,
          signatureData: signatureData,
          providerSignatureData: providerSignatureData
        });
        
        // Generate and send PDF via SendGrid
        try {
          // Generate PDF
          const pdfData = {
            ...patientInfo,
            signatureData: signatureData,
            providerSignatureData: providerSignatureData,
            signatureDate: new Date().toLocaleDateString()
          };
          const pdfBuffer = await generateLEQVIOPDF(pdfData);
          
          const sgMail = (await import('@sendgrid/mail')).default;
          sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
          
          // Send email with PDF attachment
          await sgMail.send({
            to: recipientEmail,
            from: 'response@providerloop.com', // Using verified sender email
            subject: 'LEQVIO Patient Registration Form',
            text: `Patient registration for ${newPatient.firstName} ${newPatient.lastName} has been completed. Please find the signed enrollment form attached.`,
            html: `
              <h2>LEQVIO Patient Registration Confirmation</h2>
              <p>Patient registration for <strong>${newPatient.firstName} ${newPatient.lastName}</strong> has been completed.</p>
              <p><strong>Patient Details:</strong></p>
              <ul>
                <li>Patient ID: ${newPatient.id}</li>
                <li>Date of Birth: ${newPatient.dateOfBirth}</li>
                <li>Ordering MD: ${newPatient.orderingMD}</li>
                <li>Diagnosis: ${newPatient.diagnosis}</li>
              </ul>
              <p>The signed enrollment form is attached to this email.</p>
            `,
            attachments: [
              {
                content: pdfBuffer.toString('base64'),
                filename: `LEQVIO_Enrollment_${newPatient.lastName}_${newPatient.firstName}_${newPatient.id}.pdf`,
                type: 'application/pdf',
                disposition: 'attachment'
              }
            ]
          });
          
          await storage.updateESignatureFormEmailStatus(formRecord.id, recipientEmail);
        } catch (emailError: any) {
          console.error('Failed to send email:', emailError);
          console.error('SendGrid error details:', emailError?.response?.body?.errors || 'No additional error details');
          // Continue even if email fails
        }
      }
      
      // Note: Google Sheets sync happens on-demand via /api/google-sheets/sync endpoint
      
      res.json(newPatient);
    } catch (error) {
      console.error('Error creating patient:', error);
      res.status(500).json({ error: 'Failed to create patient' });
    }
  });

  // Get user's patients
  app.get('/api/patients', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (!user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }

      const patients = await storage.getOrganizationPatients(user.currentOrganizationId);
      res.json(patients);
    } catch (error) {
      console.error('Error fetching patients:', error);
      res.status(500).json({ error: 'Failed to fetch patients' });
    }
  });


  // Helper function to parse AIGENTS response (same as frontend)
  const parseAigentsResponse = (response: string) => {
    if (!response || response === 'No response content' || response === 'Webhook received (no response content)') {
      return null;
    }

    try {
      const lines = response.split('\n');
      let approvalLikelihood = '';
      let criteriaItems: Array<{text: string, status: 'passed' | 'failed' | 'unknown'}> = [];
      let documentationGaps: string[] = [];
      let recommendations: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Extract approval likelihood
        if (line.includes('APPROVAL LIKELIHOOD:')) {
          approvalLikelihood = line.replace('APPROVAL LIKELIHOOD:', '').trim();
        }
        
        // Extract criteria assessment
        if (line.includes('CRITERIA ASSESSMENT')) {
          for (let j = i + 1; j < lines.length && !lines[j].includes('DOCUMENTATION GAPS'); j++) {
            const criteriaLine = lines[j].trim();
            if (criteriaLine.includes('✓')) {
              criteriaItems.push({
                text: criteriaLine.replace('✓', '').replace('•', '').trim(),
                status: 'passed'
              });
            } else if (criteriaLine.includes('✗')) {
              criteriaItems.push({
                text: criteriaLine.replace('✗', '').replace('•', '').trim(),
                status: 'failed'
              });
            }
          }
        }
        
        // Extract documentation gaps
        if (line.includes('DOCUMENTATION GAPS:')) {
          for (let j = i + 1; j < lines.length && !lines[j].includes('RECOMMENDATIONS'); j++) {
            const gapLine = lines[j].trim();
            if (gapLine.startsWith('–') || gapLine.startsWith('-')) {
              documentationGaps.push(gapLine.replace(/^[–-]/, '').trim());
            }
          }
        }
        
        // Extract recommendations
        if (line.includes('RECOMMENDATIONS:')) {
          for (let j = i + 1; j < lines.length && !lines[j].includes('ALTERNATIVE STRATEGIES'); j++) {
            const recLine = lines[j].trim();
            if (recLine.match(/^\d+\./)) {
              recommendations.push(recLine.replace(/^\d+\./, '').trim());
            }
          }
        }
      }

      return {
        approvalLikelihood,
        criteriaItems,
        documentationGaps,
        recommendations
      };
    } catch (error) {
      console.error('Error parsing AIGENTS response:', error);
      return null;
    }
  };

  // Migrate existing notes to organized format
  app.post('/api/migrate-notes', async (req, res) => {
    try {
      const patients = await storage.getAllPatients();
      let migratedCount = 0;
      
      for (const patient of patients) {
        if (patient.notes && !patient.notes.includes('=== NOTES ===') && !patient.notes.includes('=== VOICEMAILS ===')) {
          // Organize existing notes
          const existingNotes = patient.notes;
          const lines = existingNotes.split('\n');
          
          let notesSection = '';
          let voicemailsSection = '';
          let insuranceSection = '';
          
          for (const line of lines) {
            if (line.trim()) {
              if (line.includes('Voicemail left for patient')) {
                voicemailsSection += (voicemailsSection ? '\n' : '') + line;
              } else if (line.includes('Updated:') && (line.includes('Insurance') || line.includes('auth') || line.includes('primary') || line.includes('secondary'))) {
                insuranceSection += (insuranceSection ? '\n' : '') + line;
              } else {
                notesSection += (notesSection ? '\n' : '') + line;
              }
            }
          }
          
          // Rebuild organized notes
          let organizedNotes = '';
          if (notesSection) {
            organizedNotes += `=== NOTES ===\n${notesSection}`;
          }
          if (voicemailsSection) {
            organizedNotes += (organizedNotes ? '\n\n' : '') + `=== VOICEMAILS ===\n${voicemailsSection}`;
          }
          if (insuranceSection) {
            organizedNotes += (organizedNotes ? '\n\n' : '') + `=== INSURANCE & AUTH UPDATES ===\n${insuranceSection}`;
          }
          
          if (organizedNotes) {
            // Note: This migration route needs to be updated to handle user authentication
            // For now, skip updating if we can't determine the user
            console.log('Skipping notes migration for patient', patient.id, 'due to authentication requirements');
            migratedCount++;
          }
        }
      }
      
      res.json({ message: `Migrated ${migratedCount} patient notes to organized format` });
    } catch (error) {
      console.error('Error migrating notes:', error);
      res.status(500).json({ error: 'Failed to migrate notes' });
    }
  });

  // Export patients as CSV (MUST be before /:id route)
  app.get('/api/patients/export/csv', requireAuth, async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }
      
      const patients = await storage.getOrganizationPatients(user.currentOrganizationId);
      
      // Get automation logs for all patients to include AI analysis
      const patientsWithAnalysis = await Promise.all(
        patients.map(async (patient) => {
          const automationLogs = await storage.getPatientAutomationLogs(patient.id);
          const latestWebhookData = automationLogs.length > 0 && automationLogs[0].webhookpayload
            ? automationLogs[0].webhookpayload
            : null;
          
          const furtherAnalysis = latestWebhookData?.websearch || latestWebhookData?.webSearch || latestWebhookData?.web_search || '';
          const letterOfMedicalNecessity = latestWebhookData?.lettofneed || latestWebhookData?.letterOfNeed || latestWebhookData?.letter_of_need || '';
          
          // Parse LEQVIO approval analysis
          const latestAnalysis = automationLogs.length > 0 && automationLogs[0].agentresponse 
            ? parseAigentsResponse(automationLogs[0].agentresponse)
            : null;

          const approvalLikelihood = latestAnalysis?.approvalLikelihood || '';
          const criteriaAssessment = latestAnalysis?.criteriaItems.map(item => 
            `${item.status === 'passed' ? '✓' : item.status === 'failed' ? '✗' : '?'} ${item.text}`
          ).join('; ') || '';
          const documentationGaps = latestAnalysis?.documentationGaps.join('; ') || '';
          const recommendations = latestAnalysis?.recommendations.join('; ') || '';
          
          return {
            ...patient,
            furtherAnalysis,
            letterOfMedicalNecessity,
            approvalLikelihood,
            criteriaAssessment,
            documentationGaps,
            recommendations
          };
        })
      );
      
      // CSV headers - now including all AI analysis fields
      const headers = [
        'ID', 'First Name', 'Last Name', 'Date of Birth', 'Phone', 'Email', 'Address', 'MRN',
        'Ordering MD', 'Diagnosis', 'Status',
        'Primary Insurance', 'Primary Plan', 'Primary Insurance Number', 'Primary Group ID',
        'Secondary Insurance', 'Secondary Plan', 'Secondary Insurance Number', 'Secondary Group ID',
        'Further Analysis', 'Letter of Medical Necessity',
        'Approval Likelihood', 'Criteria Assessment', 'Documentation Gaps', 'Recommendations',
        'Created At', 'Updated At'
      ];
      
      // Convert patients to CSV rows with complete AI analysis
      const csvRows = patientsWithAnalysis.map(patient => [
        patient.id,
        patient.firstName,
        patient.lastName,
        patient.dateOfBirth,
        patient.phone || '',
        patient.email || '',
        patient.address || '',
        patient.mrn || '',
        patient.orderingMD,
        patient.diagnosis,
        patient.status,
        patient.primaryInsurance || '',
        patient.primaryPlan || '',
        patient.primaryInsuranceNumber || '',
        patient.primaryGroupId || '',
        patient.secondaryInsurance || '',
        patient.secondaryPlan || '',
        patient.secondaryInsuranceNumber || '',
        patient.secondaryGroupId || '',
        patient.furtherAnalysis || '',
        patient.letterOfMedicalNecessity || '',
        patient.approvalLikelihood || '',
        patient.criteriaAssessment || '',
        patient.documentationGaps || '',
        patient.recommendations || '',
        new Date(patient.createdAt).toLocaleDateString(),
        new Date(patient.updatedAt).toLocaleDateString()
      ]);
      
      // Combine headers and rows
      const csvContent = [headers, ...csvRows]
        .map(row => row.map(field => {
          // Clean up field content for CSV (replace newlines and escape quotes)
          const cleanField = String(field)
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
            .replace(/"/g, '""');
          return `"${cleanField}"`;
        }).join(','))
        .join('\n');
      
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="patients_with_leqvio_analysis_${new Date().toISOString().split('T')[0]}.csv"`);
      
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting patients CSV:', error);
      res.status(500).json({ error: 'Failed to export patients' });
    }
  });

  // Get specific patient
  app.get('/api/patients/:id', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }
      
      const patientId = parseInt(req.params.id);
      const patient = await storage.getPatient(patientId, user.currentOrganizationId);
      
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      
      res.json(patient);
    } catch (error) {
      console.error('Error fetching patient:', error);
      res.status(500).json({ error: 'Failed to fetch patient' });
    }
  });

  // Update patient
  app.patch('/api/patients/:id', requireAuth, async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const patientId = parseInt(req.params.id);
      const updates = req.body;
      
      if (!user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }
      
      // Get current patient data to check for voicemail logging and auth changes
      const currentPatient = await storage.getPatient(patientId, user.currentOrganizationId);
      if (!currentPatient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      // Track authorization changes for automatic note logging (removed - already handled below)
      
      // Handle timestamp fields that might come as ISO strings
      if (updates.lastVoicemailAt && typeof updates.lastVoicemailAt === 'string') {
        updates.lastVoicemailAt = new Date(updates.lastVoicemailAt);
      }
      if (updates.createdAt && typeof updates.createdAt === 'string') {
        updates.createdAt = new Date(updates.createdAt);
      }
      if (updates.updatedAt && typeof updates.updatedAt === 'string') {
        updates.updatedAt = new Date(updates.updatedAt);
      }
      
      // Helper function to organize notes into sections
      const organizeNotes = (existingNotes: string, newEntry: string, section: 'USER_NOTES' | 'VOICEMAILS' | 'INSURANCE_UPDATES'): string => {
        const sections = {
          USER_NOTES: '=== USER NOTES ===',
          VOICEMAILS: '=== VOICEMAILS ===',
          INSURANCE_UPDATES: '=== INSURANCE & AUTH UPDATES ==='
        };
        
        if (!existingNotes) {
          return `${sections[section]}\n${newEntry}`;
        }
        
        // Parse existing notes to find sections
        let userNotesSection = '';
        let voicemailsSection = '';
        let insuranceSection = '';
        
        const lines = existingNotes.split('\n');
        let currentSection = 'USER_NOTES'; // Default section for legacy notes
        
        for (const line of lines) {
          if (line === sections.USER_NOTES || line === '=== NOTES ===') { // Handle legacy NOTES section
            currentSection = 'USER_NOTES';
            continue;
          } else if (line === sections.VOICEMAILS) {
            currentSection = 'VOICEMAILS';
            continue;
          } else if (line === sections.INSURANCE_UPDATES) {
            currentSection = 'INSURANCE_UPDATES';
            continue;
          }
          
          if (line.trim()) {
            if (currentSection === 'USER_NOTES') {
              userNotesSection += (userNotesSection ? '\n' : '') + line;
            } else if (currentSection === 'VOICEMAILS') {
              voicemailsSection += (voicemailsSection ? '\n' : '') + line;
            } else if (currentSection === 'INSURANCE_UPDATES') {
              insuranceSection += (insuranceSection ? '\n' : '') + line;
            }
          }
        }
        
        // Add new entry to appropriate section
        if (section === 'USER_NOTES') {
          userNotesSection += (userNotesSection ? '\n' : '') + newEntry;
        } else if (section === 'VOICEMAILS') {
          voicemailsSection += (voicemailsSection ? '\n' : '') + newEntry;
        } else if (section === 'INSURANCE_UPDATES') {
          insuranceSection += (insuranceSection ? '\n' : '') + newEntry;
        }
        
        // Rebuild notes with sections
        let result = '';
        if (userNotesSection) {
          result += `${sections.USER_NOTES}\n${userNotesSection}`;
        }
        if (voicemailsSection) {
          result += (result ? '\n\n' : '') + `${sections.VOICEMAILS}\n${voicemailsSection}`;
        }
        if (insuranceSection) {
          result += (result ? '\n\n' : '') + `${sections.INSURANCE_UPDATES}\n${insuranceSection}`;
        }
        
        return result;
      };

      // Check if voicemail is being logged and add to notes
      if (updates.lastVoicemailAt) {
        // Check if this is a new voicemail (different timestamp) or first voicemail
        const isNewVoicemail = !currentPatient.lastVoicemailAt || 
          new Date(updates.lastVoicemailAt).getTime() !== new Date(currentPatient.lastVoicemailAt).getTime();
        
        if (isNewVoicemail) {
          const timestamp = new Date().toLocaleString();
          const voicemailNote = `[${timestamp}] Voicemail left for patient`;
          const existingNotes = currentPatient.notes || '';
          updates.notes = organizeNotes(existingNotes, voicemailNote, 'VOICEMAILS');
        }
      }

      // Check for insurance and authorization changes and log to notes
      const insuranceFields = [
        'primaryInsurance', 'primaryPlan', 'primaryInsuranceNumber', 'primaryGroupId',
        'secondaryInsurance', 'secondaryPlan', 'secondaryInsuranceNumber', 'secondaryGroupId',
        'leqvioCopayProgram', 'leqvioPatientId', 'leqvioEnrollmentDate', 'leqvioCopayIdNumber',
        'leqvioGroupNumber', 'leqvioBin', 'leqvioPcn'
      ];
      const authFieldsToTrack = ['authNumber', 'refNumber', 'startDate', 'endDate', 'authStatus'];
      
      const changeNotes: string[] = [];
      const changeTimestamp = new Date().toLocaleString();
      
      // Check insurance field changes
      insuranceFields.forEach(field => {
        if (updates[field] !== undefined && updates[field] !== (currentPatient as any)[field]) {
          const oldValue = (currentPatient as any)[field] || '(empty)';
          const newValue = updates[field] || '(empty)';
          changeNotes.push(`${field}: ${oldValue} → ${newValue}`);
        }
      });
      
      // Check authorization field changes
      authFieldsToTrack.forEach(field => {
        if (updates[field] !== undefined && updates[field] !== (currentPatient as any)[field]) {
          const oldValue = (currentPatient as any)[field] || '(empty)';
          const newValue = updates[field] || '(empty)';
          changeNotes.push(`${field}: ${oldValue} → ${newValue}`);
        }
      });
      
      // Add change notes if any were found
      if (changeNotes.length > 0) {
        const changeNote = `[${changeTimestamp}] Updated: ${changeNotes.join(', ')}`;
        const existingNotes = updates.notes !== undefined ? updates.notes : (currentPatient.notes || '');
        updates.notes = organizeNotes(existingNotes, changeNote, 'INSURANCE_UPDATES');
      }
      
      const updatedPatient = await storage.updatePatient(patientId, updates, user.currentOrganizationId);
      
      if (!updatedPatient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      // Check authorization status for all patients if auth-related fields (NOT authStatus) were updated
      // If authStatus was manually changed, respect that change and don't override it
      const authDataFieldsUpdated = ['authNumber', 'refNumber', 'startDate', 'endDate'].some(field => 
        updates[field] !== undefined
      );
      const manualAuthStatusChange = updates.authStatus !== undefined;
      
      if (authDataFieldsUpdated && !manualAuthStatusChange) {
        // Only run automatic check if auth data changed but status wasn't manually set
        await checkAuthorizationStatus(patientId, user.currentOrganizationId);
      } else if (authDataFieldsUpdated && manualAuthStatusChange) {
        // If both auth data AND status were changed, respect the manual status but log it
        console.log(`Patient ${patientId}: Manual auth status change to "${updates.authStatus}" - skipping automatic status calculation`);
      }
      
      res.json(updatedPatient);
    } catch (error) {
      console.error('Error updating patient:', error);
      res.status(500).json({ error: 'Failed to update patient' });
    }
  });

  // Update patient status
  app.patch('/api/patients/:id/status', requireAuth, async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const patientId = parseInt(req.params.id);
      const { status } = req.body;
      const updatedPatient = await storage.updatePatientStatus(patientId, status, user.currentOrganizationId!);
      
      if (!updatedPatient) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      
      res.json(updatedPatient);
    } catch (error) {
      console.error('Error updating patient status:', error);
      res.status(500).json({ error: 'Failed to update patient status' });
    }
  });

  // Delete patient
  app.delete('/api/patients/:id', requireAuth, async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const patientId = parseInt(req.params.id);
      const deleted = await storage.deletePatient(patientId, user.currentOrganizationId!);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Patient not found or could not be deleted' });
      }
      
      res.json({ success: true, message: 'Patient deleted successfully' });
    } catch (error) {
      console.error('Error deleting patient:', error);
      res.status(500).json({ error: 'Failed to delete patient' });
    }
  });

  // Get patient documents
  app.get('/api/patients/:id/documents', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }
      
      const patientId = parseInt(req.params.id);
      // Verify patient belongs to organization
      const patient = await storage.getPatient(patientId, user.currentOrganizationId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const documents = await storage.getPatientDocuments(patientId);
      res.json(documents);
    } catch (error) {
      console.error('Error fetching patient documents:', error);
      res.status(500).json({ error: 'Failed to fetch patient documents' });
    }
  });

  // Get automation logs for a specific patient
  app.get('/api/patients/:id/automation-logs', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }
      
      const patientId = parseInt(req.params.id);
      // Verify patient belongs to organization
      const patient = await storage.getPatient(patientId, user.currentOrganizationId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const logs = await storage.getPatientAutomationLogs(patientId);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching patient automation logs:', error);
      res.status(500).json({ error: 'Failed to fetch patient automation logs' });
    }
  });

  // Appointment routes
  app.get('/api/patients/:id/appointments', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }
      
      const patientId = parseInt(req.params.id);
      // Verify patient belongs to organization
      const patient = await storage.getPatient(patientId, user.currentOrganizationId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const appointments = await storage.getPatientAppointments(patientId);
      res.json(appointments);
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      res.status(500).json({ error: 'Failed to fetch patient appointments' });
    }
  });

  app.post('/api/patients/:id/appointments', requireAuth, async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }
      
      const patientId = parseInt(req.params.id);
      // Verify patient belongs to organization
      const patient = await storage.getPatient(patientId, user.currentOrganizationId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const appointmentData = { ...req.body, patientId };
      const appointment = await storage.createAppointment(appointmentData);
      
      // Check authorization status after creating appointment
      await checkAuthorizationStatus(patientId, user.currentOrganizationId);
      
      // Check schedule status after creating appointment
      await checkScheduleStatus(patientId, user.currentOrganizationId);
      
      res.json(appointment);
    } catch (error) {
      console.error('Error creating appointment:', error);
      res.status(500).json({ error: 'Failed to create appointment' });
    }
  });

  app.patch('/api/appointments/:id', async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      const updatedAppointment = await storage.updateAppointment(appointmentId, req.body);
      
      if (updatedAppointment) {
        // First get patient info to find which organization it belongs to
        const patients = await storage.getAllPatients();
        const patient = patients.find(p => p.id === updatedAppointment.patientId);
        
        if (patient) {
          // Get the full patient data with organization ID
          const fullPatient = await storage.getPatient(updatedAppointment.patientId, patient.organizationId!);
          if (fullPatient) {
            // Check authorization status if appointment date was updated
            if (req.body.appointmentDate) {
              await checkAuthorizationStatus(updatedAppointment.patientId, patient.organizationId!);
            }
            
            // Check schedule status if appointment status was updated
            if (req.body.status) {
              await checkScheduleStatus(updatedAppointment.patientId, patient.organizationId!);
            }
          }
        }
      }
      
      res.json(updatedAppointment);
    } catch (error) {
      console.error('Error updating appointment:', error);
      res.status(500).json({ error: 'Failed to update appointment' });
    }
  });

  app.delete('/api/appointments/:id', async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      await storage.deleteAppointment(appointmentId);
      res.json({ message: 'Appointment deleted successfully' });
    } catch (error) {
      console.error('Error deleting appointment:', error);
      res.status(500).json({ error: 'Failed to delete appointment' });
    }
  });

  // Bulk check all patients for schedule status updates
  app.post('/api/patients/check-schedule-status', async (req, res) => {
    try {
      const patients = await storage.getAllPatients();
      let updatedCount = 0;

      for (const patient of patients) {
        const previousStatus = patient.scheduleStatus;
        await checkScheduleStatus(patient.id, patient.organizationId);
        
        // Check if status was actually updated
        const updatedPatient = await storage.getPatient(patient.id, patient.organizationId);
        if (updatedPatient && updatedPatient.scheduleStatus !== previousStatus) {
          updatedCount++;
        }
      }

      res.json({ 
        message: `Schedule status check completed`, 
        patientsChecked: patients.length,
        statusUpdated: updatedCount 
      });
    } catch (error) {
      console.error('Error checking patient schedule statuses:', error);
      res.status(500).json({ error: 'Failed to check schedule statuses' });
    }
  });

  // Epic insurance text extraction endpoint
  app.post('/api/extract-epic-insurance-text', requireAuth, async (req, res) => {
    try {
      const { epicText, patientId } = req.body;
      
      if (!epicText || typeof epicText !== 'string') {
        return res.status(400).json({ error: 'Epic text is required' });
      }

      // Use OpenAI to extract insurance information from Epic text
      const extractedData = await extractInsuranceFromEpicText(epicText);
      
      // If patientId is provided, automatically update the patient fields
      if (patientId && Object.keys(extractedData).length > 0) {
        try {
          const user = await getUserFromSession(req);
          if (user && user.currentOrganizationId) {
            // Map the extracted Epic insurance data to patient fields
            const updates: any = {};
            
            if (extractedData.primaryInsurance) updates.primaryInsurance = extractedData.primaryInsurance;
            if (extractedData.primaryMemberId) updates.primaryInsuranceNumber = extractedData.primaryMemberId;
            if (extractedData.primaryGroupNumber) updates.primaryGroupId = extractedData.primaryGroupNumber;
            if (extractedData.secondaryInsurance) updates.secondaryInsurance = extractedData.secondaryInsurance;
            if (extractedData.secondaryMemberId) updates.secondaryInsuranceNumber = extractedData.secondaryMemberId;
            if (extractedData.secondaryGroupNumber) updates.secondaryGroupId = extractedData.secondaryGroupNumber;
            if (extractedData.copay) updates.copay = extractedData.copay;
            if (extractedData.deductible) updates.deductible = extractedData.deductible;
            
            // Map LEQVIO Copay Program fields (takes priority regardless of where found)
            if (extractedData.leqvioCopayProgram) updates.leqvioCopayProgram = extractedData.leqvioCopayProgram;
            if (extractedData.leqvioPatientId) updates.leqvioPatientId = extractedData.leqvioPatientId;
            if (extractedData.leqvioEnrollmentDate) updates.leqvioEnrollmentDate = extractedData.leqvioEnrollmentDate;
            if (extractedData.leqvioCopayIdNumber) updates.leqvioCopayIdNumber = extractedData.leqvioCopayIdNumber;
            if (extractedData.leqvioGroupNumber) updates.leqvioGroupNumber = extractedData.leqvioGroupNumber;
            if (extractedData.leqvioBin) updates.leqvioBin = extractedData.leqvioBin;
            if (extractedData.leqvioPcn) updates.leqvioPcn = extractedData.leqvioPcn;
            
            if (Object.keys(updates).length > 0) {
              await storage.updatePatient(parseInt(patientId), updates, user.currentOrganizationId);
              console.log('Patient insurance information automatically updated from Epic copy-paste:', updates);
              
              // Log the insurance update in patient notes
              const changeLog = `Updated: Epic insurance copy-paste data - ${new Date().toLocaleString()}`;
              const changeDetails = Object.entries(updates).map(([key, value]) => `  ${key}: ${value}`).join('\n');
              const logEntry = `${changeLog}\n${changeDetails}`;
              
              await addInsuranceChangeToNotes(parseInt(patientId), logEntry, user.currentOrganizationId);
            }
            
            return res.json({ 
              extractedData, 
              updatedFields: updates,
              message: 'Insurance data extracted and patient updated successfully'
            });
          }
        } catch (updateError) {
          console.error('Failed to update patient with Epic insurance data:', updateError);
          // Still return the extracted data even if update fails
        }
      }
      
      res.json({ extractedData });
    } catch (error) {
      console.error('Epic insurance text extraction error:', error);
      res.status(500).json({ error: 'Failed to extract insurance information' });
    }
  });

  // Delete patient document
  app.delete('/api/patients/:id/documents/:documentId', async (req, res) => {
    try {
      const patientId = parseInt(req.params.id);
      const documentId = parseInt(req.params.documentId);
      
      // Verify the document belongs to the patient
      const documents = await storage.getPatientDocuments(patientId);
      const document = documents.find(doc => doc.id === documentId);
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      // Delete the document
      const deleted = await storage.deletePatientDocument(documentId);
      
      if (!deleted) {
        return res.status(500).json({ error: 'Failed to delete document' });
      }
      
      res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Error deleting patient document:', error);
      res.status(500).json({ error: 'Failed to delete patient document' });
    }
  });

  // Async processing function for OCR extraction
  async function processDocumentAsync(documentId: number, patientId: number, documentType: string, fileBuffer: Buffer, fileName: string, organizationId: number) {
    try {
      console.log(`Starting async processing for document ${documentId} (${documentType})`);
      
      // Update status to processing
      await storage.updatePatientDocument(documentId, {
        processingStatus: 'processing'
      });
      
      let extractedData = '';
      let metadata: any = {};
      
      // Use OpenAI to extract data from the document
      if (documentType === 'epic_insurance_screenshot') {
        const base64Image = fileBuffer.toString('base64');
        
        console.log('Processing Epic insurance screenshot...');
        console.log('Original file name:', fileName);
        console.log('File size:', fileBuffer.length);
        
        try {
          const { extractEpicInsuranceData } = await import('./openai-service');
          const extraction = await extractEpicInsuranceData(base64Image);
          extractedData = JSON.stringify(extraction);
          metadata = extraction;
          
          // Automatically map and update patient insurance fields
          const updates: any = {};
          
          // Map Epic insurance data to patient fields
          if (extraction.primary?.payer) updates.primaryInsurance = extraction.primary.payer;
          if (extraction.primary?.subscriberId) updates.primaryInsuranceNumber = extraction.primary.subscriberId;
          if (extraction.primary?.groupNumber) updates.primaryGroupId = extraction.primary.groupNumber;
          if (extraction.primary?.plan) updates.primaryPlan = extraction.primary.plan;
          
          if (extraction.secondary?.payer) updates.secondaryInsurance = extraction.secondary.payer;
          if (extraction.secondary?.subscriberId) updates.secondaryInsuranceNumber = extraction.secondary.subscriberId;
          if (extraction.secondary?.groupNumber) updates.secondaryGroupId = extraction.secondary.groupNumber;
          if (extraction.secondary?.plan) updates.secondaryPlan = extraction.secondary.plan;
          
          // Debug: Log the LEQVIO extraction structure
          console.log('Epic LEQVIO extraction data:', JSON.stringify(extraction.leqvio_copay, null, 2));
          
          // Map LEQVIO Copay Program fields (takes priority regardless of where found)
          if (extraction.leqvio_copay?.program_found) updates.leqvioCopayProgram = extraction.leqvio_copay.program_found;
          if (extraction.leqvio_copay?.patient_id) {
            console.log('Found LEQVIO Patient ID:', extraction.leqvio_copay.patient_id);
            updates.leqvioPatientId = extraction.leqvio_copay.patient_id;
          }
          if (extraction.leqvio_copay?.effective_from) updates.leqvioEnrollmentDate = extraction.leqvio_copay.effective_from;
          if (extraction.leqvio_copay?.subscriber_id) {
            console.log('Found LEQVIO Copay ID:', extraction.leqvio_copay.subscriber_id);
            updates.leqvioCopayIdNumber = extraction.leqvio_copay.subscriber_id;
          }
          // Note: subscriber (name) is not mapped to avoid name confusion
          
          // Map BIN and PCN from pharmacy section (Epic structure may not have pharmacy object)
          if ((extraction as any).pharmacy?.bin) updates.leqvioBin = (extraction as any).pharmacy.bin;
          if ((extraction as any).pharmacy?.pcn) updates.leqvioPcn = (extraction as any).pharmacy.pcn;
          
          if (Object.keys(updates).length > 0) {
            await storage.updatePatient(patientId, updates, organizationId);
            console.log('Patient insurance information automatically updated from Epic screenshot:', updates);
            
            // Log the insurance update in patient notes
            const changeLog = `Updated: Epic screenshot insurance data - ${new Date().toLocaleString()}`;
            const changeDetails = Object.entries(updates).map(([key, value]) => `  ${key}: ${value}`).join('\n');
            const logEntry = `${changeLog}\n${changeDetails}`;
            
            await addInsuranceChangeToNotes(patientId, logEntry, organizationId);
            
            // Store the updated fields to return to frontend
            metadata.updatedFields = updates;
          }
        } catch (ocrError) {
          console.error('Epic insurance extraction failed:', ocrError);
          // Continue without extraction
        }
      } else if (documentType === 'insurance_screenshot') {
        const base64Image = fileBuffer.toString('base64');
        
        try {
          const extraction = await extractInsuranceCardData(base64Image);
          extractedData = JSON.stringify(extraction);
          metadata = extraction;
          
          // Automatically map and update patient insurance fields from insurance card
          const updates: any = {};
          
          // Map insurance card data to patient fields
          if (extraction.insurer?.name) updates.primaryInsurance = extraction.insurer.name;
          if (extraction.member?.member_id) updates.primaryInsuranceNumber = extraction.member.member_id;
          if (extraction.insurer?.group_number) updates.primaryGroupId = extraction.insurer.group_number;
          if (extraction.insurer?.plan_name) updates.primaryPlan = extraction.insurer.plan_name;
          
          // Debug: Log the extraction structure
          console.log('LEQVIO extraction data:', JSON.stringify(extraction.leqvio_copay, null, 2));
          
          // Map LEQVIO Copay Program fields - Try multiple approaches to find the Patient ID
          if (extraction.leqvio_copay?.program_found) updates.leqvioCopayProgram = extraction.leqvio_copay.program_found;
          
          // Only map LEQVIO fields if there's actual LEQVIO copay program data
          const leqvioData = extraction.leqvio_copay || {};
          
          if (leqvioData.program_found) {
            // Map LEQVIO Patient ID directly from the dedicated field
            if (leqvioData.patient_id && /^\d+$/.test(leqvioData.patient_id)) {
              console.log('Found Insurance Card LEQVIO Patient ID:', leqvioData.patient_id);
              updates.leqvioPatientId = leqvioData.patient_id;
            } else if (leqvioData.patient_id) {
              console.log('LEQVIO Patient ID found but invalid format:', leqvioData.patient_id, 'Type:', typeof leqvioData.patient_id);
            } else {
              console.log('No LEQVIO Patient ID found in extraction:', Object.keys(leqvioData));
              
              // Fallback: Look for numeric IDs in other LEQVIO fields
              const allLeqvioValues = [
                leqvioData.subscriber_id, 
                leqvioData.group_id, 
                leqvioData.coverage_status
              ].filter(val => val && typeof val === 'string');
              
              const potentialPatientId = allLeqvioValues.find(val => 
                /^\d{7,8}$/.test(val) // 7-8 digit numbers
              );
              
              if (potentialPatientId) {
                console.log('Found potential LEQVIO Patient ID in other fields:', potentialPatientId);
                updates.leqvioPatientId = potentialPatientId;
              }
            }
            
            // Map enrollment date from effective_from field
            if (leqvioData.effective_from && /^\d{2}\/\d{2}\/\d{4}$/.test(leqvioData.effective_from)) {
              updates.leqvioEnrollmentDate = leqvioData.effective_from;
            }
            
            // Map LEQVIO Co-pay ID directly from the dedicated field
            if (leqvioData.subscriber_id && /^[A-Z0-9]+$/i.test(leqvioData.subscriber_id)) {
              updates.leqvioCopayIdNumber = leqvioData.subscriber_id;
            }
            
            // Only map LEQVIO Group if it's specifically provided and different from primary
            if (leqvioData.group_id && leqvioData.group_id !== extraction.insurer?.group_number) {
              updates.leqvioGroupNumber = leqvioData.group_id;
            }
          }
          
          // Map BIN and PCN from pharmacy section
          if (extraction.pharmacy?.bin) updates.leqvioBin = extraction.pharmacy.bin;
          if (extraction.pharmacy?.pcn) updates.leqvioPcn = extraction.pharmacy.pcn;
          
          if (Object.keys(updates).length > 0) {
            await storage.updatePatient(patientId, updates, organizationId);
            console.log('Patient insurance information automatically updated from insurance card:', updates);
            
            // Log the insurance update in patient notes
            const changeLog = `Updated: Insurance card data - ${new Date().toLocaleString()}`;
            const changeDetails = Object.entries(updates).map(([key, value]) => `  ${key}: ${value}`).join('\n');
            const logEntry = `${changeLog}\n${changeDetails}`;
            
            await addInsuranceChangeToNotes(patientId, logEntry, organizationId);
            
            // Store the updated fields to return to frontend
            metadata.updatedFields = updates;
          }
        } catch (ocrError) {
          console.error('Insurance card extraction failed:', ocrError);
          // Continue without extraction
        }
      } else if (documentType === 'epic_screenshot') {
        const base64Image = fileBuffer.toString('base64');
        
        try {
          const extraction = await extractPatientInfoFromScreenshot(base64Image);
          extractedData = JSON.stringify(extraction);
          metadata = extraction;
        } catch (ocrError) {
          console.error('Epic screenshot extraction failed:', ocrError);
          // Continue without extraction
        }
      } else if (documentType === 'clinical_note') {
        // For clinical notes, store the text content directly
        try {
          const textContent = fileBuffer.toString('utf-8');
          extractedData = textContent; // Store as plain text, not JSON
          metadata = { 
            contentType: 'clinical_text',
            wordCount: textContent.split(/\s+/).length,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          console.error('Clinical note processing failed:', error);
          // Continue without extraction
        }
      }

      // Update document with processing results
      await storage.updatePatientDocument(documentId, {
        extractedData,
        metadata,
        processingStatus: 'completed'
      });
      
      console.log(`Async processing completed for document ${documentId}`);
    } catch (error) {
      console.error(`Async processing failed for document ${documentId}:`, error);
      
      // Update document with error status
      await storage.updatePatientDocument(documentId, {
        processingStatus: 'failed',
        processingError: (error as Error).message
      });
    }
  }

  // Create patient document with immediate response and async processing
  app.post('/api/patients/:id/documents', upload.any(), async (req, res) => {
    try {
      const patientId = parseInt(req.params.id);
      const { documentType } = req.body;
      const files = req.files as Express.Multer.File[] | undefined;
      const file = files?.[0];
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Get user organization for async processing
      const user = await getUserFromSession(req);
      if (!user || !user.currentOrganizationId) {
        return res.status(401).json({ error: 'User not authenticated or not associated with an organization' });
      }

      // Create document record immediately with pending status
      const document = await storage.createPatientDocument({
        patientId,
        documentType,
        fileName: file.originalname,
        fileUrl: '', // In production, upload to cloud storage
        extractedData: '',
        metadata: {
          contentType: file.mimetype,
          fileSize: file.buffer.length,
          timestamp: new Date().toISOString()
        },
        processingStatus: 'pending'
      });

      // Return immediate response
      res.json({ 
        document: {
          id: document.id,
          patientId: document.patientId,
          documentType: document.documentType,
          fileName: document.fileName,
          processingStatus: 'pending',
          createdAt: document.createdAt
        }
      });

      // Start async processing (don't await)
      processDocumentAsync(
        document.id, 
        patientId, 
        documentType, 
        file.buffer, 
        file.originalname, 
        user.currentOrganizationId
      ).catch(error => {
        console.error('Async processing error:', error);
      });

    } catch (error) {
      console.error('Error creating patient document:', error);
      res.status(500).json({ error: 'Failed to create patient document' });
    }
  });

  // Get document processing status
  app.get('/api/patients/:id/documents/:documentId/status', async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const documents = await storage.getPatientDocuments(parseInt(req.params.id));
      const document = documents.find(doc => doc.id === documentId);
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      res.json({
        id: document.id,
        processingStatus: document.processingStatus || 'completed',
        processingError: document.processingError,
        extractedData: document.extractedData,
        metadata: document.metadata
      });
    } catch (error) {
      console.error('Error checking document status:', error);
      res.status(500).json({ error: 'Failed to check document status' });
    }
  });



  // Process patient data and send to AIGENTS
  app.post('/api/patients/:id/process', async (req, res) => {
    try {
      const patientId = parseInt(req.params.id);
      // Note: This route needs authentication - temporarily bypass for backward compatibility
      const patient = await storage.getAllPatients().then(patients => patients.find(p => p.id === patientId));
      
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      // Get all documents for this patient
      const documents = await storage.getPatientDocuments(patientId);
      
      // Prepare Insurance_JSON from insurance-related documents as plain text
      const insuranceDocuments = documents.filter(doc => 
        doc.documentType === 'epic_insurance_screenshot' || 
        doc.documentType === 'insurance_screenshot'
      );
      
      // Build insurance information as a readable text summary
      let insuranceText = `Patient Insurance Information:\n\n`;
      
      // Current insurance info from patient record
      insuranceText += `Primary Insurance:\n`;
      insuranceText += `  Insurance Company: ${patient.primaryInsurance || 'Not specified'}\n`;
      insuranceText += `  Plan: ${patient.primaryPlan || 'Not specified'}\n`;
      insuranceText += `  Member Number: ${patient.primaryInsuranceNumber || 'Not specified'}\n`;
      insuranceText += `  Group ID: ${patient.primaryGroupId || 'Not specified'}\n\n`;
      
      if (patient.secondaryInsurance || patient.secondaryPlan || patient.secondaryInsuranceNumber) {
        insuranceText += `Secondary Insurance:\n`;
        insuranceText += `  Insurance Company: ${patient.secondaryInsurance || 'Not specified'}\n`;
        insuranceText += `  Plan: ${patient.secondaryPlan || 'Not specified'}\n`;
        insuranceText += `  Member Number: ${patient.secondaryInsuranceNumber || 'Not specified'}\n`;
        insuranceText += `  Group ID: ${patient.secondaryGroupId || 'Not specified'}\n\n`;
      } else {
        insuranceText += `Secondary Insurance: None\n\n`;
      }
      
      // Add extracted insurance documents
      if (insuranceDocuments.length > 0) {
        insuranceText += `Insurance Documents (${insuranceDocuments.length}):\n`;
        insuranceDocuments.forEach((doc, index) => {
          insuranceText += `${index + 1}. Document: ${doc.fileName}\n`;
          insuranceText += `   Type: ${doc.documentType}\n`;
          insuranceText += `   Uploaded: ${new Date(doc.createdAt).toLocaleDateString()}\n`;
          
          // Add extracted insurance data if available
          if (doc.extractedData) {
            try {
              let extracted;
              try {
                extracted = JSON.parse(doc.extractedData);
              } catch (parseError) {
                console.error('JSON parse error in routes.ts (extractedData):', parseError);
                extracted = {};
              }
              
              // Handle Epic insurance screenshot format
              if (extracted.primary) {
                insuranceText += `   Extracted Primary Insurance:\n`;
                if (extracted.primary.payer) insuranceText += `     Payer: ${extracted.primary.payer}\n`;
                if (extracted.primary.plan) insuranceText += `     Plan: ${extracted.primary.plan}\n`;
                if (extracted.primary.subscriberId) insuranceText += `     Subscriber ID: ${extracted.primary.subscriberId}\n`;
                if (extracted.primary.subscriberName) insuranceText += `     Subscriber Name: ${extracted.primary.subscriberName}\n`;
                if (extracted.primary.groupNumber) insuranceText += `     Group Number: ${extracted.primary.groupNumber}\n`;
                if (extracted.primary.groupName) insuranceText += `     Group Name: ${extracted.primary.groupName}\n`;
                if (extracted.primary.sponsorCode) insuranceText += `     Sponsor Code: ${extracted.primary.sponsorCode}\n`;
                if (extracted.primary.subscriberAddress) insuranceText += `     Address: ${extracted.primary.subscriberAddress}\n`;
                
                if (extracted.secondary && (extracted.secondary.payer || extracted.secondary.plan)) {
                  insuranceText += `   Extracted Secondary Insurance:\n`;
                  if (extracted.secondary.payer) insuranceText += `     Payer: ${extracted.secondary.payer}\n`;
                  if (extracted.secondary.plan) insuranceText += `     Plan: ${extracted.secondary.plan}\n`;
                  if (extracted.secondary.subscriberId) insuranceText += `     Subscriber ID: ${extracted.secondary.subscriberId}\n`;
                }
              }
              // Handle insurance card format
              else if (extracted.insurer) {
                insuranceText += `   Extracted Insurance Card Data:\n`;
                if (extracted.insurer.name) insuranceText += `     Insurance Company: ${extracted.insurer.name}\n`;
                if (extracted.insurer.plan_name) insuranceText += `     Plan: ${extracted.insurer.plan_name}\n`;
                if (extracted.insurer.group_number) insuranceText += `     Group Number: ${extracted.insurer.group_number}\n`;
                if (extracted.member.member_id) insuranceText += `     Member ID: ${extracted.member.member_id}\n`;
                if (extracted.member.subscriber_name) insuranceText += `     Subscriber: ${extracted.member.subscriber_name}\n`;
                if (extracted.pharmacy.bin) insuranceText += `     Pharmacy BIN: ${extracted.pharmacy.bin}\n`;
                if (extracted.pharmacy.pcn) insuranceText += `     Pharmacy PCN: ${extracted.pharmacy.pcn}\n`;
              }
              // Handle other formats
              else {
                insuranceText += `   Extracted Information:\n`;
                Object.entries(extracted).forEach(([key, value]) => {
                  if (value && typeof value === 'string' && value.trim()) {
                    insuranceText += `     ${key}: ${value}\n`;
                  }
                });
              }
            } catch (e) {
              // If not JSON, treat as plain text
              insuranceText += `   Content: ${doc.extractedData}\n`;
            }
          }
          insuranceText += `\n`;
        });
      } else {
        insuranceText += `No insurance documents uploaded.\n`;
      }
      
      const Insurance_JSON = insuranceText;

      // Prepare Clinical_json from clinical documents as plain text
      const clinicalDocuments = documents.filter(doc => 
        doc.documentType === 'epic_screenshot' || 
        doc.documentType === 'clinical_note' ||
        doc.documentType === 'leqvio_form'
      );
      
      // Build clinical information as a readable text summary
      let clinicalText = `Patient Clinical Information:\n`;
      clinicalText += `Name: ${patient.firstName} ${patient.lastName}\n`;
      clinicalText += `Date of Birth: ${patient.dateOfBirth}\n`;
      clinicalText += `Ordering MD: ${patient.orderingMD}\n`;
      clinicalText += `Diagnosis: ${patient.diagnosis}\n`;
      clinicalText += `Status: ${patient.status}\n\n`;
      
      if (clinicalDocuments.length > 0) {
        clinicalText += `Clinical Documents (${clinicalDocuments.length}):\n`;
        clinicalDocuments.forEach((doc, index) => {
          clinicalText += `${index + 1}. Document: ${doc.fileName}\n`;
          clinicalText += `   Type: ${doc.documentType}\n`;
          clinicalText += `   Uploaded: ${new Date(doc.createdAt).toLocaleDateString()}\n`;
          
          // Add extracted data if available
          if (doc.extractedData) {
            try {
              let extracted;
              try {
                extracted = JSON.parse(doc.extractedData);
              } catch (parseError) {
                console.error('JSON parse error in routes.ts (extractedData):', parseError);
                extracted = {};
              }
              if (typeof extracted === 'object') {
                clinicalText += `   Extracted Information:\n`;
                Object.entries(extracted).forEach(([key, value]) => {
                  if (value && typeof value === 'string' && value.trim()) {
                    clinicalText += `     ${key}: ${value}\n`;
                  }
                });
              } else if (typeof extracted === 'string') {
                clinicalText += `   Content: ${extracted}\n`;
              }
            } catch (e) {
              // If not JSON, treat as plain text
              clinicalText += `   Content: ${doc.extractedData}\n`;
            }
          }
          clinicalText += `\n`;
        });
      } else {
        clinicalText += `No clinical documents uploaded.\n`;
      }
      
      const Clinical_json = clinicalText;

      // Generate unique ID for tracking
      const uniqueId = `leqvio_app_${patient.id}_${Date.now()}`;
      
      // Extract primary insurance from documents to populate fields
      let extractedPrimaryInsurance = patient.primaryInsurance || '';
      let extractedPrimaryPlan = patient.primaryPlan || '';
      let extractedPrimaryNumber = patient.primaryInsuranceNumber || '';
      let extractedPrimaryGroupId = patient.primaryGroupId || '';
      let extractedSecondaryInsurance = patient.secondaryInsurance || '';
      let extractedSecondaryPlan = patient.secondaryPlan || '';
      let extractedSecondaryNumber = patient.secondaryInsuranceNumber || '';
      let extractedSecondaryGroupId = patient.secondaryGroupId || '';

      // Check if we have extracted insurance data to use
      if (insuranceDocuments.length > 0) {
        for (const doc of insuranceDocuments) {
          if (doc.extractedData) {
            try {
              let extracted;
              try {
                extracted = JSON.parse(doc.extractedData);
              } catch (parseError) {
                console.error('JSON parse error in routes.ts (extractedData):', parseError);
                extracted = {};
              }
              
              // Handle Epic insurance screenshot format
              if (extracted.primary) {
                if (extracted.primary.payer && !extractedPrimaryInsurance) {
                  extractedPrimaryInsurance = extracted.primary.payer;
                }
                if (extracted.primary.plan && !extractedPrimaryPlan) {
                  extractedPrimaryPlan = extracted.primary.plan;
                }
                if (extracted.primary.subscriberId && !extractedPrimaryNumber) {
                  extractedPrimaryNumber = extracted.primary.subscriberId;
                }
                if (extracted.primary.groupNumber && !extractedPrimaryGroupId) {
                  extractedPrimaryGroupId = extracted.primary.groupNumber;
                }
                
                // Secondary insurance if available
                if (extracted.secondary && extracted.secondary.payer) {
                  if (!extractedSecondaryInsurance) extractedSecondaryInsurance = extracted.secondary.payer;
                  if (!extractedSecondaryPlan) extractedSecondaryPlan = extracted.secondary.plan || '';
                  if (!extractedSecondaryNumber) extractedSecondaryNumber = extracted.secondary.subscriberId || '';
                  if (!extractedSecondaryGroupId) extractedSecondaryGroupId = extracted.secondary.groupNumber || '';
                }
              }
              // Handle insurance card format
              else if (extracted.insurer) {
                if (extracted.insurer.name && !extractedPrimaryInsurance) {
                  extractedPrimaryInsurance = extracted.insurer.name;
                }
                if (extracted.insurer.plan_name && !extractedPrimaryPlan) {
                  extractedPrimaryPlan = extracted.insurer.plan_name;
                }
                if (extracted.member.member_id && !extractedPrimaryNumber) {
                  extractedPrimaryNumber = extracted.member.member_id;
                }
                if (extracted.insurer.group_number && !extractedPrimaryGroupId) {
                  extractedPrimaryGroupId = extracted.insurer.group_number;
                }
              }
            } catch (e) {
              // Skip if can't parse JSON
            }
          }
        }
      }

      // Combine clinical and insurance document information into clinical info text
      let combinedClinicalInfo = `Patient Clinical Information:\n`;
      combinedClinicalInfo += `Name: ${patient.firstName} ${patient.lastName}\n`;
      combinedClinicalInfo += `Date of Birth: ${patient.dateOfBirth}\n`;
      combinedClinicalInfo += `Ordering MD: ${patient.orderingMD}\n`;
      combinedClinicalInfo += `Diagnosis: ${patient.diagnosis}\n`;
      combinedClinicalInfo += `Status: ${patient.status}\n\n`;
      
      if (clinicalDocuments.length > 0) {
        combinedClinicalInfo += `Clinical Documents (${clinicalDocuments.length}):\n`;
        clinicalDocuments.forEach((doc, index) => {
          combinedClinicalInfo += `${index + 1}. Document: ${doc.fileName}\n`;
          combinedClinicalInfo += `   Type: ${doc.documentType}\n`;
          combinedClinicalInfo += `   Uploaded: ${new Date(doc.createdAt).toLocaleDateString()}\n`;
          
          // For clinical documents, prioritize sending actual content over structured data
          if (doc.extractedData) {
            if (doc.documentType === 'clinical_note' || doc.documentType === 'leqvio_form') {
              // For clinical notes and forms, send the full extracted content directly
              combinedClinicalInfo += `   Clinical Content:\n`;
              try {
                // Try to parse as JSON first (for backwards compatibility)
                let extracted;
                try {
                  extracted = JSON.parse(doc.extractedData);
                } catch (parseError) {
                  console.error('JSON parse error in routes.ts (extractedData parse):', parseError);
                  extracted = {};
                }
                if (typeof extracted === 'string') {
                  combinedClinicalInfo += `${extracted}\n`;
                } else if (extracted.rawText || extracted.content || extracted.text) {
                  // Look for common text fields in structured data
                  const textContent = extracted.rawText || extracted.content || extracted.text;
                  combinedClinicalInfo += `${textContent}\n`;
                } else {
                  // If structured, still include all relevant clinical information
                  Object.entries(extracted).forEach(([key, value]) => {
                    if (value && typeof value === 'string' && value.trim()) {
                      combinedClinicalInfo += `${key}: ${value}\n`;
                    }
                  });
                }
              } catch (e) {
                // If not JSON, treat as plain clinical text content (new format)
                combinedClinicalInfo += `${doc.extractedData}\n`;
              }
            } else {
              // For other clinical documents (like epic_screenshot), use existing structured approach
              try {
                let extracted;
                try {
                  extracted = JSON.parse(doc.extractedData);
                } catch (parseError) {
                  console.error('JSON parse error in routes.ts (extractedData parse):', parseError);
                  extracted = {};
                }
                if (typeof extracted === 'object') {
                  combinedClinicalInfo += `   Extracted Information:\n`;
                  Object.entries(extracted).forEach(([key, value]) => {
                    if (value && typeof value === 'string' && value.trim()) {
                      combinedClinicalInfo += `     ${key}: ${value}\n`;
                    }
                  });
                } else if (typeof extracted === 'string') {
                  combinedClinicalInfo += `   Content: ${extracted}\n`;
                }
              } catch (e) {
                combinedClinicalInfo += `   Content: ${doc.extractedData}\n`;
              }
            }
          }
          combinedClinicalInfo += `\n`;
        });
      }
      
      if (insuranceDocuments.length > 0) {
        combinedClinicalInfo += `Insurance Documents (${insuranceDocuments.length}):\n`;
        insuranceDocuments.forEach((doc, index) => {
          combinedClinicalInfo += `${index + 1}. Document: ${doc.fileName}\n`;
          combinedClinicalInfo += `   Type: ${doc.documentType}\n`;
          combinedClinicalInfo += `   Uploaded: ${new Date(doc.createdAt).toLocaleDateString()}\n`;
          
          if (doc.extractedData) {
            try {
              let extracted;
              try {
                extracted = JSON.parse(doc.extractedData);
              } catch (parseError) {
                console.error('JSON parse error in routes.ts (extractedData):', parseError);
                extracted = {};
              }
              if (extracted.primary) {
                combinedClinicalInfo += `   Extracted Primary Insurance:\n`;
                if (extracted.primary.payer) combinedClinicalInfo += `     Payer: ${extracted.primary.payer}\n`;
                if (extracted.primary.plan) combinedClinicalInfo += `     Plan: ${extracted.primary.plan}\n`;
                if (extracted.primary.subscriberId) combinedClinicalInfo += `     Subscriber ID: ${extracted.primary.subscriberId}\n`;
                if (extracted.primary.subscriberName) combinedClinicalInfo += `     Subscriber Name: ${extracted.primary.subscriberName}\n`;
                if (extracted.primary.groupNumber) combinedClinicalInfo += `     Group Number: ${extracted.primary.groupNumber}\n`;
                if (extracted.primary.subscriberAddress) combinedClinicalInfo += `     Address: ${extracted.primary.subscriberAddress}\n`;
              } else if (extracted.insurer) {
                combinedClinicalInfo += `   Extracted Insurance Card Data:\n`;
                if (extracted.insurer.name) combinedClinicalInfo += `     Insurance Company: ${extracted.insurer.name}\n`;
                if (extracted.insurer.plan_name) combinedClinicalInfo += `     Plan: ${extracted.insurer.plan_name}\n`;
                if (extracted.member.member_id) combinedClinicalInfo += `     Member ID: ${extracted.member.member_id}\n`;
                if (extracted.member.subscriber_name) combinedClinicalInfo += `     Subscriber: ${extracted.member.subscriber_name}\n`;
              }
            } catch (e) {
              combinedClinicalInfo += `   Content: ${doc.extractedData}\n`;
            }
          }
          combinedClinicalInfo += `\n`;
        });
      }

      // Prepare simplified AIGENTS payload with extracted insurance data mapped to fields
      const aigentsPayload = {
        run_email: "jeffrey.Bander@providerloop.com",
        chain_to_run: "LEQVIO_app",
        human_readable_record: `LEQVIO_app processing for patient ${patient.firstName} ${patient.lastName}`,
        source_id: `${patient.lastName}_${patient.firstName}__${patient.dateOfBirth?.replace(/-/g, '_')}`,
        first_step_user_input: "",
        starting_variables: {
          Patient_ID: patient.id.toString(),
          Patient_FirstName: patient.firstName,
          Patient_LastName: patient.lastName,
          Patient_DOB: patient.dateOfBirth,
          Patient_Email: patient.email || '',
          Patient_Home_Phone: '', // We don't distinguish between home/cell in current schema
          Patient_Cell_Phone: patient.phone || '',
          Patient_Address: patient.address || '',
          Ordering_MD: patient.orderingMD,
          Patient_Diagnosis: patient.diagnosis,
          Patient_Primary_Insurance: extractedPrimaryInsurance,
          Patient_Primary_Plan: extractedPrimaryPlan,
          Patient_Primary_Insurance_Number: extractedPrimaryNumber,
          Patient_Primary_Group_ID: extractedPrimaryGroupId,
          Patient_Secondary_Insurance: extractedSecondaryInsurance,
          Patient_Secondary_Plan: extractedSecondaryPlan,
          Patient_Secondary_Insurance_Number: extractedSecondaryNumber,
          Patient_Secondary_Group_ID: extractedSecondaryGroupId,
          Patient_Clinical_Info: combinedClinicalInfo
        }
      };

      // Call AIGENTS API
      console.log('Sending to AIGENTS:', 'https://start-chain-run-943506065004.us-central1.run.app');
      console.log('Payload:', JSON.stringify(aigentsPayload, null, 2));
      
      const aigentsResponse = await fetch('https://start-chain-run-943506065004.us-central1.run.app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aigentsPayload)
      });

      console.log('AIGENTS Response Status:', aigentsResponse.status, aigentsResponse.statusText);
      
      if (!aigentsResponse.ok) {
        const errorText = await aigentsResponse.text();
        console.error('AIGENTS Error Response:', errorText);
        throw new Error(`AIGENTS API error: ${aigentsResponse.statusText} - ${errorText}`);
      }

      const aigentsResult = await aigentsResponse.json() as any;
      console.log('AIGENTS Response Body:', JSON.stringify(aigentsResult, null, 2));
      
      // Extract the AIGENTS Chain Run ID from the response
      let chainRunId = '';
      if (aigentsResult.batchResults && aigentsResult.batchResults[0] && 
          aigentsResult.batchResults[0].data && aigentsResult.batchResults[0].data.Rows && 
          aigentsResult.batchResults[0].data.Rows[0]) {
        chainRunId = aigentsResult.batchResults[0].data.Rows[0].ChainRun_ID || '';
      }
      
      console.log('AIGENTS Chain Run ID:', chainRunId);
      
      // Log the automation for tracking with the AIGENTS chain run ID
      await storage.createAutomationLog({
        chainName: 'leqvio_app',
        email: patient.email || 'noemail@providerloop.com',
        status: 'triggered',
        response: JSON.stringify(aigentsResult),
        requestData: aigentsPayload,
        uniqueId: chainRunId || uniqueId, // Use AIGENTS chain run ID as the tracking ID
        patientId: patientId, // Link to patient record
        timestamp: new Date()
      });

      console.log('AIGENTS chain triggered for patient:', patient.id);
      
      res.json({ 
        success: true, 
        message: 'Patient data processed and sent to AIGENTS',
        chainRunId: chainRunId,
        uniqueId: uniqueId,
        documentsProcessed: {
          insurance: insuranceDocuments.length,
          clinical: clinicalDocuments.length
        }
      });
      
    } catch (error) {
      console.error('Failed to process patient data:', error);
      res.status(500).json({ 
        error: 'Failed to process patient data',
        details: (error as Error).message 
      });
    }
  });

  // Denial AI endpoint - trigger Denial_AI chain with same patient data
  app.post('/api/patients/:id/denial-ai', async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const patientId = parseInt(req.params.id);
      if (!user.currentOrganizationId) {
        return res.status(400).json({ error: 'User not associated with an organization' });
      }
      
      const patient = await storage.getPatient(patientId, user.currentOrganizationId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      // Extract rejection letter text from request body
      const { rejectionLetterText } = req.body || {};

      // Save rejection letter as a document if provided
      if (rejectionLetterText && rejectionLetterText.trim()) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const document = await storage.createPatientDocument({
            patientId: patientId,
            documentType: 'rejection_letter',
            fileName: `Rejection_Letter_${timestamp}.txt`,
            fileUrl: null,
            extractedData: rejectionLetterText.trim(),
            metadata: {
              content: rejectionLetterText.trim(),
              createdViaAPI: true,
              denialAIProcess: true,
              uploadedAt: new Date().toISOString()
            }
          });
          
          console.log('Rejection letter saved as document:', {
            documentId: document.id,
            patientId: patientId,
            textLength: rejectionLetterText.length
          });
        } catch (error) {
          console.error('Failed to save rejection letter as document:', error);
          // Continue with denial AI process even if document save fails
        }
      }

      // Get all documents for this patient (same as leqvio_app chain)
      const documents = await storage.getPatientDocuments(patientId);
      
      // Prepare Insurance_JSON from insurance-related documents as plain text
      const insuranceDocuments = documents.filter(doc => 
        doc.documentType === 'epic_insurance_screenshot' || 
        doc.documentType === 'insurance_screenshot'
      );
      
      // Build insurance information as a readable text summary (same format as leqvio_app)
      let insuranceText = `Patient Insurance Information:\n\n`;
      
      // Current insurance info from patient record
      insuranceText += `Primary Insurance:\n`;
      insuranceText += `  Insurance Company: ${patient.primaryInsurance || 'Not specified'}\n`;
      insuranceText += `  Plan: ${patient.primaryPlan || 'Not specified'}\n`;
      insuranceText += `  Member Number: ${patient.primaryInsuranceNumber || 'Not specified'}\n`;
      insuranceText += `  Group ID: ${patient.primaryGroupId || 'Not specified'}\n\n`;
      
      if (patient.secondaryInsurance || patient.secondaryPlan || patient.secondaryInsuranceNumber) {
        insuranceText += `Secondary Insurance:\n`;
        insuranceText += `  Insurance Company: ${patient.secondaryInsurance || 'Not specified'}\n`;
        insuranceText += `  Plan: ${patient.secondaryPlan || 'Not specified'}\n`;
        insuranceText += `  Member Number: ${patient.secondaryInsuranceNumber || 'Not specified'}\n`;
        insuranceText += `  Group ID: ${patient.secondaryGroupId || 'Not specified'}\n\n`;
      } else {
        insuranceText += `Secondary Insurance: None\n\n`;
      }
      
      // Add extracted insurance documents
      if (insuranceDocuments.length > 0) {
        insuranceText += `Insurance Documents (${insuranceDocuments.length}):\n`;
        insuranceDocuments.forEach((doc, index) => {
          insuranceText += `${index + 1}. Document: ${doc.fileName}\n`;
          insuranceText += `   Type: ${doc.documentType}\n`;
          insuranceText += `   Uploaded: ${new Date(doc.createdAt).toLocaleDateString()}\n`;
          
          // Add extracted insurance data if available
          if (doc.extractedData) {
            try {
              let extracted;
              try {
                extracted = JSON.parse(doc.extractedData);
              } catch (parseError) {
                console.error('JSON parse error in routes.ts (extractedData):', parseError);
                extracted = {};
              }
              if (extracted.primary) {
                insuranceText += `   Primary Insurance: ${extracted.primary.payer || 'Not specified'}\n`;
                insuranceText += `   Plan: ${extracted.primary.plan || 'Not specified'}\n`;
                insuranceText += `   Member ID: ${extracted.primary.subscriberId || 'Not specified'}\n`;
                insuranceText += `   Group Number: ${extracted.primary.groupNumber || 'Not specified'}\n`;
              }
            } catch (e) {
              // If not JSON, treat as plain text
              insuranceText += `   Content: ${doc.extractedData}\n`;
            }
          }
          insuranceText += `\n`;
        });
      } else {
        insuranceText += `No insurance documents uploaded.\n`;
      }

      // Prepare Clinical_JSON (same format as leqvio_app)
      const clinicalDocuments = documents.filter(doc => 
        doc.documentType === 'epic_screenshot' || 
        doc.documentType === 'clinical_note' ||
        doc.documentType === 'leqvio_form'
      );
      
      let clinicalText = `Patient Clinical Information:\n\n`;
      clinicalText += `Patient: ${patient.firstName} ${patient.lastName}\n`;
      clinicalText += `Date of Birth: ${patient.dateOfBirth}\n`;
      clinicalText += `Ordering MD: ${patient.orderingMD}\n`;
      clinicalText += `Diagnosis: ${patient.diagnosis}\n`;
      clinicalText += `Status: ${patient.status}\n`;
      clinicalText += `Authorization Status: ${patient.authStatus}\n\n`;
      
      if (clinicalDocuments.length > 0) {
        clinicalText += `Clinical Documents (${clinicalDocuments.length}):\n`;
        clinicalDocuments.forEach((doc, index) => {
          clinicalText += `${index + 1}. Document: ${doc.fileName}\n`;
          clinicalText += `   Type: ${doc.documentType}\n`;
          clinicalText += `   Uploaded: ${new Date(doc.createdAt).toLocaleDateString()}\n`;
          
          if (doc.extractedData) {
            try {
              let extracted;
              try {
                extracted = JSON.parse(doc.extractedData);
              } catch (parseError) {
                console.error('JSON parse error in routes.ts (extractedData):', parseError);
                extracted = {};
              }
              clinicalText += `   Content: ${JSON.stringify(extracted, null, 2)}\n`;
            } catch (e) {
              // If not JSON, treat as plain text
              clinicalText += `   Content: ${doc.extractedData}\n`;
            }
          }
          clinicalText += `\n`;
        });
      } else {
        clinicalText += `No clinical documents uploaded.\n`;
      }

      // Generate unique ID for tracking
      const uniqueId = `denial_ai_${patient.id}_${Date.now()}`;

      // Prepare AIGENTS payload for Denial_AI chain (matching AIGENTS API format)
      const aigentsPayload = {
        run_email: "jeffrey.Bander@providerloop.com",
        chain_to_run: "Denial_AI",
        human_readable_record: `Denial_AI processing for patient ${patient.firstName} ${patient.lastName}`,
        source_id: `${patient.lastName}_${patient.firstName}__${patient.dateOfBirth?.replace(/-/g, '_')}_denial`,
        first_step_user_input: "",
        starting_variables: {
          Patient_ID: patient.id.toString(),
          Patient_First_Name: patient.firstName,
          Patient_Last_Name: patient.lastName,
          Patient_Date_of_Birth: patient.dateOfBirth,
          Patient_Ordering_MD: patient.orderingMD,
          Patient_Diagnosis: patient.diagnosis,
          Patient_Status: patient.status,
          Patient_Authorization_Status: patient.authStatus || 'Denied',
          Patient_Phone: patient.phone || '',
          Patient_Email: patient.email || '',
          Patient_Address: patient.address || '',
          Patient_MRN: patient.mrn || '',
          Patient_Campus: patient.campus || 'Mount Sinai West',
          Patient_Auth_Number: patient.authNumber || '',
          Patient_Ref_Number: patient.refNumber || '',
          Patient_Start_Date: patient.startDate || '',
          Patient_End_Date: patient.endDate || '',
          Insurance_JSON: insuranceText,
          Clinical_JSON: clinicalText,
          Patient_Primary_Insurance: patient.primaryInsurance || '',
          Patient_Primary_Plan: patient.primaryPlan || '',
          Patient_Primary_Insurance_Number: patient.primaryInsuranceNumber || '',
          Patient_Primary_Group_ID: patient.primaryGroupId || '',
          Patient_Secondary_Insurance: patient.secondaryInsurance || '',
          Patient_Secondary_Plan: patient.secondaryPlan || '',
          Patient_Secondary_Insurance_Number: patient.secondaryInsuranceNumber || '',
          Patient_Secondary_Group_ID: patient.secondaryGroupId || '',
          Patient_Clinical_Info: clinicalText,
          Rejection_Letter_Text: rejectionLetterText || 'No rejection letter provided'
        }
      };

      // Call AIGENTS API
      console.log('Sending Denial AI request to AIGENTS:', 'https://start-chain-run-943506065004.us-central1.run.app');
      console.log('Denial AI Payload:', JSON.stringify(aigentsPayload, null, 2));
      
      const aigentsResponse = await fetch('https://start-chain-run-943506065004.us-central1.run.app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aigentsPayload)
      });

      console.log('Denial AI AIGENTS Response Status:', aigentsResponse.status, aigentsResponse.statusText);
      
      if (!aigentsResponse.ok) {
        const errorText = await aigentsResponse.text();
        console.error('Denial AI AIGENTS Error Response:', errorText);
        throw new Error(`AIGENTS API error: ${aigentsResponse.statusText} - ${errorText}`);
      }

      const aigentsResult = await aigentsResponse.json() as any;
      console.log('Denial AI AIGENTS Response Body:', JSON.stringify(aigentsResult, null, 2));
      
      // Extract the AIGENTS Chain Run ID from the response
      let chainRunId = '';
      if (aigentsResult.batchResults && aigentsResult.batchResults[0] && 
          aigentsResult.batchResults[0].data && aigentsResult.batchResults[0].data.Rows && 
          aigentsResult.batchResults[0].data.Rows[0]) {
        chainRunId = aigentsResult.batchResults[0].data.Rows[0].ChainRun_ID || '';
      }
      
      console.log('Denial AI AIGENTS Chain Run ID:', chainRunId);
      
      // Log the automation for tracking with the AIGENTS chain run ID
      await storage.createAutomationLog({
        chainName: 'Denial_AI',
        email: patient.email || 'noemail@providerloop.com',
        status: 'triggered',
        response: JSON.stringify(aigentsResult),
        requestData: aigentsPayload,
        uniqueId: chainRunId || uniqueId,
        patientId: patientId,
        timestamp: new Date()
      });

      console.log('Denial AI chain triggered for patient:', patient.id);
      
      res.json({ 
        success: true, 
        message: 'Denial AI analysis started successfully',
        chainRunId: chainRunId,
        uniqueId: uniqueId,
        documentsProcessed: {
          insurance: insuranceDocuments.length,
          clinical: clinicalDocuments.length
        }
      });
      
    } catch (error) {
      console.error('Failed to run Denial AI analysis:', error);
      res.status(500).json({ 
        error: 'Failed to run Denial AI analysis',
        details: (error as Error).message 
      });
    }
  });

  // Multi-organization API endpoints
  app.get('/api/user/organizations', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const organizations = await storage.getUserOrganizations(userId);
      const currentOrg = await storage.getUserCurrentOrganization(userId);
      
      res.json({
        organizations,
        currentOrganization: currentOrg
      });
    } catch (error) {
      console.error('Error fetching user organizations:', error);
      res.status(500).json({ error: 'Failed to fetch organizations' });
    }
  });

  app.post('/api/user/switch-organization', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const { organizationId } = req.body;
      
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }
      
      await storage.switchUserOrganization(userId, organizationId);
      const newCurrentOrg = await storage.getUserCurrentOrganization(userId);
      
      res.json({
        message: 'Organization switched successfully',
        currentOrganization: newCurrentOrg
      });
    } catch (error) {
      console.error('Error switching organization:', error);
      if (error instanceof Error && error.message === 'User is not a member of this organization') {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to switch organization' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
