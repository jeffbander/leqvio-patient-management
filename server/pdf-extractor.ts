import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

/**
 * Extract text from PDF buffer using pdf.js
 * This is more reliable than pdf-parse and doesn't require test files
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<{
  text: string;
  pageCount: number;
  metadata?: any;
}> {
  try {
    // Convert buffer to Uint8Array for pdfjs
    const data = new Uint8Array(pdfBuffer);
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    
    const pageCount = pdf.numPages;
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items with proper spacing
      const pageText = textContent.items
        .map((item: any) => {
          // Check if item has the expected structure
          if (item && typeof item === 'object' && 'str' in item) {
            return item.str;
          }
          return '';
        })
        .join(' ');
      
      fullText += pageText + '\n\n';
    }
    
    // Try to get metadata
    let metadata = {};
    try {
      const pdfMetadata = await pdf.getMetadata();
      metadata = pdfMetadata.info || {};
    } catch (metaError) {
      console.log('Could not extract PDF metadata:', metaError);
    }
    
    return {
      text: fullText.trim(),
      pageCount,
      metadata
    };
  } catch (error) {
    console.error('PDF text extraction error:', error);
    
    // Fallback: try to extract any readable text from buffer
    try {
      // Look for common PDF text patterns
      const bufferString = pdfBuffer.toString('binary');
      const textMatches = bufferString.match(/\((.*?)\)/g) || [];
      const extractedText = textMatches
        .map(match => match.slice(1, -1))
        .filter(text => text.length > 2 && /[a-zA-Z]/.test(text))
        .join(' ');
      
      return {
        text: extractedText || '',
        pageCount: 1,
        metadata: {}
      };
    } catch (fallbackError) {
      console.error('Fallback extraction also failed:', fallbackError);
      return {
        text: '',
        pageCount: 0,
        metadata: {}
      };
    }
  }
}

/**
 * Enhanced PDF extraction for medical documents
 * Specifically tuned for LEQVIO forms and insurance documents
 */
export async function extractMedicalPDFData(pdfBuffer: Buffer): Promise<{
  text: string;
  fields: Record<string, string>;
  confidence: number;
}> {
  const { text, metadata } = await extractTextFromPDF(pdfBuffer);
  
  // Extract common medical form fields using patterns
  const fields: Record<string, string> = {};
  
  // Patient name patterns
  const namePatterns = [
    /Patient Name[:\s]+([A-Za-z\s]+)/i,
    /Name[:\s]+([A-Za-z\s]+)/i,
    /Patient[:\s]+([A-Za-z\s]+)/i,
    /([A-Z][a-z]+)\s+([A-Z][a-z]+)/ // Generic name pattern
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      fields.patientName = match[1].trim();
      break;
    }
  }
  
  // Date of birth patterns
  const dobPatterns = [
    /DOB[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Date of Birth[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Birth Date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
  ];
  
  for (const pattern of dobPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      fields.dateOfBirth = match[1];
      break;
    }
  }
  
  // MRN patterns
  const mrnPatterns = [
    /MRN[:\s]+([A-Z0-9]+)/i,
    /Medical Record[:\s]+([A-Z0-9]+)/i,
    /Record Number[:\s]+([A-Z0-9]+)/i
  ];
  
  for (const pattern of mrnPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      fields.mrn = match[1];
      break;
    }
  }
  
  // Insurance patterns
  const insurancePatterns = [
    /Insurance[:\s]+([A-Za-z\s]+)/i,
    /Payer[:\s]+([A-Za-z\s]+)/i,
    /Plan[:\s]+([A-Za-z\s]+)/i
  ];
  
  for (const pattern of insurancePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      fields.insurance = match[1].trim();
      break;
    }
  }
  
  // Diagnosis patterns
  const diagnosisPatterns = [
    /Diagnosis[:\s]+([A-Za-z\s,]+)/i,
    /DX[:\s]+([A-Za-z\s,]+)/i,
    /ICD[\-\s]10[:\s]+([A-Z0-9.]+)/i
  ];
  
  for (const pattern of diagnosisPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      fields.diagnosis = match[1].trim();
      break;
    }
  }
  
  // Provider patterns
  const providerPatterns = [
    /Provider[:\s]+([A-Za-z\s,]+)/i,
    /Physician[:\s]+([A-Za-z\s,]+)/i,
    /Doctor[:\s]+([A-Za-z\s,]+)/i,
    /MD[:\s]+([A-Za-z\s,]+)/i
  ];
  
  for (const pattern of providerPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      fields.provider = match[1].trim();
      break;
    }
  }
  
  // Calculate confidence based on fields found
  const expectedFields = ['patientName', 'dateOfBirth', 'diagnosis'];
  const foundFields = expectedFields.filter(field => fields[field]);
  const confidence = (foundFields.length / expectedFields.length) * 100;
  
  return {
    text: text.substring(0, 5000), // First 5000 chars for context
    fields,
    confidence: Math.round(confidence)
  };
}

export default {
  extractTextFromPDF,
  extractMedicalPDFData
};