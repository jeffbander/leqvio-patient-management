import OpenAI from "openai";
import fs from "fs";
import { Readable } from "stream";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ExtractedPatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // MM/DD/YYYY format
  address: string; // Full address as a single string
  confidence: number;
  rawText?: string;
}

export interface ExtractedInsuranceData {
  insurer: {
    name: string;
    payer_id: string;
    plan_name: string;
    plan_type: string;
    group_number: string;
    effective_date: string;
    termination_date: string;
  };
  member: {
    member_id: string;
    subscriber_name: string;
    dependent: {
      name: string;
      relationship: string;
    };
    dob: string;
  };
  pharmacy: {
    bin: string;
    pcn: string;
    rx_group: string;
    rx_id: string;
    pharmacy_phone: string;
  };
  contact: {
    customer_service_phone: string;
    website_url: string;
    mailing_address: string;
  };
  cost_share: {
    pcp_copay: string;
    specialist_copay: string;
    er_copay: string;
    deductible: string;
    oop_max: string;
  };
  security: {
    card_number: string;
    barcode_data: string;
    magstripe_data: string;
  };
  metadata: {
    image_side: "front" | "back" | "unknown";
    capture_timestamp: string;
    processing_time_ms?: number;
    ocr_confidence: {
      member_id: number;
      subscriber_name: number;
      overall: number;
    };
    raw_text: string;
    unmapped_lines: string[];
  };
}

