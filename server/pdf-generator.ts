import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';

interface PatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  orderingMD: string;
  diagnosis: string;
  phone?: string;
  email?: string;
  address?: string;
  primaryInsurance?: string;
  primaryPlan?: string;
  primaryInsuranceNumber?: string;
  primaryGroupId?: string;
  signatureData?: string;
  signatureDate?: string;
}

export async function generateLEQVIOPDF(patientData: PatientData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const buffers: Buffer[] = [];
      
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('LEQVIO® Patient Enrollment Form', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).font('Helvetica').text('Inclisiran Injection', { align: 'center' });
      doc.moveDown(2);

      // Section 1: Patient Information
      doc.fontSize(14).font('Helvetica-Bold').text('1. PATIENT INFORMATION');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      
      // Patient Details
      doc.text(`First Name: ${patientData.firstName}`, 50, doc.y);
      doc.text(`Last Name: ${patientData.lastName}`, 300, doc.y - 10);
      doc.moveDown();
      
      doc.text(`Date of Birth: ${patientData.dateOfBirth}`, 50, doc.y);
      doc.text(`Phone: ${patientData.phone || 'Not provided'}`, 300, doc.y - 10);
      doc.moveDown();
      
      doc.text(`Email: ${patientData.email || 'Not provided'}`, 50, doc.y);
      doc.moveDown();
      
      doc.text(`Address: ${patientData.address || 'Not provided'}`, 50, doc.y);
      doc.moveDown(2);

      // Section 2: Medical Information
      doc.fontSize(14).font('Helvetica-Bold').text('2. MEDICAL INFORMATION');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      
      doc.text(`Ordering Physician: ${patientData.orderingMD}`, 50, doc.y);
      doc.moveDown();
      doc.text(`Primary Diagnosis: ${patientData.diagnosis}`, 50, doc.y);
      doc.moveDown(2);

      // Section 3: Insurance Information
      if (patientData.primaryInsurance) {
        doc.fontSize(14).font('Helvetica-Bold').text('3. INSURANCE INFORMATION');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        
        doc.text('Primary Insurance:', 50, doc.y);
        doc.text(`Provider: ${patientData.primaryInsurance}`, 70, doc.y + 15);
        doc.text(`Plan: ${patientData.primaryPlan || 'Not provided'}`, 70, doc.y + 15);
        doc.text(`Member ID: ${patientData.primaryInsuranceNumber || 'Not provided'}`, 70, doc.y + 15);
        doc.text(`Group ID: ${patientData.primaryGroupId || 'Not provided'}`, 70, doc.y + 15);
        doc.moveDown(2);
      }

      // Section 4: Patient Consent
      doc.fontSize(14).font('Helvetica-Bold').text('4. PATIENT CONSENT');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      
      doc.text('I hereby consent to treatment with LEQVIO® (inclisiran) and authorize my healthcare provider to share my medical information as necessary for treatment coordination and insurance processing.', {
        width: 500,
        align: 'justify'
      });
      doc.moveDown(2);

      // Signature Section
      doc.fontSize(12).font('Helvetica-Bold').text('PATIENT SIGNATURE');
      doc.moveDown(0.5);
      
      // Add signature image if provided
      if (patientData.signatureData && patientData.signatureData.startsWith('data:image')) {
        const base64Data = patientData.signatureData.split(',')[1];
        const imgBuffer = Buffer.from(base64Data, 'base64');
        doc.image(imgBuffer, 50, doc.y, { width: 200, height: 60 });
        doc.moveDown(3);
      } else {
        doc.moveDown(3);
        doc.fontSize(10).font('Helvetica').text('_____________________________', 50, doc.y);
        doc.moveDown(0.5);
      }
      
      doc.fontSize(10).font('Helvetica');
      doc.text(`Patient Name: ${patientData.firstName} ${patientData.lastName}`, 50, doc.y);
      doc.text(`Date: ${patientData.signatureDate || new Date().toLocaleDateString()}`, 300, doc.y - 10);
      
      // Footer
      doc.moveDown(3);
      doc.fontSize(8).text('This form contains confidential patient information. Please handle with care.', {
        align: 'center'
      });
      doc.text(`Form generated on ${new Date().toLocaleString()}`, {
        align: 'center'
      });

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}