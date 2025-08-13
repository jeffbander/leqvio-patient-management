import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Upload, FileText, Camera, Image, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { DragDropFileUpload } from '@/components/DragDropFileUpload'
import { useLocation } from 'wouter'

export default function UploadStartForm() {
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [createdPatient, setCreatedPatient] = useState<any>(null)

  // Direct patient creation from upload
  const createPatientMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('photo', file)
      
      const response = await fetch('/api/patients/create-from-upload', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create patient')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        setCreatedPatient(data.patient)
        setUploadStatus('success')
        toast({
          title: "Patient Created Successfully",
          description: data.message
        })
        // Refresh patient list
        queryClient.invalidateQueries({ queryKey: ['/api/patients'] })
      } else {
        throw new Error(data.error || 'Failed to create patient')
      }
    },
    onError: (error) => {
      setUploadStatus('error')
      toast({
        title: "Error Creating Patient",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const handleFileUpload = (file: File) => {
    setUploadStatus('uploading')
    createPatientMutation.mutate(file)
  }

  const resetForm = () => {
    setUploadStatus('idle')
    setCreatedPatient(null)
  }

  const goToPatientDetail = () => {
    if (createdPatient?.id) {
      setLocation(`/patient/${createdPatient.id}`)
    }
  }

  if (uploadStatus === 'success') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-800">Patient Created Successfully!</CardTitle>
            <CardDescription className="text-green-600">
              {createdPatient?.firstName} {createdPatient?.lastName} has been added to your patient database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Patient ID: <span className="font-mono font-semibold">{createdPatient?.sourceId}</span>
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={goToPatientDetail} className="flex-1 max-w-sm">
                View Patient Details
              </Button>
              <Button variant="outline" onClick={resetForm} className="flex-1 max-w-sm">
                Upload Another Document
              </Button>
              <Button variant="outline" onClick={() => setLocation('/patients')} className="flex-1 max-w-sm">
                Back to Patient List
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Start Form</h1>
        <p className="text-gray-600">
          Upload medical documents to automatically create patient records
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Upload Card */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Document Upload
              </CardTitle>
              <CardDescription>
                Upload LEQVIO forms, Epic screenshots, or other medical documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {uploadStatus === 'uploading' ? (
                <div className="text-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
                  <h3 className="text-lg font-medium mb-2">Processing Document...</h3>
                  <p className="text-gray-600">Extracting patient information and creating record</p>
                </div>
              ) : uploadStatus === 'error' ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
                  <h3 className="text-lg font-medium mb-2 text-red-800">Upload Failed</h3>
                  <p className="text-gray-600 mb-4">Please try again with a different document</p>
                  <Button onClick={resetForm} variant="outline">
                    Try Again
                  </Button>
                </div>
              ) : (
                <DragDropFileUpload
                  onFileSelect={handleFileUpload}
                  accept=".pdf,image/*"
                  maxSizeMB={50}
                  placeholder="Drag and drop your document here, or click to select"
                  className="min-h-[200px]"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Information Sidebar */}
        <div className="space-y-6">
          {/* Supported File Types */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-4 w-4" />
                Supported Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium">PDF Documents</p>
                  <p className="text-sm text-gray-600">LEQVIO enrollment forms</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Camera className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium">Epic Screenshots</p>
                  <p className="text-sm text-gray-600">Patient database extracts</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Image className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Medical Images</p>
                  <p className="text-sm text-gray-600">PNG, JPG, GIF, WEBP</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full min-w-[20px] text-center">1</span>
                  <span>Upload your medical document</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full min-w-[20px] text-center">2</span>
                  <span>AI extracts patient information</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full min-w-[20px] text-center">3</span>
                  <span>Patient record created automatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full min-w-[20px] text-center">4</span>
                  <span>Review and edit patient details</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => setLocation('/patient/new')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Manual Patient Entry
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => setLocation('/patients')}
              >
                <Upload className="h-4 w-4 mr-2" />
                View All Patients
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}