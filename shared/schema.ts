import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Organizations table
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  password: text("password").notNull(), // Hashed password for authentication
  currentOrganizationId: integer("current_organization_id").references(() => organizations.id), // Currently selected organization
  tempPassword: text("temp_password"), // Store temporary password for display (only for newly invited users)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

// Organization memberships for handling multiple organization membership
export const organizationMemberships = pgTable("organization_memberships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  role: text("role").default("user").notNull(), // 'owner', 'admin', 'user'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(), // For soft delete of memberships
});

export const loginTokens = pgTable("login_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const automationLogs = pgTable("automation_logs", {
  id: serial("id").primaryKey(),
  chainName: text("chain_name").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull(), // 'success' | 'error'
  response: text("response").notNull(),
  requestData: jsonb("request_data").notNull(),
  uniqueId: text("unique_id"), // Store the unique ID from API response
  emailResponse: text("email_response"), // Store email response content
  emailReceivedAt: timestamp("email_received_at"), // When email response was received
  agentResponse: text("agent_response"), // Store agent response content
  agentName: text("agent_name"), // Name of the agent that sent the response
  agentReceivedAt: timestamp("agent_received_at"), // When agent response was received
  webhookPayload: jsonb("webhook_payload"), // Store complete webhook payload from agents system
  chainType: text("chain_type"), // Type of chain (research, pre_pre_chart, etc.)
  isCompleted: boolean("is_completed").default(false), // Mark when chain processing is complete
  patientId: integer("patient_id"), // Link to patient record
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customChains = pgTable("custom_chains", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiAnalytics = pgTable("api_analytics", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull(), // '/webhook/agents', '/api/automation-logs', etc.
  method: text("method").notNull(), // GET, POST, etc.
  statusCode: integer("status_code").notNull(),
  responseTime: integer("response_time").notNull(), // in milliseconds
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  chainType: text("chain_type"), // Type of chain being processed
  uniqueId: text("unique_id"), // Chain Run ID for tracking
  requestSize: integer("request_size"), // Size of request payload in bytes
  responseSize: integer("response_size"), // Size of response payload in bytes
  errorMessage: text("error_message"), // Store error details if any
  requestData: jsonb("request_data"), // Store request payload for analysis
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const automationLogsRelations = relations(automationLogs, ({ one }) => ({}));
export const customChainsRelations = relations(customChains, ({ one }) => ({}));
export const apiAnalyticsRelations = relations(apiAnalytics, ({ one }) => ({}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
});

// Schema for user login (without password in response)
export const userLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Schema for user registration
export const userRegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
});

export const insertLoginTokenSchema = createInsertSchema(loginTokens).omit({
  id: true,
  createdAt: true,
});

export const insertAutomationLogSchema = createInsertSchema(automationLogs).omit({
  id: true,
  createdAt: true,
}).extend({
  timestamp: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});

export const insertCustomChainSchema = createInsertSchema(customChains).omit({
  id: true,
  createdAt: true,
});

export const insertApiAnalyticsSchema = createInsertSchema(apiAnalytics).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserLogin = z.infer<typeof userLoginSchema>;
export type UserRegister = z.infer<typeof userRegisterSchema>;
export type LoginToken = typeof loginTokens.$inferSelect;
export type InsertLoginToken = z.infer<typeof insertLoginTokenSchema>;
export type AutomationLog = typeof automationLogs.$inferSelect;
export type InsertAutomationLog = z.infer<typeof insertAutomationLogSchema>;
export type CustomChain = typeof customChains.$inferSelect;
export type InsertCustomChain = z.infer<typeof insertCustomChainSchema>;
export type ApiAnalytics = typeof apiAnalytics.$inferSelect;
export type InsertApiAnalytics = z.infer<typeof insertApiAnalyticsSchema>;

// LEQVIO Patient Management Tables

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id), // Link each patient to a user
  organizationId: integer("organization_id").notNull().references(() => organizations.id), // Link each patient to an organization
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  orderingMD: text("ordering_md").notNull(),
  diagnosis: text("diagnosis").notNull(),
  status: text("status").notNull().default("Pending Auth"),
  
  // Primary Insurance (optional)
  primaryInsurance: text("primary_insurance"),
  primaryPlan: text("primary_plan"),
  primaryInsuranceNumber: text("primary_insurance_number"),
  primaryGroupId: text("primary_group_id"),
  
  // Secondary Insurance (optional)
  secondaryInsurance: text("secondary_insurance"),
  secondaryPlan: text("secondary_plan"),
  secondaryInsuranceNumber: text("secondary_insurance_number"),
  secondaryGroupId: text("secondary_group_id"),
  
  // Additional fields
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  mrn: text("mrn"), // Medical Record Number (optional)
  campus: text("campus").default("Mount Sinai West"), // Hospital campus location
  
  // Authorization fields
  authNumber: text("auth_number"),
  refNumber: text("ref_number"),
  startDate: text("start_date"), // MM/DD/YYYY format
  endDate: text("end_date"), // MM/DD/YYYY format
  authStatus: text("auth_status").default("Pending Review"), // Pending Review, No PA Required, Approved, Denied, etc.
  scheduleStatus: text("schedule_status").default("Pending Auth"), // Pending Auth, Scheduled, Needs Scheduling, etc.
  doseNumber: integer("dose_number").default(1),
  notes: text("notes").default(""),
  lastVoicemailAt: timestamp("last_voicemail_at"),
  
  // LEQVIO Copay Program fields (only if opted in)
  leqvioCopayProgram: boolean("leqvio_copay_program").default(false),
  leqvioCvgStatus: text("leqvio_cvg_status"),
  leqvioEffectiveFrom: text("leqvio_effective_from"),
  leqvioSubscriber: text("leqvio_subscriber"),
  leqvioSubscriberId: text("leqvio_subscriber_id"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const patientDocuments = pgTable("patient_documents", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  documentType: text("document_type").notNull(), // 'clinical_note', 'insurance_screenshot', 'epic_screenshot'
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  extractedData: text("extracted_data"), // OCR extracted text
  metadata: jsonb("metadata"), // Additional structured data from OCR
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const eSignatureForms = pgTable("e_signature_forms", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id),
  formData: jsonb("form_data").notNull(),
  signatureData: text("signature_data").notNull(), // Base64 encoded patient signature
  providerSignatureData: text("provider_signature_data"), // Base64 encoded provider signature
  pdfUrl: text("pdf_url"),
  emailSent: boolean("email_sent").default(false),
  emailSentTo: text("email_sent_to"),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  appointmentDate: text("appointment_date").notNull(), // MM/DD/YYYY format
  doseNumber: integer("dose_number").notNull(),
  status: text("status").notNull().default("Scheduled"), // Scheduled, Completed, Cancelled, No Show
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  patients: many(patients),
  memberships: many(organizationMemberships),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  currentOrganization: one(organizations, {
    fields: [users.currentOrganizationId],
    references: [organizations.id],
  }),
  patients: many(patients),
  memberships: many(organizationMemberships),
}));

