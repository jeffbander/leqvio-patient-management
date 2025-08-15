import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Upload, FileText, Type, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { useLocation } from 'wouter'

export default function UploadStartForm() {
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()
  
  // State management
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file')
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [createdPatient, setCreatedPatient] = useState<any>(null)
  const [textContent, setTextContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // File upload mutation
  const createPatientFromFileMutation = useMutation({
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
          description: data.message
        })
        queryClient.invalidateQueries({ queryKey: ['/api/patients'] })
      }
    },
    onError: (error) => {
      setUploadStatus('error')
      toast({
        title: "Error Creating Patient from File",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  // Text upload mutation
  const createPatientFromTextMutation = useMutation({
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
          description: data.message
        })
        queryClient.invalidateQueries({ queryKey: ['/api/patients'] })
      }
    },
    onError: (error) => {
      setUploadStatus('error')
      toast({
        title: "Error Creating Patient from Text",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    console.log('File selected:', { name: file?.name, type: file?.type, size: file?.size })
    if (file && validateFile(file)) {
      setSelectedFile(file)
    }
  }

  const validateFile = (file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf']
    const maxSize = 50 * 1024 * 1024 // 50MB
    const fileExtension = file.name.toLowerCase().split('.').pop()
    
    console.log('Validating file:', { 
      name: file.name, 
      type: file.type, 
      extension: fileExtension,
      allowedTypes,
      isTypeValid: allowedTypes.includes(file.type),
      isPDFByExtension: fileExtension === 'pdf'
    })
    
    // Check MIME type first, then fall back to file extension for PDFs
    const isValidType = allowedTypes.includes(file.type) || (fileExtension === 'pdf')
    
    if (!isValidType) {
      toast({
        title: "Invalid File Type",
        description: "Please select a PDF document or image file (PNG, JPG, GIF, WEBP)",
        variant: "destructive"
      })
      return false
    }
    
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "Please select a file smaller than 50MB",
        variant: "destructive"
      })
      return false
    }
    
    return true
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const file = files[0]
    
    console.log('File dropped:', { name: file?.name, type: file?.type, size: file?.size })
    
    if (file && validateFile(file)) {
      setSelectedFile(file)
    }
  }

  const handleFileUpload = () => {
    if (selectedFile) {
      setUploadStatus('uploading')
      createPatientFromFileMutation.mutate(selectedFile)
    }
  }

  const handleTextUpload = () => {
    if (textContent.trim().length >= 10) {
      setUploadStatus('uploading')
      createPatientFromTextMutation.mutate(textContent.trim())
    } else {
      toast({
        title: "Text Too Short",
        description: "Please enter at least 10 characters of medical text",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setUploadStatus('idle')
    setCreatedPatient(null)
    setSelectedFile(null)
    setTextContent('')
    setIsDragOver(false)
  }

  const goToPatientDetail = () => {
    if (createdPatient) {
      setLocation(`/patient/${createdPatient.id}`)
    }
  }

  if (uploadStatus === 'uploading') {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-12">
              <div className="text-center">
                <Loader2 className="h-16 w-16 animate-spin mx-auto mb-6 text-blue-600" />
                <h2 className="text-2xl font-semibold mb-4">Processing...</h2>
                <p className="text-gray-600">
                  {activeTab === 'file' ? 'Extracting patient information from file' : 'Extracting patient information from text'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (uploadStatus === 'success' && createdPatient) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border-green-200">
            <CardContent className="p-8">
              <div className="text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-6" />
                <h2 className="text-2xl font-semibold text-green-800 mb-4">Patient Created Successfully!</h2>
                <div className="bg-green-50 p-4 rounded-lg mb-6">
                  <p className="text-lg font-medium text-green-800">
                    {createdPatient.firstName} {createdPatient.lastName}
                  </p>
                  <p className="text-green-600">DOB: {createdPatient.dateOfBirth}</p>
                  <p className="text-green-600">Status: {createdPatient.status}</p>
                </div>
                <div className="flex gap-4 justify-center">
                  <Button onClick={goToPatientDetail} className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    View Patient Details
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

  if (uploadStatus === 'error') {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border-red-200">
            <CardContent className="p-8">
              <div className="text-center">
                <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-6" />
                <h2 className="text-2xl font-semibold text-red-800 mb-4">Error Creating Patient</h2>
                <p className="text-red-600 mb-6">
                  There was an issue processing your {activeTab === 'file' ? 'file' : 'text'}. Please try again.
                </p>
                <Button onClick={resetForm}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Patient Record</h1>
          <p className="text-gray-600">Upload documents or paste text to automatically extract patient information</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('file')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'file'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              File Upload
            </div>
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'text'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Text Input
            </div>
          </button>
        </div>

        {/* File Upload Tab */}
        {activeTab === 'file' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Medical Document
              </CardTitle>
              <CardDescription>
                Select a medical document, screenshot, or PDF containing patient information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div 
                className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
                  isDragOver 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="text-center">
                  <Upload className={`mx-auto h-12 w-12 mb-4 ${
                    isDragOver ? 'text-blue-500' : 'text-gray-400'
                  }`} />
                  <div className="mb-4">
                    {isDragOver ? (
                      <p className="text-blue-600 font-medium">Drop your image here</p>
                    ) : (
                      <>
                        <p className="text-gray-600 mb-2">Drag and drop your image here, or</p>
                        <label
                          htmlFor="file-upload"
                          className="cursor-pointer text-blue-600 hover:text-blue-500 font-medium"
                        >
                          click to select file
                        </label>
                      </>
                    )}
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept="*/*"
                      onChange={handleFileSelect}
                    />
                  </div>
                  <p className="text-gray-500 text-sm">
                    Supports PDF documents, PNG, JPG, GIF, WEBP images up to 50MB
                  </p>
                </div>
              </div>

              {selectedFile && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-gray-600" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button 
                  onClick={handleFileUpload} 
                  disabled={!selectedFile}
                  className="min-w-[120px]"
                >
                  Create Patient
                </Button>
              </div>

              {/* Supported File Types */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <Upload className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Screenshots</p>
                    <p className="text-sm text-gray-600">Epic, medical database extracts</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Medical Images</p>
                    <p className="text-sm text-gray-600">Insurance cards, documents</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Text Input Tab */}
        {activeTab === 'text' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Paste Medical Text
              </CardTitle>
              <CardDescription>
                Copy and paste text from Epic, insurance information, or other medical records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Textarea
                  placeholder="Paste medical text here (Epic system text, patient information, insurance details, etc.)..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="min-h-[200px] text-sm"
                />
                <p className="text-sm text-gray-500 mt-2">
                  {textContent.length} characters (minimum 10 required)
                </p>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleTextUpload} 
                  disabled={textContent.trim().length < 10}
                  className="min-w-[120px]"
                >
                  Create Patient
                </Button>
              </div>

              {/* Text Examples */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <Type className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">Epic System Text</p>
                    <p className="text-sm text-gray-600">Patient demographics, appointments</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium">Insurance Information</p>
                    <p className="text-sm text-gray-600">Member IDs, group numbers, plans</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}