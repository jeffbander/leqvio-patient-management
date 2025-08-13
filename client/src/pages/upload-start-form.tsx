import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Upload, FileText, Type, Image, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import { DragDropFileUpload } from '@/components/DragDropFileUpload'
import { useLocation } from 'wouter'

export default function UploadStartForm() {
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()
  
  // State management
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [createdPatient, setCreatedPatient] = useState<any>(null)
  const [textContent, setTextContent] = useState('')
  const [activeTab, setActiveTab] = useState('files')

  // File upload mutation
  const fileUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('photo', file)
      
      const response = await fetch('/api/patients/create-from-upload', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create patient from file')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        setCreatedPatient(data.patient)
        setUploadStatus('success')
        toast({
          title: "Patient Created Successfully",
          description: `Created patient: ${data.patient.firstName} ${data.patient.lastName}`
        })
        queryClient.invalidateQueries({ queryKey: ['/api/patients'] })
      }
    },
    onError: (error) => {
      setUploadStatus('error')
      toast({
        title: "Upload Failed",
        description: (error as Error).message,
        variant: "destructive"
      })
    }
  })

  // Text upload mutation
  const textUploadMutation = useMutation({
    mutationFn: async (textContent: string) => {
      const response = await fetch('/api/patients/create-from-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ textContent })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create patient from text')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        setCreatedPatient(data.patient)
        setUploadStatus('success')
        toast({
          title: "Patient Created Successfully",
          description: `Created patient: ${data.patient.firstName} ${data.patient.lastName}`
        })
        queryClient.invalidateQueries({ queryKey: ['/api/patients'] })
      }
    },
    onError: (error) => {
      setUploadStatus('error')
      toast({
        title: "Text Processing Failed",
        description: (error as Error).message,
        variant: "destructive"
      })
    }
  })

  // Handler functions
  const handleFileUpload = (file: File) => {
    setUploadStatus('uploading')
    fileUploadMutation.mutate(file)
  }

  const handleTextSubmit = () => {
    if (!textContent.trim() || textContent.trim().length < 10) {
      toast({
        title: "Invalid Text",
        description: "Please enter at least 10 characters of medical text",
        variant: "destructive"
      })
      return
    }
    
    setUploadStatus('uploading')
    textUploadMutation.mutate(textContent)
  }

  const handleTextPaste = (pastedText: string) => {
    setTextContent(pastedText)
    setActiveTab('text')
    setUploadStatus('uploading')
    textUploadMutation.mutate(pastedText)
  }

  const resetForm = () => {
    setUploadStatus('idle')
    setCreatedPatient(null)
    setTextContent('')
  }

  const goToPatientDetail = () => {
    if (createdPatient) {
      setLocation(`/patient/${createdPatient.id}`)
    }
  }

  // Loading state
  if (uploadStatus === 'uploading') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-16 w-16 animate-spin text-blue-600 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Processing Content...</h2>
              <p className="text-gray-600 text-center">
                Extracting patient information using AI and creating patient record
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Success state
  if (uploadStatus === 'success' && createdPatient) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-green-800 mb-2">
                  Patient Created Successfully!
                </h2>
                <p className="text-green-700 mb-6">
                  Patient record created for: <strong>{createdPatient.firstName} {createdPatient.lastName}</strong>
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={goToPatientDetail} className="flex items-center gap-2">
                    View Patient Details
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    Create Another Patient
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Error state
  if (uploadStatus === 'error') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-red-800 mb-2">
                  Processing Failed
                </h2>
                <p className="text-red-700 mb-6">
                  We couldn't create the patient record. Please try again or contact support.
                </p>
                
                <Button onClick={resetForm} variant="outline">
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Main form
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create New Patient
          </h1>
          <p className="text-lg text-gray-600">
            Upload documents, images, or paste text to automatically extract patient information
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="files" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Files & Images
                </TabsTrigger>
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Text Content
                </TabsTrigger>
              </TabsList>

              {/* File Upload Tab */}
              <TabsContent value="files" className="space-y-6">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-medium mb-2">Upload Documents or Images</h3>
                  <p className="text-sm text-gray-600">
                    Drag and drop files or click to select. You can also paste images with Ctrl+V.
                  </p>
                </div>

                <DragDropFileUpload
                  onFileSelect={handleFileUpload}
                  onTextPaste={handleTextPaste}
                  accept=".pdf,image/*"
                  maxSizeMB={50}
                  placeholder="Drag and drop your document here, or click to select"
                  className="min-h-[200px]"
                  enablePaste={true}
                  enableTextPaste={true}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-900">PDF Documents</p>
                      <p className="text-xs text-blue-700">LEQVIO forms, medical records</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Image className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">Screenshots</p>
                      <p className="text-xs text-green-700">Epic, insurance cards</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <Type className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="font-medium text-purple-900">Paste Content</p>
                      <p className="text-xs text-purple-700">Ctrl+V to paste images or text</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Text Content Tab */}
              <TabsContent value="text" className="space-y-6">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-medium mb-2">Paste Medical Text</h3>
                  <p className="text-sm text-gray-600">
                    Copy and paste text from Epic, insurance portals, or other medical systems.
                  </p>
                </div>

                <div className="space-y-4">
                  <Textarea
                    placeholder="Paste your medical text content here... (e.g., Epic patient summary, insurance information, clinical notes)"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="min-h-[200px] resize-none"
                  />
                  
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500">
                      {textContent.length} characters {textContent.length < 10 && '(minimum 10 required)'}
                    </p>
                    <Button 
                      onClick={handleTextSubmit} 
                      disabled={textContent.trim().length < 10}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Process Text
                    </Button>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Type className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800 mb-1">Text Processing Examples</h4>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• Epic patient demographics and insurance information</li>
                        <li>• Insurance portal member details and coverage info</li>
                        <li>• Clinical notes with patient identifiers</li>
                        <li>• Provider referral information</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Patient information will be extracted automatically using AI. Review and edit details after creation.
          </p>
        </div>
      </div>
    </div>
  )
}