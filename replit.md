# Providerloop Chains

## Overview
Providerloop Chains is a comprehensive patient management system designed to streamline patient data collection, insurance verification, and clinical documentation. It integrates medical form processing, features a complete e-signature workflow for LEQVIO forms, automates PDF generation, and provides seamless integration with clinical systems. The system leverages intelligent automation and OCR extraction capabilities to enhance efficiency in patient management.

## User Preferences
- Prefers simple, everyday language
- Needs clear webhook configuration examples
- Focuses on bidirectional communication workflow
- Values working end-to-end automation testing
- Wants to create reusable templates for automation systems
- Default patient status should be "Pending Auth" instead of "started"
- Removed "synced" status completely - all patients with synced status converted to "Pending Auth"
- Added authorization fields to patient data: auth number, ref number, start date, end date (all optional, editable in patient detail view)
- Notes are only editable in patient detail view, not in patient list table (read-only in list)
- Fixed notes saving issue by ensuring notes field is included in update mutations
- Automatic authorization status update: when appointment dates fall outside auth start/end date range, authStatus automatically changes to "APT SCHEDULED W/O AUTH"
- Authorization expiration management: when auth end date is within one week or has passed, status automatically changes to "Needs Renewal" (removed "Expired" status entirely)
- Automatic schedule status for authorized patients: when a patient has valid authorization (auth number provided), schedule status automatically changes to "Needs Scheduling"
- Manual auth status override capability: users can now manually set any auth status and the system will respect that choice, only automatically updating statuses that are in "automatic" states (APT SCHEDULED W/O AUTH, Needs Renewal, Pending Review) - manually set statuses like "Approved" or "Denied" are preserved
- Smart authorization checking: system only runs automatic auth status checks when auth data fields (dates, numbers) change but authStatus isn't manually specified, preventing override of intentional manual status changes
- Automatic schedule status updates:
  - When last appointment status changes to "Cancelled" or "No Show", scheduleStatus automatically changes to "Needs Rescheduling"
  - When last appointment is at least 3 months ago and no next appointment is scheduled, scheduleStatus automatically changes to "Needs Scheduling–High Priority" (displayed with red styling)
- Automatic authorization status for scheduled appointments: When appointments are scheduled but no authorization information (auth number, start/end dates) is provided, authStatus automatically changes to "APT SCHEDULED W/O AUTH"
- Click-to-copy MRN functionality: MRN fields in both patient list and patient detail views have copy buttons that copy the MRN to clipboard
- Epic insurance text extraction: New "Epic Insurance Text (Copy & Paste)" option in patient documents allows users to copy insurance information from Epic screens and automatically extract insurance details using AI - now automatically maps extracted data to patient fields (primary/secondary insurance, member IDs, group numbers) and logs changes in notes
- Automatic note logging: Insurance and authorization changes are automatically logged in patient notes with timestamps showing old and new values
- Voicemail note integration: When voicemail is logged for a patient, it's automatically added to their notes in addition to updating the lastVoicemailAt timestamp. Fixed issue where voicemail notes only worked for first voicemail - now works for all subsequent voicemails by comparing timestamps
- Organized notes sections: Notes are automatically organized into three clear sections with distinct visual styling:
  - "=== USER NOTES ===" for manual patient notes that users can edit (gray text)
  - "=== VOICEMAILS ===" for voicemail logs (blue text)  
  - "=== INSURANCE & AUTH UPDATES ===" for insurance/authorization change logs (green text)
