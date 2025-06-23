import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ExternalLink } from "lucide-react";
import providerloopLogo from "@assets/image_1750647678847.png";

export default function AuthFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3">
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <img src={providerloopLogo} alt="Providerloop" className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Providerloop Chains</h1>
              <p className="text-sm text-gray-600">Patient Data Chain Processing</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <Card className="border-0 shadow-xl bg-white max-w-2xl mx-auto">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              </div>
              <CardTitle className="text-2xl">Authentication Required</CardTitle>
              <CardDescription className="text-lg">
                This application requires Replit authentication to access patient data processing features.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-left space-y-4">
                <h3 className="font-semibold text-gray-900">Available Options:</h3>
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">Option 1: Access via Replit</h4>
                    <p className="text-sm text-blue-800 mb-3">
                      Deploy this application on Replit to enable secure authentication and access all features.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open('https://replit.com', '_blank')}
                      className="text-blue-600 border-blue-300 hover:bg-blue-100"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit Replit
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-2">Option 2: Contact Administrator</h4>
                    <p className="text-sm text-gray-700">
                      Contact your system administrator to configure alternative authentication methods 
                      or request access to the Replit deployment.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  This application uses Replit's secure authentication system to protect patient data 
                  and ensure HIPAA compliance in medical workflow processing.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}