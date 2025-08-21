import { Mistral } from "@mistralai/mistralai";
import { extractTextFromPDF, extractMedicalPDFData } from "./pdf-text-extractor";

// Initialize Mistral client
const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY || "",
});

export interface PDFExtractionResult {
  success: boolean;
  data?: {
    // Patient Information
    patientName?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    mrn?: string;
    phone?: string;
    email?: string;
    address?: string;
    
    // Insurance Information
    primaryInsurance?: string;
    primaryPlan?: string;
    primaryInsuranceNumber?: string;
    primaryGroupId?: string;
    secondaryInsurance?: string;
    secondaryPlan?: string;
    secondaryInsuranceNumber?: string;
    secondaryGroupId?: string;
    
    // Clinical Information
    diagnosis?: string;
    diagnosisCode?: string;
    orderingMD?: string;
    npi?: string;
    practiceInfo?: string;
    
    // LEQVIO Specific
    leqvioEligibility?: boolean;
    priorAuthorization?: string;
    authorizationNumber?: string;
    authorizationStatus?: string;
    
    // Document Metadata
    documentType?: string;
    documentDate?: string;
    pageCount?: number;
    
    // Raw extracted text
    rawText?: string;
    structuredData?: any;
  };
  error?: string;
  confidence?: number;
}

/**
 * Extract text and data from PDF using Mistral AI
 * Mistral is particularly good at understanding medical documents and structured forms
 */