- Dedicated user notes editing: Users can now edit only their own notes without affecting automatic system entries. The notes editing interface shows a dedicated textarea for user notes while preserving all automatic entries (voicemails, insurance updates) in a read-only view.
- Clean notes preview: The user notes header "=== USER NOTES ===" is hidden in the notes preview column of the patients table, showing only the actual notes content for a cleaner table display.
- Campus field integration: All patients now have campus location tracking with dropdown selection (Mount Sinai West/East/Morningside), defaults to "Mount Sinai West", editable in patient detail view and selectable in new patient e-signature form
- Campus filtering: Added separate Campus filter dropdown in patient list table allowing users to filter patients by hospital campus location alongside existing status filters
- Temporary password persistence: Organization admins can now view temporary passwords for newly invited users even after sending the invitation - passwords are displayed in the organization management interface until the user logs in for the first time
- Multi-organization support: Users can now belong to multiple organizations and switch between them to access different patient databases. Added organization switcher component in dashboard header for easy switching between organizations.
- Sidebar UI improvement: Made sidebar thinner (reduced from 256px to 192px width) with more compact spacing and padding for better screen real estate utilization.
- Patients table optimization: Made table full-width with percentage-based column sizing to eliminate horizontal scrolling, reduced padding and font sizes for better content density and screen utilization.
- E-signature form document upload: After completing the LEQVIO enrollment form, users now see a success screen with three streamlined document upload options: "Copy and Paste Insurance" (text extraction), "Upload Insurance Screenshot" (image upload), and "Clinical Notes and Labs" (text entry) before redirecting to patient detail page.
- Drag-and-drop file uploads: Implemented comprehensive drag-and-drop functionality across all file upload areas using DragDropFileUpload component for improved user experience. Fixed integration issues where drag-and-drop files weren't properly processed by upload handlers.
- Direct patient creation from document uploads: Replaced automation chain workflow with direct patient creation endpoint `/api/patients/create-from-upload` that extracts patient data from uploaded LEQVIO forms (PDF) or medical screenshots and immediately creates patient records without triggering external automation chains. Created CreatePatientFromUpload component and test page at `/test-upload-patient` for demonstration.
- Copy-paste functionality: Enhanced DragDropFileUpload component with clipboard support allowing users to paste images directly from clipboard (Ctrl+V) in addition to drag-and-drop and file selection. Added visual hints and automatic paste detection for improved user experience.
- Denial AI functionality: Added specialized "Denial AI" section in patient detail AI analysis that appears when authorization status is "Denied". Includes button to trigger Denial_AI chain using same patient data as leqvio_app chain, generates formal appeal letters displayed similar to letter of medical necessity format with expandable text and red styling.
- Enhanced Denial AI interface: Redesigned the Denial AI section with a cleaner, step-by-step workflow including rejection letter upload (both image and text paste), improved visual hierarchy with numbered steps, better color coding, and organized layout for professional appeal letter generation.
- Premium login screen design: Completely redesigned login interface with professional medical branding featuring LEQVIO cardiovascular care platform identity, gradient backgrounds, glassmorphism effects, enhanced typography with gradient text, animated loading states, improved form styling with larger inputs, and modern card-based feature showcase with hover effects.
- Patient ID tracking: Both LEQVIO and Denial_AI chains now include Patient_ID in their starting variables for improved tracking and identification in automation workflows.
- Webhook-based appeal letter processing: System now automatically processes Denial_AI chain webhook responses to extract the Denial_Appeal_Letter output variable and associate it with the correct patient using Patient_ID. Appeal letters are stored in the patient record and displayed immediately without requiring page refresh.
- PDF document upload functionality: Added comprehensive PDF support to the e-signature form success screen with new "Upload PDF Document" option. PDFs are automatically processed using OCR extraction to populate patient data fields (name, DOB, address, phone, email, MRN, provider) with automatic data mapping and notes logging. Supports LEQVIO forms, medical records, and other PDF documents up to 25MB.
- Enhanced document upload layout: Reorganized success screen document upload options from 3-column to 4-column grid (responsive: 1 column on mobile, 2 on tablet, 4 on desktop) to accommodate new PDF upload functionality alongside existing insurance and clinical note options.
- Fixed PDF processing system: Resolved issue where Mistral AI was extracting PDF metadata instead of actual form content. Enhanced prompts now specifically filter out technical PDF information (ReportLab metadata, timestamps, generic placeholders) and focus on visible form data. Added OpenAI fallback extraction when Mistral returns censored placeholder names. System now correctly extracts real patient names from LEQVIO forms instead of generating "NEEDS_REVIEW" placeholders.

## System Architecture

### Frontend
- **Technology Stack**: React with TypeScript, Tailwind CSS, TanStack React Query, Wouter.
- **Access**: Direct access.
- **Main Routes**: `/patients` (list), `/patient/new` (e-signature form), `/patient/:id` (detail view).
- **Core Features**: E-Signature Form (LEQVIO enrollment, signature capture), Patient List (searchable, status badges), Patient Details (tabbed interface), Document Upload (Epic screenshots, insurance cards, clinical documents with OCR), PDF Generation (LEQVIO forms), Email Delivery (SendGrid integration).

### Backend
- **Technology Stack**: Express.js, PostgreSQL with Drizzle ORM, PDFKit.
- **Database Schema**: `patients` (records, demographics, insurance, status), `patient_documents` (storage, OCR data, linked to patients/chains), `e_signature_forms` (submissions, signature, email tracking), `automation_logs` (AIGENTS chain execution, webhooks).
- **Key Endpoints**: `POST /api/patients` (create with e-signature), `POST /api/patients/create-from-upload` (create from documents), `GET /api/patients` (list), `PUT /api/patients/:id` (update), `POST /api/patients/:id/documents` (upload/process documents), `POST /api/extract-patient-info` (OCR extraction).

### Technical Implementations
- **Source ID Generation**: Automated from patient demographics (LAST_FIRST__MM_DD_YYYY).
- **PDF Generation**: PDFKit-based LEQVIO form creation with patient data, signature, and professional layout.
- **OCR Processing**: Multi-source extraction for Epic screenshots, insurance cards, clinical documents, and LEQVIO forms.
- **Automation Workflow**: Document upload triggers OCR, extracted data populates fields, AIGENTS "leqvio" chain triggered, webhook responses tracked.
- **Error Handling**: Comprehensive validation and user feedback.

### UI/UX Decisions
- Clean and simple interface focused on streamlining workflows.
- Tabbed interfaces for organizing data.
- Visual feedback for loading and processing states.
- Redesigned login screen with professional medical branding and modern UI elements.
- Optimized tables and sidebars for better screen utilization.

## External Dependencies

- **OpenAI API**: OpenAI Vision (OCR, data extraction), OpenAI Whisper (speech-to-text transcription).
- **AIGENTS System**: Primary automation platform.
- **PostgreSQL**: Database.
- **SendGrid**: For PDF delivery with attachments.
```