export async function extractPatientInfoFromScreenshot(base64Image: string, extractionType: string = 'medical_system'): Promise<any> {
  try {
    let systemContent = '';
    let userText = '';
    let responseFields = {};

    if (extractionType === 'clinical_notes') {
      systemContent = `You are a LEQVIO form extraction expert. Extract ONLY the essential patient identification and provider information from LEQVIO Service Center Start Forms.

Return your response in JSON format with these exact fields:
{
  "patient_first_name": "Patient's first name",
  "patient_last_name": "Patient's last name", 
  "patient_date_of_birth": "Patient's date of birth in MM/DD/YYYY format",
  "signature_date": "Patient signature date in MM/DD/YYYY format",
  "provider_name": "Prescriber/Provider name",
  "rawData": "All text found in the form for reference",
  "confidence": 0.0-1.0
}

EXTRACTION RULES FOR LEQVIO FORMS:
- Extract ONLY: patient first name, last name, date of birth, signature date, and provider name
- Look for "First Name:" and "Last Name:" fields in the patient section
- Find "Date of Birth:" in the patient information section
- Locate "Date of Signature" near the patient signature area
- Find "Prescriber Name:" in the prescriber information section
- Use empty string "" for missing fields
- Set confidence based on how clearly these specific fields are visible
- Ignore all other clinical data, diagnosis codes, treatment details, etc.`;

      userText = "Extract only the patient name, date of birth, signature date, and provider name from this LEQVIO form. Focus on these essential identification fields only.";
      
      responseFields = {
        patient_first_name: "",
        patient_last_name: "",
        patient_date_of_birth: "",
        signature_date: "",
        provider_name: "",
        rawData: "",
        confidence: 0
      };
    } else if (extractionType === 'medical_database') {
      systemContent = `You are a medical database data extraction expert. Extract comprehensive patient information from medical database screenshots, EHR/EMR interfaces, patient management systems, or medical software screens.

Return your response in JSON format with these exact fields (use empty string for missing data):
{
  "patient_first_name": "string",
  "patient_last_name": "string", 
  "patient_dob": "MM/DD/YYYY",
  "patient_gender": "string",
  "patient_phone": "string",
  "patient_email": "string",
  "patient_address": "string",
  "patient_city": "string",
  "patient_state": "string",
  "patient_zip": "string",
  "patient_ssn": "string",
  "medical_record_number": "string",
  "account_number": "string",
  "insurance_provider": "string",
  "insurance_id": "string",
  "insurance_group": "string",
  "secondary_insurance": "string",
  "secondary_insurance_id": "string",
  "primary_care_physician": "string",
  "allergies": "string",
  "medications": "string",
  "medical_conditions": "string",
  "emergency_contact_name": "string", 
  "emergency_contact_phone": "string",
  "last_visit_date": "MM/DD/YYYY",
  "next_appointment": "MM/DD/YYYY",
  "marital_status": "string",
  "language": "string",
  "race": "string",
  "ethnicity": "string",
  "rawData": "all text found in the image",
  "confidence": 0.0-1.0
}

EXTRACTION RULES:
- Extract exact text as shown in the database interface
- Use empty string "" for missing fields
- Phone numbers should include formatting if present: (xxx) xxx-xxxx
- Dates in MM/DD/YYYY format
- Be thorough - medical databases contain comprehensive patient data
- Look for all form fields, labels, and data entries
- Set confidence based on image clarity and data completeness`;

      userText = "Extract all patient information from this medical database screenshot. Capture every field visible including demographics, contact info, insurance, medical history, appointments, and provider details.";
      
      responseFields = {
        patient_first_name: "",
        patient_last_name: "",
        patient_dob: "",
        patient_gender: "",
        patient_phone: "",
        patient_email: "",
        patient_address: "",
        patient_city: "",
        patient_state: "",
        patient_zip: "",
        patient_ssn: "",
        medical_record_number: "",
        account_number: "",
        insurance_provider: "",
        insurance_id: "",
        insurance_group: "",
        secondary_insurance: "",
        secondary_insurance_id: "",
        primary_care_physician: "",
        allergies: "",
        medications: "",
        medical_conditions: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        last_visit_date: "",
        next_appointment: "",
        marital_status: "",
        language: "",
        race: "",
        ethnicity: "",
        rawData: "",
        confidence: 0
      };
    } else if (extractionType === 'insurance_card') {
      systemContent = `You are an insurance card data extraction expert. Extract comprehensive information from insurance card images (front or back).

Return your response in JSON format with these exact fields:
{
  "insurance_provider": "string",
  "member_id": "string", 
  "group_number": "string",
  "subscriber_name": "string",
  "plan_name": "string",
  "effective_date": "MM/DD/YYYY",
  "copay_amounts": "string",
  "deductible": "string",
  "phone_numbers": "string",
  "website": "string",
  "rawData": "all text found on the card",
  "confidence": 0.0-1.0
}

EXTRACTION RULES FOR INSURANCE CARDS:
- Extract insurer/plan name, member ID, group number clearly
- Capture subscriber name, plan details, effective dates
- Include copay amounts, deductibles, contact information
- Look for member services phone numbers and websites
- Extract any additional benefits or coverage details
- Use empty string "" for missing fields
- Set confidence based on card clarity and text readability
- Focus on key insurance verification data`;

      userText = "Extract all information from this insurance card. Capture member details, plan information, contact numbers, and any coverage details visible.";
      
      responseFields = {
        insurance_provider: "",
        member_id: "",
        group_number: "",
        subscriber_name: "",
        plan_name: "",
        effective_date: "",
        copay_amounts: "",
        deductible: "",
        phone_numbers: "",
        website: "",
        rawData: "",
        confidence: 0
      };
    } else {
      // Original medical system extraction
      systemContent = `You are a medical system data extraction expert. Extract patient information from screenshots of medical systems, EHR/EMR interfaces, or patient registration screens.

Return your response in JSON format with these exact fields:
{
  "accountNo": "string",
  "firstName": "string",
  "lastName": "string",
  "dateOfBirth": "MM/DD/YYYY",
  "age": "string",
  "sex": "string",
  "street": "string",
  "city": "string",
  "state": "string",
  "zip": "string",
  "country": "string",
  "homePhone": "string",
  "cellPhone": "string",
  "email": "string",
  "primaryCareProvider": "string",
  "maritalStatus": "string",
  "language": "string",
  "race": "string",
  "ethnicity": "string",
  "insurancePlanName": "string",
  "subscriberNo": "string",
  "relationship": "string",
  "rawData": "all text found in the image",
  "confidence": 0.0-1.0
}

EXTRACTION RULES:
- Extract exact text as shown in the system
- Use empty string "" for missing fields
- Phone numbers should include formatting if present
- Dates in MM/DD/YYYY format
- Be thorough - medical systems contain critical patient data
- Set confidence based on image clarity and completeness`;

      userText = "Extract all patient information from this medical system screenshot. Capture every field visible including demographics, contact info, insurance, and provider details.";

      responseFields = {
        accountNo: "",
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        age: "",
        sex: "",
        street: "",
        city: "",
        state: "",
        zip: "",
        country: "",
        homePhone: "",
        cellPhone: "",
        email: "",
        primaryCareProvider: "",
        maritalStatus: "",
        language: "",
        race: "",
        ethnicity: "",
        insurancePlanName: "",
        subscriberNo: "",
        relationship: "",
        rawData: "",
        confidence: 0
      };
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: systemContent
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userText
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Merge with defaults and ensure all fields exist
    const extractedData = { ...responseFields };
    Object.keys(responseFields).forEach(key => {
      if (result[key] !== undefined) {
        (extractedData as any)[key] = result[key];
      }
    });

    // Ensure confidence is within bounds
    if ('confidence' in extractedData && typeof (extractedData as any).confidence === 'number') {
      (extractedData as any).confidence = Math.max(0, Math.min(1, (extractedData as any).confidence));
    }
    
    return extractedData;
  } catch (error) {
    console.error("OpenAI patient info extraction error:", error);
    throw new Error("Failed to extract patient information: " + (error as Error).message);
  }
}

export async function extractPatientDataFromImage(base64Image: string): Promise<ExtractedPatientData> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a medical document text extraction expert. Extract patient information from images of medical documents, driver's licenses, insurance cards, or any document containing patient data.

Return your response in JSON format with these exact fields:
{
  "firstName": "string",
  "lastName": "string", 
  "dateOfBirth": "MM/DD/YYYY",
  "address": "string",
  "confidence": 0.0-1.0,
  "rawText": "all text found in the image"
}

Rules:
- Extract the patient's first name and last name
- Find the date of birth in MM/DD/YYYY format
- Extract the complete address as a single string (e.g., "702 Bedford Ave #2, Brooklyn, NY 11206")
- Set confidence between 0.0 (not confident) and 1.0 (very confident)
- Include all visible text in rawText field
- If any required field cannot be found, use empty string ""
- Be very careful with date formats - convert to MM/DD/YYYY
- For address, include street number, street name, apt/unit if present, city, state, and zip code in a single string`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please extract the patient's first name, last name, date of birth, and address from this document image."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      firstName: result.firstName || "",
      lastName: result.lastName || "",
      dateOfBirth: result.dateOfBirth || "",
      address: result.address || "",
      confidence: Math.max(0, Math.min(1, result.confidence || 0)),
      rawText: result.rawText || ""
    };
  } catch (error) {
    console.error("OpenAI vision extraction error:", error);
    throw new Error("Failed to extract patient data from image: " + (error as Error).message);
  }
}

export async function extractInsuranceCardData(base64Image: string): Promise<ExtractedInsuranceData> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an insurance card OCR expert. Extract ALL insurance information from insurance card images (front or back).

Return JSON with this exact structure:
{
  "insurer": {
    "name": "Insurance company name",
    "payer_id": "Numeric payer ID for clearinghouses",
    "plan_name": "Specific plan name",
    "plan_type": "HMO/PPO/EPO/POS",
    "group_number": "Employer group ID",
    "effective_date": "MM/DD/YYYY",
    "termination_date": "MM/DD/YYYY"
  },
  "member": {
    "member_id": "Policy/Member ID number",
    "subscriber_name": "Primary subscriber name",
    "dependent": {
      "name": "Dependent name if different",
      "relationship": "Spouse/Child/etc"
    },
    "dob": "MM/DD/YYYY"
  },
  "pharmacy": {
    "bin": "Bank Identification Number",
    "pcn": "Processor Control Number", 
    "rx_group": "Pharmacy group number",
    "rx_id": "Prescription member ID",
    "pharmacy_phone": "Pharmacy help line"
  },
  "contact": {
    "customer_service_phone": "Customer service number",
    "website_url": "Insurance company website",
    "mailing_address": "Claims mailing address"
  },
  "cost_share": {
    "pcp_copay": "Primary care copay amount",
    "specialist_copay": "Specialist copay amount", 
    "er_copay": "Emergency room copay",
    "deductible": "Deductible amount",
    "oop_max": "Out of pocket maximum"
  },
  "security": {
    "card_number": "Card number if separate from member ID",
    "barcode_data": "Any barcode/QR code data visible",
    "magstripe_data": "Magnetic stripe data if visible"
  },
  "metadata": {
    "image_side": "front/back/unknown",
    "capture_timestamp": "ISO timestamp",
    "ocr_confidence": {
      "member_id": 0.0-1.0,
      "subscriber_name": 0.0-1.0,
      "overall": 0.0-1.0
    },
    "raw_text": "Complete OCR text",
    "unmapped_lines": ["Any text that didn't fit other fields"]
  }
}

EXTRACTION RULES:
- Use exact text as found on card
- Empty string "" for missing fields
- Detect front vs back side based on content
- Capture ALL visible text in raw_text
- Set confidence scores based on text clarity
- Include phone numbers with formatting: (xxx) xxx-xxxx
- Dates in MM/DD/YYYY format
- Dollar amounts with $ symbol
- Be thorough - insurance cards contain critical billing information`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all insurance information from this insurance card image. Capture every field, phone number, ID, and cost detail visible."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Ensure all required fields exist with defaults
    const extractedData: ExtractedInsuranceData = {
      insurer: {
        name: result.insurer?.name || "",
        payer_id: result.insurer?.payer_id || "",
        plan_name: result.insurer?.plan_name || "",
        plan_type: result.insurer?.plan_type || "",
        group_number: result.insurer?.group_number || "",
        effective_date: result.insurer?.effective_date || "",
        termination_date: result.insurer?.termination_date || ""
      },
      member: {
        member_id: result.member?.member_id || "",
        subscriber_name: result.member?.subscriber_name || "",
        dependent: {
          name: result.member?.dependent?.name || "",
          relationship: result.member?.dependent?.relationship || ""
        },
        dob: result.member?.dob || ""
      },
      pharmacy: {
        bin: result.pharmacy?.bin || "",
        pcn: result.pharmacy?.pcn || "",
        rx_group: result.pharmacy?.rx_group || "",
        rx_id: result.pharmacy?.rx_id || "",
        pharmacy_phone: result.pharmacy?.pharmacy_phone || ""
      },
      contact: {
        customer_service_phone: result.contact?.customer_service_phone || "",
        website_url: result.contact?.website_url || "",
        mailing_address: result.contact?.mailing_address || ""
      },
      cost_share: {
        pcp_copay: result.cost_share?.pcp_copay || "",
        specialist_copay: result.cost_share?.specialist_copay || "",
        er_copay: result.cost_share?.er_copay || "",
        deductible: result.cost_share?.deductible || "",
        oop_max: result.cost_share?.oop_max || ""
      },
      security: {
        card_number: result.security?.card_number || "",
        barcode_data: result.security?.barcode_data || "",
        magstripe_data: result.security?.magstripe_data || ""
      },
      metadata: {
        image_side: result.metadata?.image_side || "unknown",
        capture_timestamp: new Date().toISOString(),
        ocr_confidence: {
          member_id: Math.max(0, Math.min(1, result.metadata?.ocr_confidence?.member_id || 0)),
          subscriber_name: Math.max(0, Math.min(1, result.metadata?.ocr_confidence?.subscriber_name || 0)),
          overall: Math.max(0, Math.min(1, result.metadata?.ocr_confidence?.overall || 0))
        },
        raw_text: result.metadata?.raw_text || "",
        unmapped_lines: result.metadata?.unmapped_lines || []
      }
    };

    return extractedData;
  } catch (error) {
    console.error("OpenAI insurance card extraction error:", error);
    throw new Error("Failed to extract insurance card data: " + (error as Error).message);
  }
}

