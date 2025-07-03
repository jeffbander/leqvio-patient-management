import React, { useState, useCallback } from "react";
import { Upload, Camera, FileImage, Loader2, Check, AlertCircle, CreditCard, Phone, Building, User, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface ExtractedInsuranceData {
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

interface InsuranceCardExtractorProps {
  onDataExtracted?: (data: ExtractedInsuranceData) => void;
  isDisabled?: boolean;
}

interface EligibilityVerificationResponse {
  eligibility_id: string;
  status: 'active' | 'inactive' | 'pending' | 'error';
  member: {
    member_id: string;
    member_name: string;
    date_of_birth?: string;
    relationship: string;
  };
  coverage: {
    effective_date: string;
    termination_date?: string;
    copays: {
      primary_care?: string;
      specialist?: string;
      emergency_room?: string;
    };
    deductible?: {
      individual: string;
      family?: string;
      remaining?: string;
    };
    out_of_pocket_max?: {
      individual: string;
      family?: string;
      remaining?: string;
    };
  };
  benefits: {
    medical_benefits: boolean;
    prescription_benefits: boolean;
    dental_benefits?: boolean;
    vision_benefits?: boolean;
  };
  payer_info: {
    payer_name: string;
    payer_id: string;
    group_number?: string;
    plan_name?: string;
  };
  verification_details: {
    verified_at: string;
    verification_source: string;
    confidence_score: number;
    warnings?: string[];
    errors?: string[];
  };
}

export default function InsuranceCardExtractor({ onDataExtracted, isDisabled = false }: InsuranceCardExtractorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<ExtractedInsuranceData | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isVerifyingEligibility, setIsVerifyingEligibility] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<EligibilityVerificationResponse | null>(null);
  const { toast } = useToast();

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      // Upload and extract comprehensive insurance data
      const formData = new FormData();
      formData.append('photo', file);

      const response = await fetch('/api/extract-insurance-card', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract insurance card data');
      }

      const data: ExtractedInsuranceData = await response.json();
      setExtractedData(data);
      onDataExtracted?.(data);

      const cardScanStatus = data.cardscan_feedback ? 
        ` • CardScan.ai: ${data.cardscan_feedback.field_comparison.accuracy_percentage}% match` : 
        ` • CardScan.ai: unavailable`;

      toast({
        title: "Insurance Card Processed",
        description: `Extracted data from ${data.metadata.image_side} side with ${Math.round(data.metadata.ocr_confidence.overall * 100)}% confidence${cardScanStatus}`,
        variant: data.cardscan_feedback?.validation_status === 'error' ? "destructive" : "default",
      });

    } catch (error) {
      console.error('Insurance card extraction error:', error);
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : "Failed to extract insurance card data",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [onDataExtracted, toast]);

  const handleEligibilityCheck = useCallback(async () => {
    if (!extractedData) {
      toast({
        title: "No Card Data",
        description: "Please extract insurance card data first",
        variant: "destructive",
      });
      return;
    }

    setIsVerifyingEligibility(true);
    setEligibilityResult(null);

    try {
      const response = await fetch('/api/cardscan/eligibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          member_id: extractedData.member.member_id,
          member_name: extractedData.member.subscriber_name,
          dob: extractedData.member.dob,
          group_number: extractedData.insurer.group_number,
          bin: extractedData.pharmacy.bin,
          pcn: extractedData.pharmacy.pcn,
          payer_name: extractedData.insurer.name,
        }),
      });

      if (!response.ok) {
        throw new Error(`Eligibility verification failed: ${response.status}`);
      }

      const result: EligibilityVerificationResponse = await response.json();
      setEligibilityResult(result);

      toast({
        title: "Eligibility Verified",
        description: `Coverage status: ${result.status} • Confidence: ${Math.round(result.verification_details.confidence_score * 100)}%`,
        variant: result.status === 'active' ? 'default' : 'destructive',
      });

    } catch (error) {
      console.error('Eligibility verification error:', error);
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Unable to verify insurance eligibility",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingEligibility(false);
    }
  }, [extractedData, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (isDisabled || isProcessing) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload, isDisabled, isProcessing]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return "default";
    if (confidence >= 0.6) return "secondary";
    return "destructive";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Insurance Card Data Extraction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
            ${isDisabled || isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
          `}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => !isDisabled && !isProcessing && setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => {
            if (!isDisabled && !isProcessing) {
              document.getElementById('insurance-card-upload')?.click();
            }
          }}
        >
          <input
            id="insurance-card-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isDisabled || isProcessing}
          />
          
          {isProcessing ? (
            <div className="space-y-3">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-blue-500" />
              <p className="text-sm text-gray-600">Extracting comprehensive insurance data...</p>
              {uploadProgress > 0 && (
                <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <CreditCard className="h-8 w-8 mx-auto text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Upload insurance card to extract all information
                </p>
                <p className="text-xs text-gray-500">
                  Front or back side - extracts member info, pharmacy details, copays, contact info
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Supports all major insurance providers and plan types
                </p>
              </div>
              <Button variant="outline" size="sm" disabled={isDisabled}>
                <Upload className="h-4 w-4 mr-2" />
                Select Insurance Card
              </Button>
            </div>
          )}
        </div>

        {/* Results Display */}
        {extractedData && (
          <div className="space-y-4">
            {/* Summary Header */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant={getConfidenceBadge(extractedData.metadata.ocr_confidence.overall)}>
                    {Math.round(extractedData.metadata.ocr_confidence.overall * 100)}% Confidence
                  </Badge>
                  <Badge variant="outline">
                    {extractedData.metadata.image_side.charAt(0).toUpperCase() + extractedData.metadata.image_side.slice(1)} Side
                  </Badge>
                </div>
              </div>
              {extractedData.insurer.name && (
                <div className="text-right">
                  <p className="font-medium text-gray-900">{extractedData.insurer.name}</p>
                  <p className="text-sm text-gray-600">{extractedData.insurer.plan_name}</p>
                </div>
              )}
            </div>

            <Tabs defaultValue="member" className="w-full">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="member">Member</TabsTrigger>
                <TabsTrigger value="insurer">Insurer</TabsTrigger>
                <TabsTrigger value="pharmacy">Pharmacy</TabsTrigger>
                <TabsTrigger value="costs">Costs</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                {extractedData.cardscan_feedback && (
                  <TabsTrigger value="validation">CardScan.ai</TabsTrigger>
                )}
                <TabsTrigger value="raw">Raw Data</TabsTrigger>
              </TabsList>

              <TabsContent value="member" className="space-y-3">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Member ID</label>
                    <p className="text-sm font-mono">{extractedData.member.member_id || "Not found"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subscriber Name</label>
                    <p className="text-sm">{extractedData.member.subscriber_name || "Not found"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date of Birth</label>
                    <p className="text-sm">{extractedData.member.dob || "Not found"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Group Number</label>
                    <p className="text-sm font-mono">{extractedData.insurer.group_number || "Not found"}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="insurer" className="space-y-3">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Insurance Company</label>
                    <p className="text-sm">{extractedData.insurer.name || "Not found"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plan Type</label>
                    <p className="text-sm">{extractedData.insurer.plan_type || "Not found"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plan Name</label>
                    <p className="text-sm">{extractedData.insurer.plan_name || "Not found"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Payer ID</label>
                    <p className="text-sm font-mono">{extractedData.insurer.payer_id || "Not found"}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pharmacy" className="space-y-3">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">BIN</label>
                    <p className="text-sm font-mono">{extractedData.pharmacy.bin || "Not found"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">PCN</label>
                    <p className="text-sm font-mono">{extractedData.pharmacy.pcn || "Not found"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rx Group</label>
                    <p className="text-sm font-mono">{extractedData.pharmacy.rx_group || "Not found"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rx ID</label>
                    <p className="text-sm font-mono">{extractedData.pharmacy.rx_id || "Not found"}</p>
                  </div>
                  {extractedData.pharmacy.pharmacy_phone && (
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pharmacy Phone</label>
                      <p className="text-sm">{extractedData.pharmacy.pharmacy_phone}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="costs" className="space-y-3">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">PCP Copay</label>
                    <p className="text-sm">{extractedData.cost_share.pcp_copay || "Not listed"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Specialist Copay</label>
                    <p className="text-sm">{extractedData.cost_share.specialist_copay || "Not listed"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">ER Copay</label>
                    <p className="text-sm">{extractedData.cost_share.er_copay || "Not listed"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deductible</label>
                    <p className="text-sm">{extractedData.cost_share.deductible || "Not listed"}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-3">
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  {extractedData.contact.customer_service_phone && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Customer Service</label>
                      <p className="text-sm">{extractedData.contact.customer_service_phone}</p>
                    </div>
                  )}
                  {extractedData.contact.website_url && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Website</label>
                      <p className="text-sm text-blue-600">{extractedData.contact.website_url}</p>
                    </div>
                  )}
                  {extractedData.contact.mailing_address && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mailing Address</label>
                      <p className="text-sm">{extractedData.contact.mailing_address}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {extractedData.cardscan_feedback && (
                <TabsContent value="validation" className="space-y-4">
                  {/* Validation Status */}
                  <div className={`p-4 rounded-lg border-l-4 ${
                    extractedData.cardscan_feedback.validation_status === 'valid' ? 'bg-green-50 border-green-500' :
                    extractedData.cardscan_feedback.validation_status === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                    'bg-red-50 border-red-500'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">CardScan.ai Validation</h4>
                      <Badge variant={
                        extractedData.cardscan_feedback.validation_status === 'valid' ? 'default' :
                        extractedData.cardscan_feedback.validation_status === 'warning' ? 'secondary' :
                        'destructive'
                      }>
                        {extractedData.cardscan_feedback.validation_status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700">
                      Field accuracy: {extractedData.cardscan_feedback.field_comparison.accuracy_percentage}% 
                      ({extractedData.cardscan_feedback.field_comparison.matches}/{extractedData.cardscan_feedback.field_comparison.total_fields} fields match)
                    </p>
                  </div>

                  {/* Confidence Comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">OpenAI Vision</label>
                      <p className="text-2xl font-bold text-blue-600">
                        {Math.round(extractedData.cardscan_feedback.openai_confidence * 100)}%
                      </p>
                      <p className="text-xs text-gray-600">Confidence</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">CardScan.ai</label>
                      <p className="text-2xl font-bold text-green-600">
                        {Math.round(extractedData.cardscan_feedback.cardscan_confidence * 100)}%
                      </p>
                      <p className="text-xs text-gray-600">Confidence</p>
                    </div>
                  </div>

                  {/* Processing Time Comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">OpenAI Processing</label>
                      <p className="text-lg font-bold text-purple-600">
                        {extractedData.cardscan_feedback.processing_time_comparison.openai_ms}ms
                      </p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">CardScan Processing</label>
                      <p className="text-lg font-bold text-orange-600">
                        {extractedData.cardscan_feedback.processing_time_comparison.cardscan_ms}ms
                      </p>
                    </div>
                  </div>

                  {/* Recommendations */}
                  {extractedData.cardscan_feedback.recommendations.length > 0 && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recommendations</label>
                      <ul className="mt-2 space-y-1">
                        {extractedData.cardscan_feedback.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <span className="text-blue-500 mr-2">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Eligibility Verification Button */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Insurance Eligibility Verification</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Verify current coverage and benefits using CardScan.ai
                        </p>
                      </div>
                      <Button 
                        onClick={handleEligibilityCheck}
                        disabled={isVerifyingEligibility}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isVerifyingEligibility ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Verifying...
                          </>
                        ) : (
                          'Verify Eligibility'
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Eligibility Results */}
                  {eligibilityResult && (
                    <div className="p-4 bg-white rounded-lg border">
                      <h4 className="font-medium text-gray-900 mb-3">Eligibility Verification Results</h4>
                      
                      <div className={`p-3 rounded-lg mb-4 ${
                        eligibilityResult.status === 'active' ? 'bg-green-50 border border-green-200' :
                        eligibilityResult.status === 'inactive' ? 'bg-red-50 border border-red-200' :
                        'bg-yellow-50 border border-yellow-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Coverage Status</span>
                          <Badge variant={
                            eligibilityResult.status === 'active' ? 'default' :
                            eligibilityResult.status === 'inactive' ? 'destructive' :
                            'secondary'
                          }>
                            {eligibilityResult.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Member Information</label>
                          <div className="mt-1 space-y-1">
                            <p><span className="font-medium">ID:</span> {eligibilityResult.member.member_id}</p>
                            <p><span className="font-medium">Name:</span> {eligibilityResult.member.member_name}</p>
                            <p><span className="font-medium">Relationship:</span> {eligibilityResult.member.relationship}</p>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Coverage Dates</label>
                          <div className="mt-1 space-y-1">
                            <p><span className="font-medium">Effective:</span> {eligibilityResult.coverage.effective_date}</p>
                            {eligibilityResult.coverage.termination_date && (
                              <p><span className="font-medium">Termination:</span> {eligibilityResult.coverage.termination_date}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Copays</label>
                          <div className="mt-1 space-y-1">
                            {eligibilityResult.coverage.copays.primary_care && (
                              <p><span className="font-medium">Primary:</span> {eligibilityResult.coverage.copays.primary_care}</p>
                            )}
                            {eligibilityResult.coverage.copays.specialist && (
                              <p><span className="font-medium">Specialist:</span> {eligibilityResult.coverage.copays.specialist}</p>
                            )}
                            {eligibilityResult.coverage.copays.emergency_room && (
                              <p><span className="font-medium">ER:</span> {eligibilityResult.coverage.copays.emergency_room}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Benefits</label>
                          <div className="mt-1 space-y-1">
                            <p><span className="font-medium">Medical:</span> {eligibilityResult.benefits.medical_benefits ? 'Yes' : 'No'}</p>
                            <p><span className="font-medium">Prescription:</span> {eligibilityResult.benefits.prescription_benefits ? 'Yes' : 'No'}</p>
                            {eligibilityResult.benefits.dental_benefits !== undefined && (
                              <p><span className="font-medium">Dental:</span> {eligibilityResult.benefits.dental_benefits ? 'Yes' : 'No'}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t">
                        <p className="text-xs text-gray-500">
                          Verified at {new Date(eligibilityResult.verification_details.verified_at).toLocaleString()} • 
                          Confidence: {Math.round(eligibilityResult.verification_details.confidence_score * 100)}%
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}

              <TabsContent value="raw" className="space-y-3">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Complete OCR Text</label>
                  <pre className="text-xs mt-2 whitespace-pre-wrap bg-white p-3 rounded border max-h-40 overflow-y-auto">
                    {extractedData.metadata.raw_text || "No raw text captured"}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>

            {/* Preview Image */}
            {previewImage && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Uploaded Image</h4>
                <div className="border rounded-lg p-2 bg-gray-50">
                  <img 
                    src={previewImage} 
                    alt="Insurance card" 
                    className="max-w-full h-40 object-contain mx-auto"
                  />
                </div>
              </div>
            )}

            {/* Low Confidence Warning */}
            {extractedData.metadata.ocr_confidence.overall < 0.8 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Low confidence detected. Please verify the extracted data is correct and consider re-uploading with better lighting or focus.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
          <strong>For best results:</strong>
          <ul className="mt-1 list-disc list-inside space-y-1">
            <li>Upload both front and back sides for complete information</li>
            <li>Ensure all text is clearly visible and in focus</li>
            <li>Include the entire card in the image</li>
            <li>Good lighting helps improve extraction accuracy</li>
            <li>System extracts member info, pharmacy details, copays, and contact information</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}