export const organizationMembershipsRelations = relations(organizationMemberships, ({ one }) => ({
  user: one(users, {
    fields: [organizationMemberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [organizationMemberships.organizationId],
    references: [organizations.id],
  }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  user: one(users, {
    fields: [patients.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [patients.organizationId],
    references: [organizations.id],
  }),
  documents: many(patientDocuments),
  eSignatureForms: many(eSignatureForms),
  appointments: many(appointments),
}));

export const patientDocumentsRelations = relations(patientDocuments, ({ one }) => ({
  patient: one(patients, {
    fields: [patientDocuments.patientId],
    references: [patients.id],
  }),
}));

export const eSignatureFormsRelations = relations(eSignatureForms, ({ one }) => ({
  patient: one(patients, {
    fields: [eSignatureForms.patientId],
    references: [patients.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
}));

// Insert schemas for new tables
// Organization schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationMembershipSchema = createInsertSchema(organizationMemberships).omit({
  id: true,
  createdAt: true,
});

// Organization registration schema (creates org + user)
export const organizationRegisterSchema = z.object({
  organizationName: z.string().min(1),
  organizationDescription: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
});

// User invitation schema
export const userInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  userId: true, // Will be set from authenticated user context
  organizationId: true, // Will be set from authenticated user context
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.string().default("Pending Auth"),
});

export const insertPatientDocumentSchema = createInsertSchema(patientDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertESignatureFormSchema = createInsertSchema(eSignatureForms).omit({
  id: true,
  createdAt: true,
  emailSentAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.string().default("Scheduled"),
});

// Organization types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type InsertOrganizationMembership = z.infer<typeof insertOrganizationMembershipSchema>;
export type OrganizationRegister = z.infer<typeof organizationRegisterSchema>;
export type UserInvite = z.infer<typeof userInviteSchema>;

// Types for new tables
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type PatientDocument = typeof patientDocuments.$inferSelect;
export type InsertPatientDocument = z.infer<typeof insertPatientDocumentSchema>;
export type ESignatureForm = typeof eSignatureForms.$inferSelect;
export type InsertESignatureForm = z.infer<typeof insertESignatureFormSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