interface TranscriptionResult {
  text: string;
  fullTranscript?: string;
  patientInfo?: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    sourceId: string;
  };
}

export async function transcribeAudio(audioBuffer: Buffer, isFinal: boolean = false): Promise<TranscriptionResult> {
  try {
    // Create a temporary file for the audio
    const tempFilePath = `/tmp/audio-${Date.now()}.webm`;
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    // Create a readable stream from the file
    const audioStream = fs.createReadStream(tempFilePath);
    
    // Transcribe using Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
      response_format: "text",
      language: "en"
    });
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    
    // Extract patient info if mentioned
    const patientInfo = await extractPatientInfoFromTranscript(transcription);
    
    return {
      text: transcription,
      fullTranscript: isFinal ? transcription : undefined,
      patientInfo: patientInfo
    };
  } catch (error) {
    console.error("Audio transcription error:", error);
    throw new Error("Failed to transcribe audio: " + (error as Error).message);
  }
}

async function extractPatientInfoFromTranscript(transcript: string): Promise<TranscriptionResult['patientInfo'] | undefined> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are analyzing medical conversation transcripts. Extract patient identification information if mentioned.

Return your response in JSON format with these exact fields (or null if not found):
{
  "firstName": "string or null",
  "lastName": "string or null",
  "dateOfBirth": "MM/DD/YYYY or null",
  "foundPatient": true/false
}

