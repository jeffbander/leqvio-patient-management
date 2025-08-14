import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';

interface PatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  orderingMD: string;
  diagnosis: string;
  phone?: string;
  cellPhone?: string;
  email?: string;
  address?: string;
  primaryInsurance?: string;
  primaryPlan?: string;
  primaryInsuranceNumber?: string;
  primaryGroupId?: string;
  signatureData?: string;
  providerSignatureData?: string;
  signatureDate?: string;
  copayProgram?: boolean;
  ongoingSupport?: boolean;
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
      doc.text(`Gender: ${patientData.gender || 'Not provided'}`, 300, doc.y - 10);
      doc.moveDown();
      
      doc.text(`Home Phone: ${patientData.phone || 'Not provided'}`, 50, doc.y);
      doc.text(`Cell Phone: ${patientData.cellPhone || 'Not provided'}`, 300, doc.y - 10);
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
      
      doc.text('Your doctor has initiated enrollment into Novartis Pharmaceuticals Patient Support Services for your newly prescribed medication. In order to provide services on your behalf such as confirming your coverage for the medication and assessing any financial assistance you may be eligible for; we will need you to complete the below authorization. This allows us to utilize your health information (called "Protected Health Information" or "PHI") and share it with your health plan and/or pharmacy that will receive your doctor\'s prescription. This authorization will allow your healthcare providers, health plans and health insurers that maintain PHI about you to disclose your PHI to Novartis Pharmaceuticals Corporation so that the Service Center may provide services to you or on your behalf.', {
        width: 500,
        align: 'justify'
      });
      doc.moveDown(2);

      // Signature Section
      // Two-column signature layout
      const signatureY = doc.y;
      
      // Patient signature (left side)
      doc.fontSize(12).font('Helvetica-Bold').text('PATIENT SIGNATURE', 50, signatureY);
      
      // Add patient signature image if provided
      if (patientData.signatureData && patientData.signatureData.startsWith('data:image')) {
        const base64Data = patientData.signatureData.split(',')[1];
        const imgBuffer = Buffer.from(base64Data, 'base64');
        doc.image(imgBuffer, 50, signatureY + 20, { width: 200, height: 60 });
      } else {
        doc.fontSize(10).font('Helvetica').text('_____________________________', 50, signatureY + 50);
      }
      
      // Provider signature (right side)
      doc.fontSize(12).font('Helvetica-Bold').text('PROVIDER SIGNATURE', 320, signatureY);
      
      // Add provider signature image if provided
      if (patientData.providerSignatureData && patientData.providerSignatureData.startsWith('data:image')) {
        const base64Data = patientData.providerSignatureData.split(',')[1];
        const imgBuffer = Buffer.from(base64Data, 'base64');
        doc.image(imgBuffer, 320, signatureY + 20, { width: 200, height: 60 });
      } else {
        doc.fontSize(10).font('Helvetica').text('_____________________________', 320, signatureY + 50);
      }
      
      doc.y = signatureY + 80; // Move cursor below both signatures
      
      doc.fontSize(10).font('Helvetica');
      doc.text(`Patient Name: ${patientData.firstName} ${patientData.lastName}`, 50, doc.y);
      doc.text(`Date: ${patientData.signatureDate || new Date().toLocaleDateString()}`, 300, doc.y - 10);
      
      // Program enrollments
      doc.moveDown(2);
      if (patientData.copayProgram) {
        doc.text('✓ LEQVIO Co-pay Program: I have read and agree to the Co-pay Program Terms & Conditions', 50, doc.y);
        doc.moveDown();
      }
      if (patientData.ongoingSupport) {
        doc.text('✓ Ongoing Support from the LEQVIO Care Program: Enrolled in dedicated phone support', 50, doc.y);
        doc.moveDown();
      }
      
      // Prescriber Attestation
      doc.moveDown(2);
      doc.fontSize(12).font('Helvetica-Bold').text('PRESCRIBER ATTESTATION', 50, doc.y);
      doc.moveDown();
      doc.fontSize(9).font('Helvetica');
      doc.text('I certify the above therapy is medically necessary and this information is accurate to the best of my knowledge. I certify I am the provider who has prescribed LEQVIO to the patient named on this form. I certify that any medication received from Novartis Pharmaceuticals Corporation, its affiliates and service providers ("Novartis"), or the Novartis Patient Assistance Foundation, Inc. and its service providers ("NPAF"), will be used only for the patient named on this form and will not be offered for sale, trade, or barter, returned for credit, or submitted for reimbursement in any form. I acknowledge that NPAF is exclusively for purposes of patient care and not for remuneration of any sort. I understand that Novartis and NPAF may revise, change, or terminate their respective programs at any time. I have discussed the LEQVIO Service Center with my patient, who has authorized me under HIPAA and state law to disclose their information to Novartis for the limited purpose of enrolling in the LEQVIO Service Center. To complete this enrollment, Novartis may contact the patient by phone, text, and email.', {
        width: 500,
        align: 'justify'
      });
      doc.moveDown();
      doc.text(`E-signed: ${patientData.orderingMD}`, 50, doc.y);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 300, doc.y - 10);
      
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