# Providerloop Chains

## Overview
Providerloop Chains is a patient data processing application designed to streamline medical data workflows. It automates patient data processing through chain automations, auto-generates source IDs, and tracks results via real-time webhook communication. The system focuses on simplifying clinical data processing, particularly for forms like LEQVIO, by extracting patient demographics and facilitating patient record creation. Its vision is to provide clean, simple interfaces for managing medical data.

## User Preferences
- Prefers simple, everyday language
- Needs clear webhook configuration examples
- Focuses on bidirectional communication workflow
- Values working end-to-end automation testing
- Wants to create reusable templates for automation systems

## System Architecture

### Frontend
- **Technology Stack**: React with TypeScript, Tailwind CSS for styling, TanStack React Query for data management, Wouter for routing.
- **Access**: Direct access, no authentication required.
- **Core Workflows**:
    - **Patient Management System**: Complete patient lifecycle management with e-signature forms, patient list view, and detailed patient records.
    - **E-Signature Form**: Web form that collects patient data with electronic signature, generates PDFs matching original LEQVIO forms, and sends via SendGrid.
    - **Patient List View**: Searchable list of all patients with status tracking (started, in_progress, completed, cancelled).
    - **Patient Detail View**: Comprehensive patient information management including demographics, insurance data, document uploads, and Epic screenshot processing.
    - **Medical Database Screenshot Processing**: OCR extraction from Epic screenshots and insurance cards with automatic AIGENTS chain triggering for "leqvio" automation.
    - **Audio Transcription**: Interface for real-time audio recording and transcription using OpenAI Whisper.

### Backend
- **Technology Stack**: Express.js server, PostgreSQL database with Drizzle ORM.
- **Database Schema**: 
    - **patients**: Core patient demographics (firstName, lastName, DOB, orderingMD, diagnosis, status) with optional insurance fields
    - **patient_documents**: Uploaded documents with OCR extraction data
    - **e_signature_forms**: Form submissions with signature data and email tracking
- **Integrations**: OpenAI Vision API for OCR and data extraction; OpenAI Whisper API for speech-to-text; AIGENTS API for chain triggering; SendGrid for email delivery.
- **Data Management**: Complete CRUD operations for patient management, document storage, and automation tracking.
- **API Analytics**: Real-time tracking of API usage.

### Technical Implementations
- **Source ID Generation**: Automated generation of Source IDs from patient last name, first name, and DOB (e.g., LAST_FIRST__MM_DD_YYYY), handling special characters.
- **Webhook System**: Bidirectional communication via webhooks for receiving responses from agent systems and sending automation payloads. Real-time display of webhook payloads in the UI replaces email notifications.
- **Data Extraction**:
    - **OpenAI Vision**: Used for comprehensive data extraction from LEQVIO forms, medical database screenshots, patient ID cards, and insurance cards. Provides confidence scoring and preserves raw text.
    - **OpenAI Whisper**: Used for transcribing medical conversations and automatically identifying patient information.

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