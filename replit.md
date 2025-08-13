# Providerloop Chains

## Overview
Providerloop Chains is a comprehensive patient management system with integrated medical form processing. The system features a complete e-signature workflow for LEQVIO forms, automated PDF generation, and seamless integration with clinical systems through AIGENTS API. It streamlines patient data collection, insurance verification, and clinical documentation through intelligent automation and OCR extraction capabilities.

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
- Authorization expiration management: when auth end date is within one week, status automatically changes to "Needs Renewal"; when auth end date has passed, status changes to "Expired"
- Automatic schedule status for authorized patients: when a patient has valid authorization (auth number provided), schedule status automatically changes to "Needs Scheduling"
- System-wide auth status checking: when any patient's auth information is updated, the system runs a comprehensive check on all patients in the organization to ensure consistent auth status across the entire patient database
- Automatic schedule status updates:
  - When last appointment status changes to "Cancelled" or "No Show", scheduleStatus automatically changes to "Needs Rescheduling"
  - When last appointment is at least 3 months ago and no next appointment is scheduled, scheduleStatus automatically changes to "Needs Scheduling–High Priority" (displayed with red styling)
- Click-to-copy MRN functionality: MRN fields in both patient list and patient detail views have copy buttons that copy the MRN to clipboard
- Epic insurance text extraction: New "Epic Insurance Text (Copy & Paste)" option in patient documents allows users to copy insurance information from Epic screens and automatically extract insurance details using AI - now automatically maps extracted data to patient fields (primary/secondary insurance, member IDs, group numbers) and logs changes in notes
- Automatic note logging: Insurance and authorization changes are automatically logged in patient notes with timestamps showing old and new values
- Voicemail note integration: When voicemail is logged for a patient, it's automatically added to their notes in addition to updating the lastVoicemailAt timestamp. Fixed issue where voicemail notes only worked for first voicemail - now works for all subsequent voicemails by comparing timestamps
- Organized notes sections: Notes are automatically organized into three clear sections with distinct visual styling:
  - "=== NOTES ===" for general patient notes (gray text)
  - "=== VOICEMAILS ===" for voicemail logs (blue text)  
  - "=== INSURANCE & AUTH UPDATES ===" for insurance/authorization change logs (green text)
- Campus field integration: All patients now have campus location tracking with dropdown selection (Mount Sinai West/East/Morningside), defaults to "Mount Sinai West", editable in patient detail view and selectable in new patient e-signature form
- Campus filtering: Added separate Campus filter dropdown in patient list table allowing users to filter patients by hospital campus location alongside existing status filters
- Temporary password persistence: Organization admins can now view temporary passwords for newly invited users even after sending the invitation - passwords are displayed in the organization management interface until the user logs in for the first time
- Multi-organization support: Users can now belong to multiple organizations and switch between them to access different patient databases. Added organization switcher component in dashboard header for easy switching between organizations.
- Sidebar UI improvement: Made sidebar thinner (reduced from 256px to 192px width) with more compact spacing and padding for better screen real estate utilization.
- Patients table optimization: Made table full-width with percentage-based column sizing to eliminate horizontal scrolling, reduced padding and font sizes for better content density and screen utilization.
- E-signature form document upload: After completing the LEQVIO enrollment form, users now see a success screen with document upload options including insurance cards, Epic screenshots, clinical documents, and other files before redirecting to patient detail page.
- Drag-and-drop file uploads: Implemented comprehensive drag-and-drop functionality across all file upload areas using DragDropFileUpload component for improved user experience. Fixed integration issues where drag-and-drop files weren't properly processed by upload handlers.

## System Architecture

### Frontend
- **Technology Stack**: React with TypeScript, Tailwind CSS for styling, TanStack React Query for data management, Wouter for routing.
- **Access**: Direct access, no authentication required.
- **Main Routes**:
    - `/patients` - Patient list view with search and filtering
    - `/patient/new` - E-signature form for new patient enrollment
    - `/patient/:id` - Detailed patient view with document management
- **Core Features**:
    - **E-Signature Form**: Complete LEQVIO patient enrollment with canvas-based signature capture
    - **Patient List**: Real-time searchable list with status badges (started, in_progress, completed, cancelled)
    - **Patient Details**: Comprehensive view with tabbed interface for demographics, insurance, and documents
    - **Document Upload**: Support for Epic screenshots, insurance cards, and clinical documents with OCR
    - **PDF Generation**: Automated LEQVIO form generation with patient data and signature
    - **Email Delivery**: SendGrid integration for automated form distribution

### Backend
- **Technology Stack**: Express.js server, PostgreSQL database with Drizzle ORM, PDFKit for PDF generation.
- **Database Schema**: 
    - **patients**: Complete patient records with demographics, insurance (primary/secondary), and status tracking
    - **patient_documents**: Document storage with extracted OCR data, linked to patients and automation chains
    - **e_signature_forms**: Form submissions with base64 signature data and email delivery tracking
    - **automation_logs**: AIGENTS chain execution tracking with webhook payloads
- **Key Endpoints**:
    - `POST /api/patients` - Create patient with e-signature data
    - `GET /api/patients` - List patients with optional search
    - `PUT /api/patients/:id` - Update patient information
    - `POST /api/patients/:id/documents` - Upload and process documents
    - `POST /api/extract-patient-info` - OCR extraction for Epic screenshots
- **Integrations**: 
    - OpenAI Vision API for comprehensive OCR extraction
    - AIGENTS API for automated workflow triggering
    - SendGrid for PDF delivery with attachments

### Technical Implementations
- **Source ID Generation**: Automated generation from patient demographics (LAST_FIRST__MM_DD_YYYY format)
- **PDF Generation**: PDFKit-based LEQVIO form creation with:
    - Complete patient demographics and insurance data
    - Canvas-captured signature embedded as image
    - Professional medical form layout matching original
- **OCR Processing**: Multi-source extraction supporting:
    - Epic/medical system screenshots (8-field mapping)
    - Insurance cards (member ID, group, plan details)
    - Clinical documents and LEQVIO forms
- **Automation Workflow**:
    1. Document upload triggers OCR extraction
    2. Extracted data populates patient fields
    3. AIGENTS "leqvio" chain triggered automatically
    4. Webhook responses tracked in real-time
- **Error Handling**: Comprehensive validation and user feedback at each step

### UI/UX Decisions
- Clean and simple interface design with a focus on streamlining workflows.
- Tabbed interfaces for organizing extracted data and for manual data entry options.
- Visual feedback for loading states and processing.

## External Dependencies

- **OpenAI API**:
    - **OpenAI Vision**: For optical character recognition and data extraction from various medical documents and images (LEQVIO forms, medical database screenshots, patient ID cards, insurance cards).
    - **OpenAI Whisper**: For real-time speech-to-text transcription of audio recordings.
- **AIGENTS System**: Primary automation platform for triggering chains and processing patient data.
- **PostgreSQL**: Database for storing application data.
- **SendGrid**: (Previously used for email notifications, now replaced by direct webhook UI display).
- **Vosk**: (Previously used for offline speech recognition, now primarily relying on OpenAI Whisper).