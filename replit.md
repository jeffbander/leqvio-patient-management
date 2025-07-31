# Providerloop Chains

## Overview
Patient data processing application for Providerloop Chains, designed to streamline medical data workflow processes with clean and simple interfaces. The system provides automated patient data processing through chain automations, auto-generating source IDs from patient information and tracking results through real-time webhook communication.

## Recent Changes
- **2025-07-31**: Reorganized workflow to start with LEQVIO form upload as Step 1 for patient data extraction
- **2025-07-31**: LEQVIO form now automatically extracts patient demographics and populates patient data fields
- **2025-07-31**: Simplified workflow to: 1) Upload LEQVIO form, 2) Review patient data, 3) Create patient record, 4) View results
- **2025-07-31**: Replaced screenshot/manual entry with LEQVIO form upload for clinical data processing
- **2025-07-31**: Updated OpenAI extraction service to specifically handle LEQVIO Service Center Start Forms with comprehensive field extraction
- **2025-07-31**: Simplified clinical data step to focus on PDF form upload and processing for leqvio workflow
- **2025-07-31**: Added clinical data entry section with both screenshot extraction and manual notes input after patient data review
- **2025-07-31**: Clinical notes are now included in the automation payload sent to the leqvio chain
- **2025-07-31**: Changed chain automation from Screenshot_Patient_Creator to "leqvio" for patient processing workflow
- **2025-07-31**: Added manual patient entry option to medical database page - users can now choose between screenshot upload or manual data entry with tabbed interface
- **2025-07-31**: Simplified application to show only medical database page as the primary interface
- **2025-07-31**: Fixed OpenAI API key configuration and resolved TypeScript errors in OpenAI service
- **2025-07-28**: Simplified medical database extraction UI to automatically use Screenshot_Patient_Creator chain - removed chain dropdown and additional notes fields for streamlined workflow
- **2025-07-28**: Simplified medical database extraction page to automatically use Screenshot_Patient_Creator chain with no dropdown selection
- **2025-07-28**: Added raw_data starting variable containing original extracted JSON data for automation processing
- **2025-07-28**: Removed additional notes field and chain selection - page now dedicated to patient creation workflow
- **2025-07-28**: Added manual override capability to medical database extraction page - all extracted fields are now editable with "Reset to Original" functionality
- **2025-07-28**: Enhanced medical database extraction to conditionally include specific patient variables only for Screenshot_Patient_Creator chain: Patient_Address, first_name, last_name, date_of_birth, Patient_Primary_Insurance, Patient_Primary_Insurance_ID, Patient_Secondary_Insurance, Patient_Secondary_Insurance_ID, Patient_Phone_Number, Patient_Email
- **2025-07-28**: Added secondary insurance fields to OpenAI extraction service for comprehensive insurance data capture
- **2025-07-28**: Updated all integration files (paste-this-code.js, ambient-dictation-with-logs.html, API documentation) to include required patient variables in AIGENTS chain calls
- **2025-07-28**: Fixed analytics storage null value errors by ensuring proper default values for all database fields
- **2025-07-28**: Added new chain "Screenshot_Patient_Creator" for creating patients from uploaded screenshots across all system interfaces
- **2025-07-28**: Updated all chain selection lists, API documentation, and integration files to include the new Screenshot_Patient_Creator chain
- **2025-07-28**: Set Screenshot_Patient_Creator as default chain for main automation trigger and ambient dictation integration
- **2025-07-28**: Added Medical Database Screenshot Processing UX (/medical-database) for comprehensive patient data extraction and AIGENTS chain triggering
- **2025-07-28**: Enhanced OpenAI extraction service to handle medical database screenshots with 25+ field extraction including demographics, insurance, medical history, and appointments
- **2025-07-28**: Created complete logging system for ambient dictation integration with localStorage tracking and visual UI display
- **2025-07-28**: Fixed ambient dictation integration to send directly to AIGENTS API endpoint (https://start-chain-run-943506065004.us-central1.run.app) instead of non-existent Providerloop endpoint
- **2025-07-28**: Updated all integration files (paste-this-code.js, ambient-dictation-integration.js, ambient-dictation-example.html) to use correct AIGENTS API endpoint with proper response parsing
- **2025-07-27**: Added patient info extraction from medical system screenshots - extracts 20+ fields including demographics, insurance, and contact info
- **2025-07-27**: Fixed Vosk offline model download issues - added multiple fallback URLs and improved error handling with clear alternatives
- **2025-07-27**: Enhanced Vosk implementation with retry mechanism and better user guidance when CORS restrictions prevent model download
- **2025-07-24**: Optimized audio transcription to reduce API costs by 30x - now only sends each 5-second segment once instead of entire recording
- **2025-07-24**: Fixed duplicate transcription bug and WebM format errors by implementing segment-based recording approach
- **2025-07-24**: Implemented audio transcription module with OpenAI Whisper API for real-time patient visit recording
- **2025-07-24**: Added backend audio transcription endpoint `/api/transcribe-audio` with patient identification extraction
- **2025-07-24**: Created audio-transcription page with recording interface and real-time transcript display
- **2025-07-17**: Added manual Source ID editing capability to home page automation trigger with toggle between auto-generation and manual input
- **2025-07-09**: Fixed Patient ID generation to ensure ALL special characters are converted to underscores (U+005F) for AppSheet compatibility and database matching
- **2025-07-09**: Improved mobile photo capture for insurance cards with separate inputs for "Select Image" vs "Take Photo" and mobile-optimized layout
- **2025-07-09**: Removed confirmation dialog - system now automatically processes and submits to QuickAddQHC after photo upload
- **2025-07-07**: Added address extraction from driver's license ID cards - Patient_Address field now included in automation payload
- **2025-07-07**: Fixed photo upload bug where insurance card photos needed to be taken twice by removing duplicate input elements
- **2025-07-07**: Added Insurance_Front and Insurance_Back JSON fields to automation payload containing complete card extraction data
- **2025-07-07**: Removed "Patient intake processed via external app" text from first_step_user_input, now blank
- **2025-07-06**: Removed CardScan.ai integration from patient intake system, keeping only OpenAI Vision processing
- **2025-07-06**: Simplified InsuranceCardExtractor component to use OpenAI Vision exclusively
- **2025-07-06**: Removed eligibility verification functionality and CardScan.ai validation tabs
- **2025-07-06**: Cleaned up UI to focus on OpenAI Vision extracted data with simplified tabbed interface
- **2025-07-03**: Added Patient_ID variable to QuickAddQHC chain submission (same value as source_id, e.g., Bander_Jeff__11_29_1976)
- **2025-07-03**: Added confirmation dialog before triggering QuickAddQHC chain for user review and approval
- **2025-07-03**: Configured patient intake completion to trigger "QuickAddQHC" chain specifically for patient registration
- **2025-07-03**: Fixed 400 "No photo file uploaded" errors by correcting image upload format to use FormData instead of JSON
- **2025-07-03**: Enhanced patient intake completion to submit comprehensive patient and insurance data to AIGENTS automation system
- **2025-07-03**: Created comprehensive Patient Intake System (/intake) with ID card and insurance card scanning workflow
- **2025-07-03**: Added multi-step intake process: ID card scan → insurance front → insurance back → review & submit
- **2025-07-03**: Integrated automatic source ID generation from extracted ID card data
- **2025-07-03**: Enhanced insurance card extraction with prominent preview display showing key extracted fields
- **2025-07-02**: Integrated CardScan.ai service for real-time insurance card validation and feedback
- **2025-07-02**: Added CardScan.ai comparison tab showing field accuracy, confidence scores, and processing time analysis
- **2025-07-02**: Enhanced insurance extraction with dual-service validation (OpenAI Vision + CardScan.ai)
- **2025-07-02**: Implemented comprehensive insurance card data extraction using OpenAI Vision
- **2025-07-02**: Added InsuranceCardExtractor component with tabbed interface for all insurance data fields
- **2025-07-02**: Created dedicated insurance extraction page (/insurance) with JSON export functionality
- **2025-07-02**: Enhanced photo text extraction to support both patient data and full insurance card analysis
- **2025-07-02**: Added real-time API usage analytics system with dashboard, charts, and automated request tracking
- **2025-06-26**: Created complete AIGENTS integration package for reuse in other Replit apps
- **2025-06-26**: Generated deployment templates and integration guides
- **2025-06-26**: Changed initiating email from Mills.reed@mswheart.com to jeffrey.Bander@providerloop.com
- **2025-06-26**: Added "external app" to human_readable_record field in all automation triggers
- **2025-06-26**: Updated Chain Run ID links to point to AIGENTS realtime logs dashboard: `https://aigents-realtime-logs-943506065004.us-central1.run.app/?chainRunId={chainRunId}`
- **2025-06-26**: Fixed syntax error in server/routes.ts preventing application startup
- **2025-06-23**: Added date range filtering (Last Day, 3 Days, Week, All) with default to 3 days
- **2025-06-23**: Server-side date filtering prevents loading data older than 1 week unless "All" is selected
- **2025-06-23**: Implemented animated loading states for log retrieval with visual feedback
- **2025-06-23**: Added skeleton loading for logs page and spinner animations for refresh/clear operations
- **2025-06-23**: Created separate logs page with advanced filtering by Source ID and Chain name
- **2025-06-23**: Added sorting capabilities (timestamp, source ID, chain name, status) for logs
- **2025-06-23**: Completely redesigned interface for patient data processing with clean, simple UX
- **2025-06-23**: Added auto-generation of Source ID from patient Last Name, First Name, DOB in format: LAST_FIRST__MM_DD_YYYY
- **2025-06-23**: Handles spaces in names with underscores (e.g., "Jeff Abe" becomes "Jeff_Abe")
- **2025-06-23**: Removed Run Email, Folder ID, Source Name fields - now uses fixed email for processing
- **2025-06-23**: Updated branding to "Providerloop Chains" with new logo
- **2025-06-23**: Kept Chain to Run dropdown, First Step input, Starting Variables, and logs display
- **2025-06-23**: Improved UI to display full text content without truncation for detailed webhook payloads
- **2025-06-23**: Created comprehensive template documentation (TEMPLATE_README.md, TEMPLATE_SETUP.md, WEBHOOK_EXAMPLES.md)
- **2025-06-23**: Added template structure for reusable automation webhook systems
- **2025-06-23**: Replaced SendGrid email notifications with real-time webhook payload display in UI
- **2025-06-23**: Added database storage for complete webhook payloads with chain type detection
- **2025-06-23**: Created end-to-end solution: API trigger → Agent processing → Real-time UI results (no email needed)
- **2025-06-23**: Enhanced webhook to capture and return ALL fields from agents system as individual variables
- **2025-06-23**: Webhook now returns complete field mapping: `Pre Pre Chart V2` → `pre_pre_chart_v2`, etc.
- **2025-06-23**: Confirmed production webhook returning all expected variables per agents system requirements
- **2025-06-15**: Deployed application to https://chain-automator-notifications6.replit.app
- **2025-06-15**: Added comprehensive logging system for webhook debugging
- **2025-06-15**: Configured agents system webhook with response mapping (String and Object types)
- **2025-06-15**: Implemented agent webhook endpoint `/webhook/agents` for receiving responses from agents system
- **2025-06-15**: Added database fields for agent responses: `agent_response`, `agent_name`, `agent_received_at`
- **2025-06-15**: Updated frontend to display agent responses in green-styled sections
- **2025-06-15**: Successfully tested webhook with ChainRun_ID 9aff4ab8 integration
- **2025-06-19**: Fixed automation logging timestamp validation issue preventing log creation
- **2025-06-19**: Resolved missing automation logs for successful API responses

## Current Issue - RESOLVED
- ✓ Fixed webhook routing issue causing HTML responses instead of JSON
- ✓ Moved webhook routes to top of registration order to prevent frontend catch-all override
- ✓ Fixed field mapping to accept agents system field names: `"Chain Run ID"` → `chainRunId`, `summ` → `agentResponse`
- ✓ Removed validation requirement allowing flexible webhook payloads
- ✓ Webhook successfully tested with ChainRun_ID 1a2470b2 using exact AppSheet field names
- ✓ 400 Bad Request errors resolved - agents system webhooks now process with 200 OK responses
- Agents system can now send webhooks with proper field mapping

## Project Architecture

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- TanStack React Query for data management
- Wouter for routing
- Direct access (no authentication required)
- Photo upload and text extraction with OpenAI Vision
- Comprehensive insurance card data extraction interface
- **Patient Intake System (/intake)**: Multi-step workflow for complete patient registration
  - Step 1: ID card scanning (driver's license, state ID, passport)
  - Step 2: Insurance card front scanning
  - Step 3: Insurance card back scanning (optional)
  - Step 4: Review and submit with auto-generated source ID
- **Medical Database Extraction (/medical-database)**: Comprehensive screenshot processing workflow
  - Step 1: Upload medical database screenshot
  - Step 2: AI-powered extraction of 25+ patient data fields
  - Step 3: Chain selection and configuration
  - Step 4: Direct AIGENTS API integration with real-time results

### Backend
- Express.js server
- PostgreSQL database with Drizzle ORM
- Webhook endpoints for bidirectional communication
- OpenAI Vision API integration for OCR and data extraction
- Real-time API analytics tracking

### OpenAI Vision Integration
- **Service**: Advanced AI-powered optical character recognition and data extraction
- **Features**: Comprehensive insurance card data extraction, patient ID card processing
- **Extraction**: Member information, pharmacy details, copays, contact information, plan details
- **Processing**: Real-time confidence scoring, metadata capture, raw text preservation
- **Interface**: Clean tabbed display of all extracted fields with visual preview cards

### OpenAI Whisper Integration
- **Service**: Advanced speech-to-text transcription for medical conversations
- **Features**: Real-time audio recording and transcription, automatic patient identification extraction
- **Audio Processing**: WebM audio format support, streaming transcription capability
- **Patient Identification**: Automatic extraction of patient name and DOB from transcripts
- **Source ID Generation**: Auto-generates patient source IDs from extracted information

### Webhook System
- **Email Webhook**: `/api/email-webhook` - Receives AppSheet automation responses via email
- **Agent Webhook**: `/webhook/agents` - Receives agent system responses via HTTP POST
- **ChainRun_ID Tracking**: Unique identifier linking all automation components

### Database Schema
- `automation_logs`: Stores automation data, email responses, and agent responses
- `custom_chains`: Stores reusable automation configurations
- `users`: User management (currently unused - direct access)
- `login_tokens`: Token-based authentication (currently unused)

## User Preferences
- Prefers simple, everyday language
- Needs clear webhook configuration examples
- Focuses on bidirectional communication workflow
- Values working end-to-end automation testing
- Wants to create reusable templates for automation systems

## Webhook Configuration Details

### Agent Webhook Endpoint
- **URL**: `https://[your-domain]/webhook/agents`
- **Method**: POST
- **Content-Type**: application/json

### Required Fields
- `chainRunId`: Unique identifier from automation (required)
- `agentResponse`: Agent's response content (required)
- `agentName`: Name of responding agent (optional)
- `timestamp`: Response timestamp (optional)

### Example Payload
```json
{
  "chainRunId": "9aff4ab8",
  "agentResponse": "Agent response content here",
  "agentName": "Research Agent",
  "timestamp": "2025-06-15T14:03:08.976Z"
}
```

### Response Format
Success: `{"message": "Agent response processed successfully", "chainRunId": "9aff4ab8", "status": "success"}`
Error: `{"error": "Error message"}`