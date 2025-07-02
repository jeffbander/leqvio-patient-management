import React, { useState, useCallback } from "react";
import { Upload, Camera, FileImage, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface ExtractedPatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  confidence: number;
  rawText?: string;
}

interface PhotoUploadProps {
  onDataExtracted: (data: ExtractedPatientData) => void;
  isDisabled?: boolean;
}

export default function PhotoUpload({ onDataExtracted, isDisabled = false }: PhotoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastExtractedData, setLastExtractedData] = useState<ExtractedPatientData | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
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
      }, 200);

      // Upload and extract data
      const formData = new FormData();
      formData.append('photo', file);

      const response = await fetch('/api/extract-patient-data', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract patient data');
      }

      const extractedData: ExtractedPatientData = await response.json();
      setLastExtractedData(extractedData);
      onDataExtracted(extractedData);

      toast({
        title: "Data Extracted Successfully",
        description: `Found patient: ${extractedData.firstName} ${extractedData.lastName} (${Math.round(extractedData.confidence * 100)}% confidence)`,
        variant: "default",
      });

    } catch (error) {
      console.error('Photo extraction error:', error);
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : "Failed to extract patient data from photo",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [onDataExtracted, toast]);

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

  const confidenceColor = lastExtractedData?.confidence 
    ? lastExtractedData.confidence >= 0.8 ? "text-green-600" 
    : lastExtractedData.confidence >= 0.6 ? "text-yellow-600" 
    : "text-red-600"
    : "";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Photo Text Extraction
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
              document.getElementById('photo-upload')?.click();
            }
          }}
        >
          <input
            id="photo-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isDisabled || isProcessing}
          />
          
          {isProcessing ? (
            <div className="space-y-3">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-blue-500" />
              <p className="text-sm text-gray-600">Extracting patient data...</p>
              {uploadProgress > 0 && (
                <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <FileImage className="h-8 w-8 mx-auto text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Upload a photo to extract patient data
                </p>
                <p className="text-xs text-gray-500">
                  Drag and drop or click to select an image (JPG, PNG, max 10MB)
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Works with driver's licenses, insurance cards, medical records
                </p>
              </div>
              <Button variant="outline" size="sm" disabled={isDisabled}>
                <Upload className="h-4 w-4 mr-2" />
                Select Photo
              </Button>
            </div>
          )}
        </div>

        {/* Preview and Results */}
        {(previewImage || lastExtractedData) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Image Preview */}
            {previewImage && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Uploaded Image</h4>
                <div className="border rounded-lg p-2 bg-gray-50">
                  <img 
                    src={previewImage} 
                    alt="Uploaded document" 
                    className="max-w-full h-32 object-contain mx-auto"
                  />
                </div>
              </div>
            )}

            {/* Extraction Results */}
            {lastExtractedData && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Extracted Data</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {lastExtractedData.confidence >= 0.8 ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className={`text-sm font-medium ${confidenceColor}`}>
                      {Math.round(lastExtractedData.confidence * 100)}% Confidence
                    </span>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <div><strong>Name:</strong> {lastExtractedData.firstName} {lastExtractedData.lastName}</div>
                    <div><strong>DOB:</strong> {lastExtractedData.dateOfBirth}</div>
                  </div>

                  {lastExtractedData.confidence < 0.8 && (
                    <Alert className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Low confidence detected. Please verify the extracted data is correct.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
          <strong>Tips for best results:</strong>
          <ul className="mt-1 list-disc list-inside space-y-1">
            <li>Ensure the document is well-lit and in focus</li>
            <li>Include the full document in the photo</li>
            <li>Avoid shadows or glare on the text areas</li>
            <li>Supported documents: driver's licenses, insurance cards, medical records</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}