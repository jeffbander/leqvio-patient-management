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

    if (extractionType === 'medical_database') {
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