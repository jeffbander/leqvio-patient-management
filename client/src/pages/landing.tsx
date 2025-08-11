import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Providerloop Chains</CardTitle>
          <CardDescription className="text-base">
            Advanced patient management system with intelligent automation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600 space-y-2">
            <p>• Complete patient intake and tracking</p>
            <p>• Multi-organization support</p>
            <p>• LEQVIO copay program integration</p>
            <p>• Automated workflow processing</p>
          </div>
          <Button 
            className="w-full" 
            onClick={() => window.location.href = '/api/login'}
          >
            Sign In to Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}