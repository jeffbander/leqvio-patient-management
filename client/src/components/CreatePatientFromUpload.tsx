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
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      console.log('Dropped file:', { name: file.name, type: file.type, size: file.size });
      setSelectedFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const file = files[0];
      console.log('Selected file:', { name: file.name, type: file.type, size: file.size });
      setSelectedFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      createPatientMutation.mutate(selectedFile);
    }
  };

  const isValidFileType = (file: File) => {
    // Accept all file types - let server handle validation
    return true;
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
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input
                id="file-upload"
                type="file"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept="*/*"
              />
              <FileUp className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
              </div>
              <div className="text-xs text-gray-500">
                PDF, PNG, JPG, GIF, WEBP, or any document file
              </div>
              {selectedFile && (
                <div className="text-xs text-blue-600 mt-2">
                  File: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>
          </div>

          {selectedFile && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                File selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={!selectedFile || createPatientMutation.isPending}
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