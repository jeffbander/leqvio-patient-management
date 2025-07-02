import React, { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import InsuranceCardExtractor from "@/components/InsuranceCardExtractor";
import { ArrowLeft, CreditCard, Download, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import providerloopLogo from "@assets/image_1750647678847.png";

export default function InsuranceExtractionPage() {
  const [extractedData, setExtractedData] = useState<any>(null);
  const { toast } = useToast();

  const handleDataExtracted = (data: any) => {
    setExtractedData(data);
  };

  const exportToJSON = () => {
    if (!extractedData) return;
    
    const dataStr = JSON.stringify(extractedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `insurance-card-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Data Exported",
      description: "Insurance card data has been downloaded as JSON file",
      variant: "default",
    });
  };

  const copyToClipboard = () => {
    if (!extractedData) return;
    
    navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2));
    toast({
      title: "Data Copied",
      description: "Insurance card data has been copied to clipboard",
      variant: "default",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img src={providerloopLogo} alt="Providerloop" className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Insurance Card Extraction</h1>
                <p className="text-sm text-gray-600">Comprehensive insurance card data extraction and analysis</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {extractedData && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    className="flex items-center space-x-2"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copy JSON</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToJSON}
                    className="flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export JSON</span>
                  </Button>
                </>
              )}
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Main
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Description Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Comprehensive Insurance Card Data Extraction
              </CardTitle>
              <CardDescription>
                Upload insurance card images (front or back) to extract all available information including 
                member details, pharmacy routing, cost-sharing, and contact information for eligibility verification and billing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <h4 className="font-medium text-gray-900">Member Information</h4>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Member ID & Name</li>
                    <li>• Date of Birth</li>
                    <li>• Dependent Details</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-gray-900">Insurance Details</h4>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Payer Name & ID</li>
                    <li>• Plan Type & Name</li>
                    <li>• Group Number</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-gray-900">Pharmacy Routing</h4>
                  <ul className="text-gray-600 space-y-1">
                    <li>• BIN & PCN Numbers</li>
                    <li>• Rx Group & ID</li>
                    <li>• Pharmacy Phone</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-gray-900">Cost Details</h4>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Copay Amounts</li>
                    <li>• Deductible Info</li>
                    <li>• Contact Numbers</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insurance Card Extractor */}
          <InsuranceCardExtractor onDataExtracted={handleDataExtracted} />

          {/* Summary Stats */}
          {extractedData && (
            <Card>
              <CardHeader>
                <CardTitle>Extraction Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-blue-600">
                      {Math.round(extractedData.metadata.ocr_confidence.overall * 100)}%
                    </p>
                    <p className="text-sm text-gray-600">Overall Confidence</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-green-600">
                      {extractedData.metadata.image_side.charAt(0).toUpperCase() + extractedData.metadata.image_side.slice(1)}
                    </p>
                    <p className="text-sm text-gray-600">Card Side</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-purple-600">
                      {Object.values(extractedData).reduce((count: number, section: any) => {
                        if (typeof section === 'object' && section !== null) {
                          return count + Object.values(section).filter((val: any) => 
                            typeof val === 'string' && val.trim() !== ''
                          ).length;
                        }
                        return count;
                      }, 0)}
                    </p>
                    <p className="text-sm text-gray-600">Fields Extracted</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-orange-600">
                      {extractedData.metadata.raw_text.split(/\s+/).length}
                    </p>
                    <p className="text-sm text-gray-600">Words Processed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}