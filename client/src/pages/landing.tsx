import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, Activity, BarChart3, Shield } from "lucide-react";
import providerloopLogo from "@assets/image_1750647678847.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img src={providerloopLogo} alt="Providerloop" className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Providerloop Chains</h1>
                <p className="text-sm text-gray-600">Patient Data Chain Processing</p>
              </div>
            </div>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="flex items-center space-x-2"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Streamline Your Medical Data Workflow
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Automated patient data processing through chain automations. Generate source IDs, 
            track results, and monitor webhook communications in real-time.
          </p>
          <Button 
            size="lg"
            onClick={() => window.location.href = '/api/login'}
            className="text-lg px-8 py-4"
          >
            <LogIn className="h-5 w-5 mr-2" />
            Get Started
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="border-0 shadow-lg bg-white/60 backdrop-blur-sm">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl">Automated Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Auto-generate Source IDs from patient information and trigger automation chains 
                with customizable variables and processing steps.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/60 backdrop-blur-sm">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-xl">Real-time Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Monitor automation results through real-time webhook communication with 
                comprehensive logging and filtering capabilities.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/60 backdrop-blur-sm">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle className="text-xl">Secure Access</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Protected patient data processing with secure authentication and 
                role-based access to automation chains and logs.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Card className="border-0 shadow-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white max-w-2xl mx-auto">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
              <p className="text-blue-100 mb-6">
                Sign in to access your patient data processing dashboard and start 
                automating your medical workflow processes.
              </p>
              <Button 
                size="lg"
                variant="secondary"
                onClick={() => window.location.href = '/api/login'}
                className="text-blue-600 hover:text-blue-700"
              >
                <LogIn className="h-5 w-5 mr-2" />
                Sign In Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}