import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUp, Check, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CreatePatientFromUploadProps {
  onPatientCreated?: (patient: any) => void;
}

export function CreatePatientFromUpload({ onPatientCreated }: CreatePatientFromUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createPatientMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      
      const response = await fetch('/api/patients/create-from-upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create patient');
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Patient Created Successfully',
        description: data.message,
      });
      
      // Invalidate patients query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      
      // Reset form
      setSelectedFile(null);
      
      // Call the callback if provided
      onPatientCreated?.(data.patient);
    },
    onError: (error: any) => {
      toast({
        title: 'Error Creating Patient',
        description: error.message || 'Failed to create patient from uploaded file',
        variant: 'destructive',
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      createPatientMutation.mutate(selectedFile);
    }
  };

  const isValidFileType = (file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    
    // Check MIME type first, then fall back to file extension
    const isValidByMimeType = validTypes.includes(file.type);
    const isValidByExtension = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'].includes(fileExtension || '');
    
    console.log('File validation:', {
      name: file.name,
      type: file.type,
      extension: fileExtension,
      isValidByMimeType,
      isValidByExtension,
      finalResult: isValidByMimeType || isValidByExtension
    });
    
    return isValidByMimeType || isValidByExtension;
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5" />
          Create Patient from Document
        </CardTitle>
        <CardDescription>
          Upload a LEQVIO form (PDF) or medical system screenshot to automatically create a patient record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Upload Document</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <Label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <FileUp className="h-8 w-8 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
                </span>
                <span className="text-xs text-gray-500">
                  PDF, PNG, JPG, GIF, or WEBP files
                </span>
              </Label>
            </div>
          </div>

          {selectedFile && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                File selected: {selectedFile.name}
                {!isValidFileType(selectedFile) && (
                  <span className="text-red-600 block">
                    Warning: Unsupported file type
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={!selectedFile || !isValidFileType(selectedFile!) || createPatientMutation.isPending}
          >
            {createPatientMutation.isPending ? 'Creating Patient...' : 'Create Patient'}
          </Button>
        </form>

        {createPatientMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {(createPatientMutation.error as any)?.message || 'Failed to create patient from uploaded file'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}