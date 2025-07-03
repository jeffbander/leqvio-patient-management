import React, { useState, useCallback } from "react";
import { Upload, Camera, FileImage, User, CreditCard, Shield, Check, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface PatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  confidence: number;
  rawText?: string;
}

interface InsuranceData {
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

interface IntakeStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  required: boolean;
}

export default function PatientIntake() {
  const [currentStep, setCurrentStep] = useState(0);
  const [idCardImage, setIdCardImage] = useState<string | null>(null);
  const [insuranceFrontImage, setInsuranceFrontImage] = useState<string | null>(null);
  const [insuranceBackImage, setInsuranceBackImage] = useState<string | null>(null);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [insuranceFrontData, setInsuranceFrontData] = useState<InsuranceData | null>(null);
  const [insuranceBackData, setInsuranceBackData] = useState<InsuranceData | null>(null);
  const [sourceId, setSourceId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const { toast } = useToast();

  const steps: IntakeStep[] = [
    {
      id: 'id-card',
      title: 'ID Card Scan',
      description: 'Take a photo of patient ID card or driver\'s license',
      status: idCardImage ? (patientData ? 'completed' : 'processing') : 'pending',
      required: true
    },
    {
      id: 'insurance-front',
      title: 'Insurance Card Front',
      description: 'Take a photo of the front of the insurance card',
      status: insuranceFrontImage ? (insuranceFrontData ? 'completed' : 'processing') : 'pending',
      required: true
    },
    {
      id: 'insurance-back',
      title: 'Insurance Card Back',
      description: 'Take a photo of the back of the insurance card',
      status: insuranceBackImage ? (insuranceBackData ? 'completed' : 'processing') : 'pending',
      required: false
    },
    {
      id: 'review',
      title: 'Review & Submit',
      description: 'Review extracted data and submit for processing',
      status: (patientData && insuranceFrontData) ? 'pending' : 'pending',
      required: true
    }
  ];

  const generateSourceId = useCallback((firstName: string, lastName: string, dob: string) => {
    const cleanFirst = firstName.replace(/\s+/g, '_').toUpperCase();
    const cleanLast = lastName.replace(/\s+/g, '_').toUpperCase();
    const [month, day, year] = dob.split('/');
    return `${cleanLast}_${cleanFirst}__${month}_${day}_${year}`;
  }, []);

  const handleFileUpload = useCallback(async (file: File, type: 'id' | 'insurance-front' | 'insurance-back') => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const base64Data = base64.split(',')[1];

      // Store the image preview
      if (type === 'id') {
        setIdCardImage(base64);
      } else if (type === 'insurance-front') {
        setInsuranceFrontImage(base64);
      } else if (type === 'insurance-back') {
        setInsuranceBackImage(base64);
      }

      setIsProcessing(true);
      setProcessingStep(`Processing ${type === 'id' ? 'ID card' : type === 'insurance-front' ? 'insurance front' : 'insurance back'}...`);

      try {
        if (type === 'id') {
          // Extract patient data from ID card
          const response = await fetch('/api/extract-patient-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Data }),
          });

          if (!response.ok) {
            throw new Error(`Patient data extraction failed: ${response.status}`);
          }

          const data: PatientData = await response.json();
          setPatientData(data);

          // Generate source ID
          if (data.firstName && data.lastName && data.dateOfBirth) {
            const generatedSourceId = generateSourceId(data.firstName, data.lastName, data.dateOfBirth);
            setSourceId(generatedSourceId);
          }

          toast({
            title: "ID Card Processed",
            description: `Extracted patient data with ${Math.round(data.confidence * 100)}% confidence`,
          });

        } else {
          // Extract insurance data
          const response = await fetch('/api/extract-insurance-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Data }),
          });

          if (!response.ok) {
            throw new Error(`Insurance card extraction failed: ${response.status}`);
          }

          const data: InsuranceData = await response.json();
          
          if (type === 'insurance-front') {
            setInsuranceFrontData(data);
            toast({
              title: "Insurance Front Processed",
              description: `Extracted data from front side with ${Math.round(data.metadata.ocr_confidence.overall * 100)}% confidence`,
            });
          } else {
            setInsuranceBackData(data);
            toast({
              title: "Insurance Back Processed",
              description: `Extracted data from back side with ${Math.round(data.metadata.ocr_confidence.overall * 100)}% confidence`,
            });
          }
        }

      } catch (error) {
        console.error(`${type} extraction error:`, error);
        toast({
          title: "Extraction Failed",
          description: error instanceof Error ? error.message : `Failed to extract ${type} data`,
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
        setProcessingStep("");
      }
    };

    reader.readAsDataURL(file);
  }, [generateSourceId, toast]);

  const FileUploadArea = ({ type, title, subtitle, image }: {
    type: 'id' | 'insurance-front' | 'insurance-back';
    title: string;
    subtitle: string;
    image: string | null;
  }) => {
    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload(files[0], type);
      }
    }, [type]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileUpload(files[0], type);
      }
    }, [type]);

    return (
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {image ? (
          <div className="space-y-4">
            <img src={image} alt={title} className="max-h-48 mx-auto rounded border shadow-sm" />
            <div className="flex items-center justify-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-600">Image uploaded</span>
            </div>
          </div>
        ) : (
          <>
            <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-600 mb-4">{subtitle}</p>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id={`file-${type}`}
                disabled={isProcessing}
              />
              <label htmlFor={`file-${type}`}>
                <Button variant="outline" className="cursor-pointer" disabled={isProcessing}>
                  <Upload className="h-4 w-4 mr-2" />
                  Select Image
                </Button>
              </label>
              <p className="text-xs text-gray-500">Or drag and drop an image here</p>
            </div>
          </>
        )}
      </div>
    );
  };

  const handleSubmit = async () => {
    if (!patientData || !insuranceFrontData) {
      toast({
        title: "Missing Data",
        description: "Please complete ID card and insurance card front scanning first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProcessingStep("Submitting patient intake...");

    try {
      // Here you would typically submit all the data to your backend
      // For now, we'll just show a success message
      
      toast({
        title: "Patient Intake Complete",
        description: `Source ID: ${sourceId} - All data extracted and ready for processing`,
      });

      // Navigate to next step or reset form
      
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit patient intake",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Patient Intake System</h1>
        <p className="text-gray-600">Complete patient registration with ID and insurance card scanning</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                step.status === 'completed' ? 'bg-green-600 text-white' :
                step.status === 'processing' ? 'bg-blue-600 text-white' :
                step.status === 'error' ? 'bg-red-600 text-white' :
                'bg-gray-200 text-gray-600'
              }`}>
                {step.status === 'completed' ? <Check className="h-5 w-5" /> : index + 1}
              </div>
              <div className="ml-3 text-sm">
                <p className="font-medium text-gray-900">{step.title}</p>
                <p className="text-gray-600">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="h-5 w-5 text-gray-400 mx-4" />
              )}
            </div>
          ))}
        </div>
        
        {isProcessing && (
          <div className="space-y-2">
            <Progress value={33} className="w-full" />
            <p className="text-sm text-gray-600">{processingStep}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* ID Card Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Step 1: ID Card
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploadArea
              type="id"
              title="Scan ID Card"
              subtitle="Driver's license, state ID, or passport"
              image={idCardImage}
            />
            
            {patientData && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">Extracted Patient Data:</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Name:</span> {patientData.firstName} {patientData.lastName}</p>
                  <p><span className="font-medium">DOB:</span> {patientData.dateOfBirth}</p>
                  <p><span className="font-medium">Confidence:</span> {Math.round(patientData.confidence * 100)}%</p>
                  {sourceId && (
                    <p><span className="font-medium">Source ID:</span> <code className="bg-white px-1 py-0.5 rounded">{sourceId}</code></p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insurance Front Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Step 2: Insurance Front
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploadArea
              type="insurance-front"
              title="Scan Insurance Front"
              subtitle="Front side of insurance card"
              image={insuranceFrontImage}
            />
            
            {insuranceFrontData && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Extracted Insurance Data:</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Insurer:</span> {insuranceFrontData.insurer.name}</p>
                  <p><span className="font-medium">Member ID:</span> {insuranceFrontData.member.member_id}</p>
                  <p><span className="font-medium">Group:</span> {insuranceFrontData.insurer.group_number}</p>
                  <p><span className="font-medium">Confidence:</span> {Math.round(insuranceFrontData.metadata.ocr_confidence.overall * 100)}%</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insurance Back Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Step 3: Insurance Back (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploadArea
              type="insurance-back"
              title="Scan Insurance Back"
              subtitle="Back side of insurance card"
              image={insuranceBackImage}
            />
            
            {insuranceBackData && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-2">Additional Insurance Data:</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Pharmacy BIN:</span> {insuranceBackData.pharmacy.bin || 'Not found'}</p>
                  <p><span className="font-medium">Pharmacy PCN:</span> {insuranceBackData.pharmacy.pcn || 'Not found'}</p>
                  <p><span className="font-medium">Customer Service:</span> {insuranceBackData.contact.customer_service_phone || 'Not found'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Submit Section */}
      {patientData && insuranceFrontData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Step 4: Review & Submit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                All required data has been extracted successfully. Review the information above and click submit to complete patient intake.
              </AlertDescription>
            </Alert>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Ready to submit patient intake</p>
                <p className="text-sm text-gray-600">Source ID: <code className="bg-gray-100 px-2 py-1 rounded">{sourceId}</code></p>
              </div>
              <Button 
                onClick={handleSubmit}
                disabled={isProcessing}
                size="lg"
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Complete Intake
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}