Look for patterns like:
- "Patient is [name]"
- "Speaking with [name]" 
- "Date of birth is [date]"
- "Born on [date]"
- Any mention of full names and birthdates`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200
    });
    
    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    if (result.foundPatient && result.firstName && result.lastName && result.dateOfBirth) {
      // Generate source ID
      const formattedFirstName = result.firstName.trim().replace(/\s+/g, '_');
      const formattedLastName = result.lastName.trim().replace(/\s+/g, '_');
      const [month, day, year] = result.dateOfBirth.split('/');
      const sourceId = `${formattedLastName}_${formattedFirstName}__${month}_${day}_${year}`;
      
      return {
        firstName: result.firstName,
        lastName: result.lastName,
        dateOfBirth: result.dateOfBirth,
        sourceId: sourceId
      };
    }
    
    return undefined;
  } catch (error) {
    console.error("Failed to extract patient info:", error);
    return undefined;
  }
}

interface EpicInsuranceData {
  primary: {
    payer: string;
    plan: string;
    sponsorCode: string;
    groupNumber: string;
    groupName: string;
    subscriberId: string;
    subscriberName: string;
    subscriberSSN: string;
    subscriberAddress: string;
  };
  secondary: {
    payer: string;
    plan: string;
    sponsorCode: string;
    groupNumber: string;
    groupName: string;
    subscriberId: string;
    subscriberName: string;
    subscriberSSN: string;
    subscriberAddress: string;
  };
  metadata: {
    extractionConfidence: number;
    rawText: string;
    timestamp: string;
  };
}

export async function extractEpicInsuranceData(base64Image: string): Promise<EpicInsuranceData> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an Epic EMR specialist expert at extracting insurance coverage data from Epic screenshots and insurance reports.

Extract insurance information from Epic insurance coverage reports that show Primary and Secondary coverage sections.

Return JSON with this exact structure:
{
  "primary": {
    "payer": "Primary insurance payer name (e.g., MEDICARE, UNITED HEALTHCARE COMMERCIAL)",
    "plan": "Plan name/type (e.g., MEDICARE A & B, UNITED HEALTHCARE EMPIRE PLAN)",
    "sponsorCode": "Sponsor/Plan code (e.g., M87, H422)",
    "groupNumber": "Group ID number (e.g., 030500)",
    "groupName": "Group name description",
    "subscriberId": "Primary insurance member/subscriber ID (e.g., 4YW4RC9AW92)",
    "subscriberName": "Primary subscriber full name",
    "subscriberSSN": "Subscriber Social Security Number (format: XXX-XX-XXXX)",
    "subscriberAddress": "Complete subscriber address"
  },
  "secondary": {
    "payer": "Secondary insurance payer name",
    "plan": "Secondary plan name/type", 
    "sponsorCode": "Secondary sponsor/plan code",
    "groupNumber": "Secondary group ID number",
    "groupName": "Secondary group name description",
    "subscriberId": "Secondary insurance member/subscriber ID (e.g., 890598658)",
    "subscriberName": "Secondary subscriber full name",
    "subscriberSSN": "Secondary subscriber SSN",
    "subscriberAddress": "Secondary subscriber address"
  },
  "metadata": {
    "extractionConfidence": 0.95,
    "rawText": "Complete text extracted from the image",
    "timestamp": "ISO timestamp"
  }
}

EXTRACTION RULES:
- Look for "Primary Visit Coverage" and "Secondary Visit Coverage" sections
- Extract ALL visible insurance data from both sections including subscriber IDs
- CRITICAL: Find and extract "ID" fields for both primary and secondary coverage (e.g., ID 4YW4RC9AW92, ID 890598658)
- Use exact text as it appears in Epic
- Empty string "" for missing fields in either primary or secondary
- Include complete subscriber names, addresses, and SSNs
- Capture payer names exactly (MEDICARE, UNITED HEALTHCARE COMMERCIAL, etc.)
- Extract plan details, sponsor codes, group information, and subscriber IDs
- Set confidence score based on data clarity (0.0-1.0)
- Include all visible text in rawText field
- Focus on structured Epic insurance data format`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract primary and secondary insurance coverage data from this Epic insurance report. Capture all payer information, subscriber details, plan codes, and group data."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Ensure all required fields exist with defaults
    const extractedData: EpicInsuranceData = {
      primary: {
        payer: result.primary?.payer || "",
        plan: result.primary?.plan || "",
        sponsorCode: result.primary?.sponsorCode || "",
        groupNumber: result.primary?.groupNumber || "",
        groupName: result.primary?.groupName || "",
        subscriberId: result.primary?.subscriberId || "",
        subscriberName: result.primary?.subscriberName || "",
        subscriberSSN: result.primary?.subscriberSSN || "",
        subscriberAddress: result.primary?.subscriberAddress || ""
      },
      secondary: {
        payer: result.secondary?.payer || "",
        plan: result.secondary?.plan || "",
        sponsorCode: result.secondary?.sponsorCode || "",
        groupNumber: result.secondary?.groupNumber || "",
        groupName: result.secondary?.groupName || "",
        subscriberId: result.secondary?.subscriberId || "",
        subscriberName: result.secondary?.subscriberName || "",
        subscriberSSN: result.secondary?.subscriberSSN || "",
        subscriberAddress: result.secondary?.subscriberAddress || ""
      },
      metadata: {
        extractionConfidence: Math.max(0, Math.min(1, result.metadata?.extractionConfidence || 0.8)),
        rawText: result.metadata?.rawText || "",
        timestamp: new Date().toISOString()
      }
    };

    return extractedData;
  } catch (error) {
    console.error("OpenAI Epic insurance extraction error:", error);
    throw new Error("Failed to extract Epic insurance data: " + (error as Error).message);
  }
}