export async function extractPDFWithMistral(
  pdfBuffer: Buffer,
  documentType: string = "medical_document"
): Promise<PDFExtractionResult> {
  try {
    // First, extract raw text from PDF using our enhanced extractor
    const pdfData = await extractMedicalPDFData(pdfBuffer);
    const rawText = pdfData.text;
    const pageCount = 1; // We'll get this from pdfData if needed
    
    if (!rawText || rawText.trim().length === 0) {
      return {
        success: false,
        error: "No text content found in PDF",
      };
    }

    // Use Mistral to extract structured information
    const systemPrompt = `You are an expert medical document analyst specializing in extracting patient and insurance information from healthcare documents. 
    
Your task is to extract structured information from medical documents, particularly focusing on:
1. Patient demographics (name, DOB, contact info)
2. Insurance information (payer, plan, ID numbers)
3. Clinical information (diagnosis, prescriber info)
4. LEQVIO-specific information (eligibility, prior auth)

Return the extracted information in JSON format. Be precise and only include information explicitly found in the document.
If a field is not found, set it to null. For dates, use MM/DD/YYYY format.`;

    const userPrompt = `Extract all relevant patient, insurance, and clinical information from this ${documentType}:

${rawText}

Return a JSON object with these fields (use null if not found):
{
  "patientName": "full name",
  "firstName": "first name",
  "lastName": "last name",
  "dateOfBirth": "MM/DD/YYYY",
  "mrn": "medical record number",
  "phone": "phone number",
  "email": "email address",
  "address": "full address",
  "primaryInsurance": "insurance company name",
  "primaryPlan": "plan name",
  "primaryInsuranceNumber": "member/subscriber ID",
  "primaryGroupId": "group number",
  "secondaryInsurance": "secondary insurance if present",
  "secondaryPlan": "secondary plan name",
  "secondaryInsuranceNumber": "secondary member ID",
  "secondaryGroupId": "secondary group number",
  "diagnosis": "diagnosis description",
  "diagnosisCode": "ICD-10 code",
  "orderingMD": "prescriber name",
  "npi": "NPI number",
  "practiceInfo": "practice/clinic information",
  "leqvioEligibility": true/false if mentioned,
  "priorAuthorization": "auth status or number",
  "authorizationNumber": "specific auth number",
  "authorizationStatus": "approved/denied/pending",
  "documentType": "type of document",
  "documentDate": "date of document"
}`;

    const response = await mistral.chat.complete({
      model: "mistral-large-latest",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1, // Lower temperature for more consistent extraction
      response_format: { type: "json_object" },
    });

    if (!response.choices?.[0]?.message?.content) {
      throw new Error("No response from Mistral AI");
    }

    let extractedData;
    try {
      extractedData = JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      console.error("Failed to parse Mistral response:", parseError);
      return {
        success: false,
        error: "Failed to parse AI response",
      };
    }

    // Calculate confidence based on how many fields were extracted
    const fields = Object.values(extractedData).filter(v => v !== null && v !== undefined);
    const confidence = fields.length > 0 ? (fields.length / Object.keys(extractedData).length) : 0;

    return {
      success: true,
      data: {
        ...extractedData,
        rawText: rawText.substring(0, 5000), // Include first 5000 chars of raw text
        pageCount,
        documentType: extractedData.documentType || documentType,
      },
      confidence: Math.round(confidence * 100),
    };

  } catch (error) {
    console.error("Mistral PDF extraction error:", error);
    return {
      success: false,
      error: `PDF extraction failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Extract data from insurance card image using Mistral Vision
 * Note: This requires Mistral's vision-capable models
 */
export async function extractInsuranceCardWithMistral(
  imageBase64: string,
  cardSide: "front" | "back" = "front"
): Promise<PDFExtractionResult> {
  try {
    const systemPrompt = `You are an expert at extracting information from insurance cards. 
Extract all text and information from this insurance card image.
Focus on: member name, member ID, group number, plan name, insurance company, phone numbers, effective dates, copay information.`;

    const userPrompt = `Extract all information from this ${cardSide} side of an insurance card. 
Return the data in JSON format with fields like memberName, memberId, groupNumber, planName, insuranceCompany, etc.`;

    // Note: Mistral vision capabilities may require a different model
    // For now, we'll use OCR + text model approach
    const response = await mistral.chat.complete({
      model: "mistral-large-latest",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ] as any
        },
      ],
      temperature: 0.1,
    });

    if (!response.choices?.[0]?.message?.content) {
      throw new Error("No response from Mistral AI");
    }

    let extractedData;
    try {
      extractedData = JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      // If not JSON, try to extract key information from text
      const content = response.choices[0].message.content;
      extractedData = {
        rawText: content,
        extractionNote: "Structured extraction failed, raw text provided",
      };
    }

    return {
      success: true,
      data: extractedData,
      confidence: 85, // Default confidence for vision extraction
    };

  } catch (error) {
    console.error("Mistral insurance card extraction error:", error);
    return {
      success: false,
      error: `Insurance card extraction failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Intelligently combine Mistral and OpenAI results for best accuracy
 */
export function combineExtractionResults(
  mistralResult: PDFExtractionResult,
  openAIResult?: any
): PDFExtractionResult {
  if (!mistralResult.success && !openAIResult) {
    return mistralResult;
  }

  if (!openAIResult) {
    return mistralResult;
  }

  // Combine the results, preferring non-null values
  const combinedData: any = {};
  const mistralData = mistralResult.data || {};
  const openAIData = openAIResult.data || openAIResult || {};

  // Iterate through all possible fields
  const allKeys = new Set([
    ...Object.keys(mistralData),
    ...Object.keys(openAIData),
  ]);

  for (const key of allKeys) {
    // Prefer Mistral for medical terminology and structured data
    // Prefer OpenAI for general text extraction
    if (mistralData[key] !== null && mistralData[key] !== undefined) {
      combinedData[key] = mistralData[key];
    } else if (openAIData[key] !== null && openAIData[key] !== undefined) {
      combinedData[key] = openAIData[key];
    }
  }

  // Calculate combined confidence
  const mistralConf = mistralResult.confidence || 0;
  const openAIConf = openAIResult.confidence || 75;
  const combinedConfidence = Math.max(mistralConf, openAIConf);

  return {
    success: true,
    data: combinedData,
    confidence: combinedConfidence,
  };
}

/**
 * Validate Mistral API key
 */
export async function validateMistralKey(): Promise<boolean> {
  try {
    if (!process.env.MISTRAL_API_KEY) {
      console.warn("MISTRAL_API_KEY not configured");
      return false;
    }

    // Test the API key with a simple request
    const response = await mistral.models.list();
    return !!response;
  } catch (error) {
    console.error("Mistral API key validation failed:", error);
    return false;
  }
}

// Export default instance
export default {
  extractPDFWithMistral,
  extractInsuranceCardWithMistral,
  combineExtractionResults,
  validateMistralKey,
};