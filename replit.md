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