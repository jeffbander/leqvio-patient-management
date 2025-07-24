import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileImage, Loader2, Download, Copy, Send, User, Home, Phone, Mail, Calendar, CreditCard, Building, Stethoscope } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CHAIN_OPTIONS = [
  "ATTACHMENT PROCESSING (LABS)",
  "ATTACHMENT PROCESSING (SLEEP STUDY)", 
  "ATTACHMENT PROCESSING (RESEARCH STUDY)",
  "QuickAddQHC",
  "REFERRAL PROCESSING",
  "CLIENT REPORT SENT",
  "SLEEP STUDY RESULTS"
];

interface PatientData {
  accountNo?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  age?: string;
  sex?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  homePhone?: string;
  cellPhone?: string;
  email?: string;
  primaryCareProvider?: string;
  maritalStatus?: string;
  language?: string;
  race?: string;
  ethnicity?: string;
  insurancePlanName?: string;
  subscriberNo?: string;
  relationship?: string;
  rawData?: string;
  confidence?: number;
}

export default function PatientInfoExtraction() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<PatientData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState(CHAIN_OPTIONS[3]); // Default to QuickAddQHC
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Process the image
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await fetch('/api/extract-patient-info', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setExtractedData(data);
        toast({
          title: "Extraction Complete",
          description: "Patient information extracted successfully",
        });
      } else {
        throw new Error(data.error || 'Failed to extract data');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : "Failed to extract patient information",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Data copied to clipboard",
    });
  };

  const downloadJSON = () => {
    if (!extractedData) return;
    
    const dataStr = JSON.stringify(extractedData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `patient_data_${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const submitToAutomation = async () => {
    if (!extractedData) return;

    setIsSubmitting(true);
    
    try {
      // Generate source ID from patient info
      const sourceId = extractedData.lastName && extractedData.firstName && extractedData.dateOfBirth
        ? `${extractedData.lastName}_${extractedData.firstName}__${extractedData.dateOfBirth.replace(/\//g, '_')}`
        : `Patient_${extractedData.accountNo || Date.now()}`;

      const response = await fetch('/api/automation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: extractedData.firstName || '',
          last_name: extractedData.lastName || '',
          dob: extractedData.dateOfBirth || '',
          chain_to_run: selectedChain,
          source_id: sourceId,
          first_step_user_input: "",
          human_readable_record: `Patient info extracted from medical system screenshot`,
          starting_variables: {
            patient_data_full: extractedData,
            account_number: extractedData.accountNo,
            patient_email: extractedData.email,
            patient_phone: extractedData.cellPhone || extractedData.homePhone,
            patient_address: `${extractedData.street}, ${extractedData.city}, ${extractedData.state} ${extractedData.zip}`,
            primary_care_provider: extractedData.primaryCareProvider,
            insurance_plan: extractedData.insurancePlanName,
            subscriber_number: extractedData.subscriberNo
          }
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Success",
          description: `Patient data submitted to ${selectedChain}`,
        });
        
        // Clear form
        setExtractedData(null);
        setImagePreview(null);
      } else {
        throw new Error(data.error || 'Failed to trigger automation');
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit patient data",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <User className="h-6 w-6" />
            Patient Information Extraction
          </CardTitle>
          <CardDescription>
            Upload a screenshot from a medical system to extract patient demographics and information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Section */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              id="patient-info-upload"
              disabled={isProcessing}
            />
            <label
              htmlFor="patient-info-upload"
              className="cursor-pointer"
            >
              {imagePreview ? (
                <div className="space-y-4">
                  <img
                    src={imagePreview}
                    alt="Patient info screenshot"
                    className="max-w-full h-auto max-h-96 mx-auto rounded-lg shadow-lg"
                  />
                  <Button disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Different Image
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <FileImage className="h-12 w-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-lg font-medium">Upload patient information screenshot</p>
                    <p className="text-sm text-gray-500 mt-1">Click to browse or drag and drop</p>
                  </div>
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Select Image
                  </Button>
                </div>
              )}
            </label>
          </div>

          {/* Extracted Data Display */}
          {extractedData && (
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={downloadJSON}>
                  <Download className="h-4 w-4 mr-2" />
                  Download JSON
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => copyToClipboard(JSON.stringify(extractedData, null, 2))}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </Button>
              </div>

              {/* Data Tabs */}
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="demographics">Demographics</TabsTrigger>
                  <TabsTrigger value="contact">Contact</TabsTrigger>
                  <TabsTrigger value="insurance">Insurance</TabsTrigger>
                  <TabsTrigger value="raw">Raw Data</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Patient Identity */}
                        <div className="space-y-4">
                          <h3 className="font-semibold flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Patient Identity
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Account #:</span>
                              <span className="font-medium">{extractedData.accountNo || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Name:</span>
                              <span className="font-medium">
                                {extractedData.firstName} {extractedData.lastName}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">DOB:</span>
                              <span className="font-medium">{extractedData.dateOfBirth || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Age:</span>
                              <span className="font-medium">{extractedData.age || 'N/A'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Key Information */}
                        <div className="space-y-4">
                          <h3 className="font-semibold flex items-center gap-2">
                            <Stethoscope className="h-4 w-4" />
                            Medical Information
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Sex:</span>
                              <span className="font-medium">{extractedData.sex || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">PCP:</span>
                              <span className="font-medium">{extractedData.primaryCareProvider || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Language:</span>
                              <span className="font-medium">{extractedData.language || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Status:</span>
                              <span className="font-medium">{extractedData.maritalStatus || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Confidence Score */}
                  {extractedData.confidence && (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm text-gray-500">Extraction Confidence:</span>
                      <Badge variant={extractedData.confidence > 0.8 ? "default" : "secondary"}>
                        {Math.round(extractedData.confidence * 100)}%
                      </Badge>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="demographics" className="space-y-4">
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">First Name:</span>
                          <p className="font-medium">{extractedData.firstName || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Last Name:</span>
                          <p className="font-medium">{extractedData.lastName || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Date of Birth:</span>
                          <p className="font-medium">{extractedData.dateOfBirth || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Age:</span>
                          <p className="font-medium">{extractedData.age || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Sex:</span>
                          <p className="font-medium">{extractedData.sex || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Marital Status:</span>
                          <p className="font-medium">{extractedData.maritalStatus || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Language:</span>
                          <p className="font-medium">{extractedData.language || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Race:</span>
                          <p className="font-medium">{extractedData.race || 'N/A'}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Ethnicity:</span>
                          <p className="font-medium">{extractedData.ethnicity || 'N/A'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="contact" className="space-y-4">
                  <Card>
                    <CardContent className="pt-6 space-y-6">
                      {/* Address */}
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Home className="h-4 w-4" />
                          Address
                        </h4>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">{extractedData.street || 'N/A'}</p>
                          <p className="font-medium">
                            {extractedData.city}, {extractedData.state} {extractedData.zip}
                          </p>
                          <p className="font-medium">{extractedData.country || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Phone Numbers */}
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone Numbers
                        </h4>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Home:</span>
                            <span className="font-medium">{extractedData.homePhone || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Cell:</span>
                            <span className="font-medium">{extractedData.cellPhone || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </h4>
                        <p className="text-sm font-medium">{extractedData.email || 'N/A'}</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="insurance" className="space-y-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Insurance Information
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Plan Name:</span>
                            <span className="font-medium">{extractedData.insurancePlanName || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Subscriber #:</span>
                            <span className="font-medium">{extractedData.subscriberNo || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Relationship:</span>
                            <span className="font-medium">{extractedData.relationship || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="raw" className="space-y-4">
                  <Card>
                    <CardContent className="pt-6">
                      <pre className="text-xs overflow-auto p-4 bg-gray-50 rounded">
                        {JSON.stringify(extractedData, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Submit to Chain */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Submit to Chain</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedChain} onValueChange={setSelectedChain}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHAIN_OPTIONS.map((chain: string) => (
                        <SelectItem key={chain} value={chain}>
                          {chain}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    onClick={submitToAutomation} 
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Submitting..." : "Submit Patient Data"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}