export async function extractPatientInfoFromPDF(pdfText: string): Promise<any> {
  try {
    console.log("Using AI to extract patient info from PDF text");
    
    const prompt = `You are a medical data extraction expert. Extract patient information from this PDF text from a LEQVIO enrollment form or medical document.

PDF TEXT:
${pdfText}

Extract the following patient information and return as JSON:
{
  "patient_first_name": "First name only",
  "patient_last_name": "Last name only", 
  "date_of_birth": "MM/DD/YYYY format",
  "patient_address": "Full street address",
  "patient_city": "City",
  "patient_state": "State abbreviation", 
  "patient_zip": "ZIP code",
  "patient_home_phone": "Home phone number",
  "patient_cell_phone": "Cell/mobile phone number",
  "patient_email": "Email address",
  "provider_name": "Prescribing physician/provider name",
  "account_number": "Medical record number or account number",
  "diagnosis": "Primary diagnosis (e.g., ASCVD, HeFH)",
  "signature_date": "Date form was signed MM/DD/YYYY",
  "confidence": 0.9
}

Look for common LEQVIO form fields like:
- Patient name (first/last)
- Date of Birth or DOB
- Address/Street/City/State/ZIP
- Phone numbers (home/cell/mobile)
- Email
- Prescriber/Provider/Doctor name
- MRN/Account Number/Patient ID
- Diagnosis codes or conditions
- Signature date

If any field is not found, use empty string "". Be very careful with name extraction - separate first and last names properly. Return only valid JSON.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a medical data extraction expert. Extract patient information from medical documents accurately and return only valid JSON."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1000
    });

    const result = response.choices[0].message.content;
    const extractedData = JSON.parse(result || '{}');
    
    console.log("AI PDF extraction result:", {
      patientName: `${extractedData.patient_first_name} ${extractedData.patient_last_name}`,
      dateOfBirth: extractedData.date_of_birth,
      provider: extractedData.provider_name,
      confidence: extractedData.confidence
    });
    
    return extractedData;
    
  } catch (error) {
    console.error('Error in AI PDF extraction:', error);
    
    // Fallback to regex-based extraction if AI fails
    console.log("AI extraction failed, falling back to regex patterns");
    
    const extractedData = {
      patient_first_name: "",
      patient_last_name: "",
      date_of_birth: "",
      patient_address: "",
      patient_city: "",
      patient_state: "",
      patient_zip: "",
      patient_home_phone: "",
      patient_cell_phone: "",
      patient_email: "",
      provider_name: "",
      account_number: "",
      diagnosis: "ASCVD", // Default for LEQVIO
      signature_date: "",
      confidence: 0.3
    };
    
    // Enhanced regex patterns for LEQVIO forms
    const patterns = {
      firstName: [
        /First Name:\s*([^\n\r\t,]+)/i,
        /First:\s*([^\n\r\t,]+)/i,
        /Patient First Name:\s*([^\n\r\t,]+)/i,
        /Name.*First:\s*([^\n\r\t,]+)/i
      ],
      lastName: [
        /Last Name:\s*([^\n\r\t,]+)/i,
        /Last:\s*([^\n\r\t,]+)/i,
        /Patient Last Name:\s*([^\n\r\t,]+)/i,
        /Name.*Last:\s*([^\n\r\t,]+)/i
      ],
      dateOfBirth: [
        /Date of Birth:\s*([^\n\r\t]+)/i,
        /DOB:\s*([^\n\r\t]+)/i,
        /Birth Date:\s*([^\n\r\t]+)/i,
        /Patient DOB:\s*([^\n\r\t]+)/i,
        /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g
      ],
      provider: [
        /Prescriber Name:\s*([^\n\r\t]+)/i,
        /Provider Name:\s*([^\n\r\t]+)/i,
        /Physician Name:\s*([^\n\r\t]+)/i,
        /Doctor:\s*([^\n\r\t]+)/i,
        /MD Name:\s*([^\n\r\t]+)/i
      ],
      homePhone: [
        /Home Phone:\s*([^\n\r\t]+)/i,
        /Phone.*Home:\s*([^\n\r\t]+)/i,
        /Home.*Phone:\s*([^\n\r\t]+)/i
      ],
      cellPhone: [
        /Cell Phone:\s*([^\n\r\t]+)/i,
        /Mobile Phone:\s*([^\n\r\t]+)/i,
        /Cell:\s*([^\n\r\t]+)/i,
        /Mobile:\s*([^\n\r\t]+)/i
      ],
      address: [
        /Address:\s*([^\n\r\t]+)/i,
        /Street Address:\s*([^\n\r\t]+)/i,
        /Patient Address:\s*([^\n\r\t]+)/i
      ],
      email: [
        /Email:\s*([^\n\r\t\s]+@[^\n\r\t\s]+)/i,
        /E-mail:\s*([^\n\r\t\s]+@[^\n\r\t\s]+)/i,
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
      ],
      accountNumber: [
        /Account Number:\s*([^\n\r\t]+)/i,
        /MRN:\s*([^\n\r\t]+)/i,
        /Medical Record Number:\s*([^\n\r\t]+)/i,
        /Patient ID:\s*([^\n\r\t]+)/i
      ]
    };
    
    // Apply patterns
    for (const [field, regexList] of Object.entries(patterns)) {
      for (const regex of regexList) {
        const match = pdfText.match(regex);
        if (match && match[1]) {
          const value = match[1].trim();
          if (value && value !== '') {
            switch (field) {
              case 'firstName':
                extractedData.patient_first_name = value;
                break;
              case 'lastName':
                extractedData.patient_last_name = value;
                break;
              case 'dateOfBirth':
                extractedData.date_of_birth = value;
                break;
              case 'provider':
                extractedData.provider_name = value;
                break;
              case 'homePhone':
                extractedData.patient_home_phone = value;
                break;
              case 'cellPhone':
                extractedData.patient_cell_phone = value;
                break;
              case 'address':
                extractedData.patient_address = value;
                break;
              case 'email':
                extractedData.patient_email = value;
                break;
              case 'accountNumber':
                extractedData.account_number = value;
                break;
            }
            break; // Use first match
          }
        }
      }
    }
    
    return extractedData;
  }
}

export async function extractPatientInfoFromPDFText(pdfText: string): Promise<any> {
  try {
    console.log("Using AI to extract patient info from PDF text");
    
    const prompt = `You are a medical data extraction expert. Extract patient information from this text extracted from a LEQVIO enrollment form or medical document.

EXTRACTED TEXT:
${pdfText}

Extract the following patient information and return as JSON:
{
  "patient_first_name": "First name only",
  "patient_last_name": "Last name only", 
  "date_of_birth": "MM/DD/YYYY format",
  "patient_address": "Full street address",
  "patient_city": "City",
  "patient_state": "State abbreviation", 
  "patient_zip": "ZIP code",
  "patient_home_phone": "Home phone number",
  "patient_cell_phone": "Cell/mobile phone number",
  "patient_email": "Email address",
  "provider_name": "Prescribing physician/provider name",
  "account_number": "Medical record number or account number",
  "diagnosis": "Primary diagnosis (e.g., ASCVD, HeFH)",
  "signature_date": "Date form was signed MM/DD/YYYY",
  "confidence": 0.9
}

Look for common medical form fields like:
- Patient name (first/last)
- Date of Birth or DOB
- Address/Street/City/State/ZIP
- Phone numbers (home/cell/mobile)
- Email
- Prescriber/Provider/Doctor name
- MRN/Account Number/Patient ID
- Diagnosis codes or conditions
- Signature date

If any field is not found, use empty string "". Be very careful with name extraction - separate first and last names properly. Return only valid JSON.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a medical data extraction expert. Extract patient information from medical documents accurately and return only valid JSON."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1000
    });

    const result = response.choices[0].message.content;
    const extractedData = JSON.parse(result || '{}');
    
    console.log("AI PDF text extraction result:", {
      patientName: `${extractedData.patient_first_name} ${extractedData.patient_last_name}`,
      dateOfBirth: extractedData.date_of_birth,
      provider: extractedData.provider_name,
      confidence: extractedData.confidence
    });
    
    return extractedData;
    
  } catch (error) {
    console.error('Error in AI PDF text extraction:', error);
    
    // Fallback with basic pattern matching
    const extractedData = {
      patient_first_name: "",
      patient_last_name: "",
      date_of_birth: "",
      patient_address: "",
      patient_city: "",
      patient_state: "",
      patient_zip: "",
      patient_home_phone: "",
      patient_cell_phone: "",
      patient_email: "",
      provider_name: "",
      account_number: "",
      diagnosis: "ASCVD",
      signature_date: "",
      confidence: 0.3
    };
    
    return extractedData;
  }
}