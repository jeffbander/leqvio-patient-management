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