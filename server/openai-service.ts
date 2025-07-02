import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ExtractedPatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // MM/DD/YYYY format
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
    ocr_confidence: {
      member_id: number;
      subscriber_name: number;
      overall: number;
    };
    raw_text: string;
    unmapped_lines: string[];
  };
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
  "confidence": 0.0-1.0,
  "rawText": "all text found in the image"
}

Rules:
- Extract the patient's first name and last name
- Find the date of birth in MM/DD/YYYY format
- Set confidence between 0.0 (not confident) and 1.0 (very confident)
- Include all visible text in rawText field
- If any required field cannot be found, use empty string ""
- Be very careful with date formats - convert to MM/DD/YYYY`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please extract the patient's first name, last name, and date of birth from this document image."
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