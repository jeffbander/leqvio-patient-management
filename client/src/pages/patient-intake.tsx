import React, { useState, useCallback } from "react";
import { Upload, Camera, FileImage, User, CreditCard, Shield, Check, AlertCircle, ChevronRight, Eye, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import providerloopLogo from "/generated-icon.png";

// Utility function to convert base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

interface PatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // MM/DD/YYYY format
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
  cardscan_feedback?: {
    cardscan_confidence: number;
    openai_confidence: number;
    field_comparison: {
      matches: number;
      total_fields: number;
      accuracy_percentage: number;
    };
    validation_status: 'valid' | 'warning' | 'error';
    recommendations: string[];
    processing_time_comparison: {
      cardscan_ms: number;
      openai_ms: number;
    };
  };
}

export default function PatientIntake() {
  const [idCardImage, setIdCardImage] = useState<string | null>(null);
  const [insuranceFrontImage, setInsuranceFrontImage] = useState<string | null>(null);
  const [insuranceBackImage, setInsuranceBackImage] = useState<string | null>(null);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [insuranceFrontData, setInsuranceFrontData] = useState<InsuranceData | null>(null);
  const [insuranceBackData, setInsuranceBackData] = useState<InsuranceData | null>(null);
  const [sourceId, setSourceId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();

  const generateSourceId = useCallback((firstName: string, lastName: string, dob: string) => {
    const cleanLast = lastName.replace(/\s+/g, '_');
    const cleanFirst = firstName.replace(/\s+/g, '_');
    const [month, day, year] = dob.split('/');
    return `${cleanLast}_${cleanFirst}__${month}_${day}_${year}`;
  }, []);

  const handleFileUpload = useCallback((file: File, type: 'id' | 'insurance-front' | 'insurance-back') => {
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
    reader.onload = (e) => {
      const base64 = e.target?.result as string;

      // Store the image preview only, don't process yet
      if (type === 'id') {
        setIdCardImage(base64);
        toast({
          title: "ID Card Uploaded",
          description: "Image saved. Take all photos then click 'Process All Cards'.",
        });
      } else if (type === 'insurance-front') {
        setInsuranceFrontImage(base64);
        toast({
          title: "Insurance Front Uploaded", 
          description: "Image saved. Take all photos then click 'Process All Cards'.",
        });
      } else if (type === 'insurance-back') {
        setInsuranceBackImage(base64);
        toast({
          title: "Insurance Back Uploaded",
          description: "Image saved. Take all photos then click 'Process All Cards'.",
        });
      }
    };

    reader.readAsDataURL(file);
  }, [toast]);

  const processAllCards = useCallback(async () => {
    if (!idCardImage || !insuranceFrontImage) {
      toast({
        title: "Missing Images",
        description: "Please upload at least ID card and insurance front images.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Process ID card first
      setProcessingStep("Processing ID card...");
      
      // Convert base64 image to Blob for form data
      const idBase64Data = idCardImage.split(',')[1];
      const idBlob = base64ToBlob(idBase64Data, 'image/jpeg');
      
      const idFormData = new FormData();
      idFormData.append('photo', idBlob, 'id-card.jpg');
      
      const idResponse = await fetch('/api/extract-patient-data', {
        method: 'POST',
        body: idFormData,
      });

      if (!idResponse.ok) {
        const errorData = await idResponse.json();
        throw new Error(`ID card extraction failed: ${errorData.error || idResponse.status}`);
      }

      const patientData: PatientData = await idResponse.json();
      setPatientData(patientData);

      // Generate source ID
      if (patientData.firstName && patientData.lastName && patientData.dateOfBirth) {
        const generatedSourceId = generateSourceId(patientData.firstName, patientData.lastName, patientData.dateOfBirth);
        setSourceId(generatedSourceId);
      }

      // Process insurance front
      setProcessingStep("Processing insurance front...");
      
      const frontBase64Data = insuranceFrontImage.split(',')[1];
      const frontBlob = base64ToBlob(frontBase64Data, 'image/jpeg');
      
      const frontFormData = new FormData();
      frontFormData.append('photo', frontBlob, 'insurance-front.jpg');
      
      const frontResponse = await fetch('/api/extract-insurance-card', {
        method: 'POST',
        body: frontFormData,
      });

      if (!frontResponse.ok) {
        const errorData = await frontResponse.json();
        throw new Error(`Insurance front extraction failed: ${errorData.error || frontResponse.status}`);
      }

      const frontData: InsuranceData = await frontResponse.json();
      setInsuranceFrontData(frontData);

      // Process insurance back if available
      if (insuranceBackImage) {
        setProcessingStep("Processing insurance back...");
        
        const backBase64Data = insuranceBackImage.split(',')[1];
        const backBlob = base64ToBlob(backBase64Data, 'image/jpeg');
        
        const backFormData = new FormData();
        backFormData.append('photo', backBlob, 'insurance-back.jpg');
        
        const backResponse = await fetch('/api/extract-insurance-card', {
          method: 'POST',
          body: backFormData,
        });

        if (!backResponse.ok) {
          const errorData = await backResponse.json();
          throw new Error(`Insurance back extraction failed: ${errorData.error || backResponse.status}`);
        }

        const backData: InsuranceData = await backResponse.json();
        setInsuranceBackData(backData);
      }

      toast({
        title: "All Cards Processed Successfully",
        description: `Extracted data from ${insuranceBackImage ? '3' : '2'} cards with high confidence`,
      });

    } catch (error) {
      console.error('Card processing error:', error);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Failed to process cards",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  }, [idCardImage, insuranceFrontImage, insuranceBackImage, generateSourceId, toast]);

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
                accept="image/*,capture=camera"
                onChange={handleFileSelect}
                className="hidden"
                id={`file-${type}`}
                disabled={isProcessing}
                capture="environment"
              />
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline" 
                  className="cursor-pointer" 
                  disabled={isProcessing}
                  onClick={() => document.getElementById(`file-${type}`)?.click()}
                  type="button"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select Image
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id={`camera-${type}`}
                  disabled={isProcessing}
                  capture="environment"
                />
                <Button 
                  variant="outline" 
                  className="cursor-pointer" 
                  disabled={isProcessing}
                  onClick={() => document.getElementById(`camera-${type}`)?.click()}
                  type="button"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
              </div>
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
        description: "Please process all cards first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProcessingStep("Submitting patient intake to automation system...");

    let automationData: any = null;
    try {
      // Prepare patient data for QuickAddQHC chain in AIGENTS format
      const starting_variables: Record<string, string> = {
        // Required Patient_ID field (same as source_id)
        Patient_ID: sourceId,
        
        // Patient Identity
        first_name: patientData.firstName,
        last_name: patientData.lastName,
        date_of_birth: patientData.dateOfBirth,
        source_id: sourceId,
        
        // Insurance Information
        insurance_company: insuranceFrontData.insurer.name,
        member_id: insuranceFrontData.member.member_id,
        group_number: insuranceFrontData.insurer.group_number,
        subscriber_name: insuranceFrontData.member.subscriber_name,
        plan_name: insuranceFrontData.insurer.plan_name,
        
        // Contact Information
        customer_service_phone: insuranceFrontData.contact.customer_service_phone,
        
        // Cost Share Information
        pcp_copay: insuranceFrontData.cost_share.pcp_copay,
        specialist_copay: insuranceFrontData.cost_share.specialist_copay,
        er_copay: insuranceFrontData.cost_share.er_copay,
        deductible: insuranceFrontData.cost_share.deductible,
        
        // Pharmacy Information
        rx_bin: insuranceFrontData.pharmacy.bin,
        rx_pcn: insuranceFrontData.pharmacy.pcn,
        rx_group: insuranceFrontData.pharmacy.rx_group,
        
        // Metadata
        extraction_confidence: Math.round(patientData.confidence * 100).toString(),
        insurance_confidence: Math.round(insuranceFrontData.metadata.ocr_confidence.overall * 100).toString(),
        has_insurance_back: insuranceBackData ? "true" : "false",
        processed_via: "external_app",
        intake_timestamp: new Date().toISOString()
      };

      // Remove empty values
      Object.keys(starting_variables).forEach(key => {
        if (!starting_variables[key] || starting_variables[key].trim() === "") {
          delete starting_variables[key];
        }
      });

      // Test with a known working chain name first
      automationData = {
        run_email: "jeffrey.Bander@providerloop.com",
        source_id: sourceId,
        chain_to_run: "ATTACHMENT PROCESSING (LABS)",
        starting_variables,
        human_readable_record: "external app"
      };

      // Debug: Log the exact payload being sent
      console.log('=== QUICKADDQHC SUBMISSION DEBUG ===');
      console.log('Payload:', JSON.stringify(automationData, null, 2));
      console.log('Starting variables:');
      Object.keys(starting_variables).forEach(key => {
        console.log(`  ${key}: "${starting_variables[key]}" (type: ${typeof starting_variables[key]})`);
      });
      console.log('=== END DEBUG ===');

      // Submit to AIGENTS automation system with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch('https://start-chain-run-943506065004.us-central1.run.app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(automationData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const result = await response.text();
      
      // Debug: Log the response
      console.log('=== AIGENTS API RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Response:', result);
      console.log('=== END RESPONSE ===');
      
      if (response.ok) {
        // Extract ChainRun_ID from the API response
        let chainRunId = '';
        try {
          const chainRunMatch = result.match(/"ChainRun_ID"\s*:\s*"([^"]+)"/);
          if (chainRunMatch) {
            chainRunId = chainRunMatch[1];
          }
        } catch (e) {
          console.log('Could not extract ChainRun_ID from response');
        }
        
        // Log the successful automation trigger
        await fetch('/api/automation-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chainName: "ATTACHMENT PROCESSING (LABS)",
            email: "jeffrey.Bander@providerloop.com",
            status: "success",
            response: result,
            requestData: automationData,
            uniqueId: chainRunId,
            timestamp: new Date()
          }),
        });

        toast({
          title: "Patient Intake Complete ✓",
          description: `ATTACHMENT PROCESSING (LABS) chain triggered successfully! Chain Run ID: ${chainRunId || 'Generated'}`,
        });
      } else {
        // Log the failed automation trigger
        await fetch('/api/automation-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chainName: "ATTACHMENT PROCESSING (LABS)",
            email: "jeffrey.Bander@providerloop.com",
            status: "error",
            response: result,
            requestData: automationData,
            uniqueId: "",
            timestamp: new Date()
          }),
        });

        throw new Error(`ATTACHMENT PROCESSING (LABS) trigger failed: ${response.status} - ${result}`);
      }
      
    } catch (error) {
      console.error('Patient intake submission error:', error);
      
      let errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (error instanceof Error && error.name === 'AbortError') {
        errorMessage = 'Request timed out - AIGENTS API may be temporarily unavailable';
      } else if (errorMessage.includes('string did not match')) {
        errorMessage = `Validation error: ${errorMessage}. Check the browser console for detailed payload information.`;
      }
      
      // Log the failed automation trigger if not already logged
      if (!(error instanceof Error) || !error.message.includes('ATTACHMENT PROCESSING (LABS) trigger failed')) {
        const requestDataString = typeof automationData !== 'undefined' ? JSON.stringify(automationData) : "{}";
        await fetch('/api/automation-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chainName: "ATTACHMENT PROCESSING (LABS)",
            email: "jeffrey.Bander@providerloop.com",
            status: "error",
            response: errorMessage,
            requestData: requestDataString,
            uniqueId: "",
            timestamp: new Date()
          }),
        }).catch(logError => console.error('Failed to log error:', logError));
      }
      
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <Button variant="outline" size="sm">
                  ← Back
                </Button>
              </Link>
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img src={providerloopLogo} alt="Providerloop" className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Patient Intake System</h1>
                <p className="text-sm text-gray-600">Complete patient registration workflow</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Processing Status */}
        {isProcessing && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {processingStep || "Processing..."}
            </AlertDescription>
          </Alert>
        )}

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
              <div className="mt-4">
                <Tabs defaultValue="preview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preview" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="api" className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      API Response
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="preview" className="mt-4">
                    <div className="p-4 bg-green-50 rounded-lg">
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
                  </TabsContent>
                  
                  <TabsContent value="api" className="mt-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-2">OpenAI Vision API Response</h4>
                      <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-64">
                        {JSON.stringify(patientData, null, 2)}
                      </pre>
                      {patientData.rawText && (
                        <div className="mt-3">
                          <h5 className="font-medium text-gray-700 mb-1">Raw OCR Text:</h5>
                          <div className="text-xs bg-white p-3 rounded border max-h-32 overflow-auto">
                            {patientData.rawText}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
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
              <div className="mt-4">
                <Tabs defaultValue="preview" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="preview" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="openai" className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      OpenAI API
                    </TabsTrigger>
                    <TabsTrigger value="cardscan" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      CardScan API
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="preview" className="mt-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">KEY EXTRACTED FIELDS - PREVIEW</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium">Insurer:</span> {insuranceFrontData.insurer.name}</p>
                        <p><span className="font-medium">Member ID:</span> {insuranceFrontData.member.member_id}</p>
                        <p><span className="font-medium">Group Number:</span> {insuranceFrontData.insurer.group_number}</p>
                        <p><span className="font-medium">Plan Name:</span> {insuranceFrontData.insurer.plan_name}</p>
                        <p><span className="font-medium">Subscriber:</span> {insuranceFrontData.member.subscriber_name}</p>
                        <p><span className="font-medium">OCR Confidence:</span> {Math.round(insuranceFrontData.metadata.ocr_confidence.overall * 100)}%</p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="openai" className="mt-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-2">OpenAI Vision API Response</h4>
                      <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-64">
                        {JSON.stringify(insuranceFrontData, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="cardscan" className="mt-4">
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium text-purple-800 mb-2">CardScan.ai API Response</h4>
                      {insuranceFrontData.cardscan_feedback ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p><span className="font-medium">CardScan Confidence:</span> {Math.round(insuranceFrontData.cardscan_feedback.cardscan_confidence * 100)}%</p>
                              <p><span className="font-medium">OpenAI Confidence:</span> {Math.round(insuranceFrontData.cardscan_feedback.openai_confidence * 100)}%</p>
                            </div>
                            <div>
                              <p><span className="font-medium">Field Matches:</span> {insuranceFrontData.cardscan_feedback.field_comparison.matches}/{insuranceFrontData.cardscan_feedback.field_comparison.total_fields}</p>
                              <p><span className="font-medium">Accuracy:</span> {Math.round(insuranceFrontData.cardscan_feedback.field_comparison.accuracy_percentage)}%</p>
                            </div>
                          </div>
                          <Badge variant={insuranceFrontData.cardscan_feedback.validation_status === 'valid' ? 'default' : 'destructive'}>
                            {insuranceFrontData.cardscan_feedback.validation_status.toUpperCase()}
                          </Badge>
                          {insuranceFrontData.cardscan_feedback.recommendations.length > 0 && (
                            <div>
                              <p className="font-medium text-sm mb-1">Recommendations:</p>
                              <ul className="text-xs space-y-1">
                                {insuranceFrontData.cardscan_feedback.recommendations.map((rec, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="w-1 h-1 bg-purple-400 rounded-full mt-2 flex-shrink-0"></span>
                                    {rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">CardScan.ai comparison not available for this extraction.</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
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
              <div className="mt-4">
                <Tabs defaultValue="preview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preview" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="api" className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      API Response
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="preview" className="mt-4">
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium text-purple-800 mb-2">Additional Insurance Data:</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium">Pharmacy BIN:</span> {insuranceBackData.pharmacy.bin || 'Not found'}</p>
                        <p><span className="font-medium">Pharmacy PCN:</span> {insuranceBackData.pharmacy.pcn || 'Not found'}</p>
                        <p><span className="font-medium">RX Group:</span> {insuranceBackData.pharmacy.rx_group || 'Not found'}</p>
                        <p><span className="font-medium">Customer Service:</span> {insuranceBackData.contact.customer_service_phone || 'Not found'}</p>
                        <p><span className="font-medium">OCR Confidence:</span> {Math.round(insuranceBackData.metadata.ocr_confidence.overall * 100)}%</p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="api" className="mt-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-2">OpenAI Vision API Response</h4>
                      <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-64">
                        {JSON.stringify(insuranceBackData, null, 2)}
                      </pre>
                      {insuranceBackData.metadata.raw_text && (
                        <div className="mt-3">
                          <h5 className="font-medium text-gray-700 mb-1">Raw OCR Text:</h5>
                          <div className="text-xs bg-white p-3 rounded border max-h-32 overflow-auto">
                            {insuranceBackData.metadata.raw_text}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Process All Cards Button */}
        {(idCardImage || insuranceFrontImage || insuranceBackImage) && !patientData && (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <Button 
                  onClick={processAllCards}
                  disabled={isProcessing || (!idCardImage || !insuranceFrontImage)}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Processing Cards...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Process All Cards
                    </>
                  )}
                </Button>
                <p className="text-sm text-gray-600 mt-2">
                  {!idCardImage || !insuranceFrontImage 
                    ? "Please upload at least ID card and insurance front images"
                    : "Click to extract data from all uploaded cards"
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
                  onClick={() => setShowConfirmDialog(true)}
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

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Confirm Patient Intake Submission</h3>
              
              <div className="space-y-3 mb-6">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">Patient Information:</h4>
                  <p className="text-sm text-blue-700">
                    <strong>Name:</strong> {patientData?.firstName} {patientData?.lastName}
                  </p>
                  <p className="text-sm text-blue-700">
                    <strong>DOB:</strong> {patientData?.dateOfBirth}
                  </p>
                  <p className="text-sm text-blue-700">
                    <strong>Source ID:</strong> {sourceId}
                  </p>
                </div>
                
                <div className="bg-green-50 p-3 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">Insurance Information:</h4>
                  <p className="text-sm text-green-700">
                    <strong>Insurer:</strong> {insuranceFrontData?.insurer.name}
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Member ID:</strong> {insuranceFrontData?.member.member_id}
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Group Number:</strong> {insuranceFrontData?.insurer.group_number}
                  </p>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This will trigger the <strong>QuickAddQHC</strong> automation chain with all extracted patient and insurance data.
                  </AlertDescription>
                </Alert>
              </div>
              
              <div className="flex gap-3 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    setShowConfirmDialog(false);
                    handleSubmit();
                  }}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Triggering QuickAddQHC...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Confirm & Trigger QuickAddQHC
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}