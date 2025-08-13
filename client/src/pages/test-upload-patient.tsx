import { CreatePatientFromUpload } from '@/components/CreatePatientFromUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function TestUploadPatient() {
  const handlePatientCreated = (patient: any) => {
    console.log('Patient created:', patient);
    // You could redirect to the patient detail page or show a success message
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/patients">
            <ArrowLeft className="h-5 w-5 cursor-pointer hover:text-blue-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Test Document Upload Patient Creation
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Upload a LEQVIO form or medical document to automatically create a patient record
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <CreatePatientFromUpload onPatientCreated={handlePatientCreated} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
              <CardDescription>
                This feature replaces the automation chain workflow with direct patient creation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Supported File Types:</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                  <li><strong>PDF Files:</strong> LEQVIO enrollment forms</li>
                  <li><strong>Images:</strong> Medical system screenshots (PNG, JPG, GIF, WEBP)</li>
                  <li><strong>Epic Screenshots:</strong> Patient database extracts</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">What Happens:</h3>
                <ol className="text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1">
                  <li>Upload your document</li>
                  <li>AI extracts patient information</li>
                  <li>Patient record is created immediately</li>
                  <li>No automation chains are triggered</li>
                  <li>Patient appears in your patient list</li>
                </ol>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Default Values:</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                  <li>Status: "Pending Auth"</li>
                  <li>Campus: "Mount Sinai West"</li>
                  <li>Notes: Auto-generated with creation date</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}