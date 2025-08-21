import PDFParser from 'pdf2json';

/**
 * Extract text from PDF buffer using pdf2json
 * This is more reliable and doesn't have test file issues
 */
export function extractTextFromPDFBuffer(pdfBuffer: Buffer): Promise<{
  text: string;
  pageCount: number;
  fields: Record<string, any>;
}> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on("pdfParser_dataError", (errData: any) => {
      console.error("PDF parsing error:", errData.parserError);
      // Fallback to basic text extraction
      const text = pdfBuffer.toString('utf-8', 0, Math.min(10000, pdfBuffer.length))
        .replace(/[^\x20-\x7E\n]/g, ' ') // Remove non-printable chars
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      resolve({
        text: text || '',
        pageCount: 1,
        fields: {}
      });
    });
    
    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        let fullText = '';
        const fields: Record<string, any> = {};
        
        // Extract text from all pages
        if (pdfData.Pages) {
          pdfData.Pages.forEach((page: any) => {
            if (page.Texts) {
              page.Texts.forEach((text: any) => {
                if (text.R && text.R[0] && text.R[0].T) {
                  // Decode URI component to get actual text
                  const decodedText = decodeURIComponent(text.R[0].T);
                  fullText += decodedText + ' ';
                }
              });
            }
            fullText += '\n';
          });
        }
        
        // Clean up the text
        fullText = fullText
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .trim();
        
        // Extract common fields using patterns
        fields.rawText = fullText;
        
        // Patient name patterns
        const nameMatch = fullText.match(/(?:Patient Name|Name|Patient)[:\s]+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i);
        if (nameMatch) {
          const nameParts = nameMatch[1].trim().split(/\s+/);
          if (nameParts.length >= 2) {
            fields.firstName = nameParts[0];
            fields.lastName = nameParts[nameParts.length - 1];
            fields.patientName = nameMatch[1].trim();
          }
        }
        
        // Date of birth patterns
        const dobMatch = fullText.match(/(?:DOB|Date of Birth|Birth Date)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
        if (dobMatch) {
          fields.dateOfBirth = dobMatch[1];
        }
        
        // MRN patterns
        const mrnMatch = fullText.match(/(?:MRN|Medical Record|Record Number)[:\s]+([A-Z0-9]+)/i);
        if (mrnMatch) {
          fields.mrn = mrnMatch[1];
        }
        
        // Phone patterns
        const phoneMatch = fullText.match(/(?:Phone|Tel|Telephone)[:\s]+([\d\-\(\)\s]+)/i);
        if (phoneMatch) {
          fields.phone = phoneMatch[1].trim();
        }
        
        // Address patterns
        const addressMatch = fullText.match(/(?:Address)[:\s]+([^,\n]+(?:,\s*[^,\n]+)*)/i);
        if (addressMatch) {
          fields.address = addressMatch[1].trim();
        }
        
        // Insurance patterns
        const insuranceMatch = fullText.match(/(?:Insurance|Payer|Plan)[:\s]+([A-Za-z\s]+)(?:\n|$)/i);
        if (insuranceMatch) {
          fields.insurance = insuranceMatch[1].trim();
        }
        
        // Provider patterns
        const providerMatch = fullText.match(/(?:Provider|Physician|Doctor|MD|Dr\.)[:\s]+([A-Za-z\s,\.]+)(?:\n|$)/i);
        if (providerMatch) {
          fields.provider = providerMatch[1].trim();
        }
        
        // Diagnosis patterns
        const diagnosisMatch = fullText.match(/(?:Diagnosis|DX|ICD)[:\s]+([A-Za-z0-9\s,\.\-]+)(?:\n|$)/i);
        if (diagnosisMatch) {
          fields.diagnosis = diagnosisMatch[1].trim();
        }
        
        resolve({
          text: fullText,
          pageCount: pdfData.Pages ? pdfData.Pages.length : 1,
          fields
        });
      } catch (error) {
        console.error("Error processing PDF data:", error);
        resolve({
          text: '',
          pageCount: 0,
          fields: {}
        });
      }
    });
    
    // Parse the PDF buffer
    pdfParser.parseBuffer(pdfBuffer);
  });
}

/**
 * Enhanced extraction specifically for medical PDFs
 */
export async function extractMedicalPDFData(pdfBuffer: Buffer): Promise<{
  text: string;
  fields: Record<string, string>;
  confidence: number;
}> {
  try {
    const result = await extractTextFromPDFBuffer(pdfBuffer);
    
    // Build the fields object with proper types
    const fields: Record<string, string> = {};
    
    if (result.fields.firstName) fields.firstName = String(result.fields.firstName);
    if (result.fields.lastName) fields.lastName = String(result.fields.lastName);
    if (result.fields.patientName) fields.patientName = String(result.fields.patientName);
    if (result.fields.dateOfBirth) fields.dateOfBirth = String(result.fields.dateOfBirth);
    if (result.fields.mrn) fields.mrn = String(result.fields.mrn);
    if (result.fields.phone) fields.phone = String(result.fields.phone);
    if (result.fields.address) fields.address = String(result.fields.address);
    if (result.fields.insurance) fields.insurance = String(result.fields.insurance);
    if (result.fields.provider) fields.provider = String(result.fields.provider);
    if (result.fields.diagnosis) fields.diagnosis = String(result.fields.diagnosis);
    
    // Calculate confidence based on how many fields were extracted
    const expectedFields = ['firstName', 'lastName', 'dateOfBirth'];
    const foundFields = expectedFields.filter(field => fields[field]);
    const confidence = foundFields.length > 0 ? (foundFields.length / expectedFields.length) * 100 : 10;
    
    return {
      text: result.text.substring(0, 5000), // First 5000 chars
      fields,
      confidence: Math.round(confidence)
    };
  } catch (error) {
    console.error("Medical PDF extraction error:", error);
    return {
      text: '',
      fields: {},
      confidence: 0
    };
  }
}

// For compatibility with existing code
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<{
  text: string;
  pageCount: number;
}> {
  const result = await extractTextFromPDFBuffer(pdfBuffer);
  return {
    text: result.text,
    pageCount: result.pageCount
  };
}

export default {
  extractTextFromPDF,
  extractTextFromPDFBuffer,
  extractMedicalPDFData
};