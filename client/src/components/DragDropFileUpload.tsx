import React, { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import { Upload, File, X, Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DragDropFileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  children?: React.ReactNode;
  multiple?: boolean;
  onMultipleFiles?: (files: File[]) => void;
  enablePaste?: boolean;
  enableTextPaste?: boolean;
  onTextPaste?: (text: string) => void;
}

export function DragDropFileUpload({
  onFileSelect,
  accept = "image/*",
  maxSizeMB = 10,
  disabled = false,
  placeholder = "Drag and drop files here, or click to select",
  className,
  children,
  multiple = false,
  onMultipleFiles,
  enablePaste = true,
  enableTextPaste = false,
  onTextPaste
}: DragDropFileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showPasteHint, setShowPasteHint] = useState(false);
  const [pastedText, setPastedText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const validateFile = (file: File): string | null => {
    if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
      return `File size must be less than ${maxSizeMB}MB`;
    }
    
    if (accept && accept !== "*/*") {
      const acceptTypes = accept.split(',').map(type => type.trim());
      const fileType = file.type;
      const fileName = file.name.toLowerCase();
      
      const isAccepted = acceptTypes.some(acceptType => {
        if (acceptType.startsWith('.')) {
          return fileName.endsWith(acceptType.toLowerCase());
        }
        if (acceptType.includes('*')) {
          const baseType = acceptType.split('/')[0];
          return fileType.startsWith(baseType);
        }
        return fileType === acceptType;
      });
      
      if (!isAccepted) {
        return `File type not accepted. Accepted types: ${accept}`;
      }
    }
    
    return null;
  };

  // Handle paste events
  useEffect(() => {
    if (!enablePaste && !enableTextPaste) return;

    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste if the container is focused or visible
      if (!containerRef.current || disabled) return;

      const items = e.clipboardData?.items;
      const textData = e.clipboardData?.getData('text/plain');

      if (!items && !textData) return;

      // Handle text paste first if enabled
      if (enableTextPaste && textData && textData.trim().length > 10) {
        e.preventDefault();
        setPastedText(textData);
        onTextPaste?.(textData);
        setShowPasteHint(false);
        return;
      }

      // Handle image paste
      if (enablePaste && items) {
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              const error = validateFile(file);
              if (error) {
                alert(error);
                return;
              }
              // Create a new file with a proper name
              const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_');
              const extension = item.type.split('/')[1] || 'png';
              // Use the original file directly since it's already a File object
              const renamedFile = Object.defineProperty(file, 'name', {
                writable: true,
                value: `pasted_image_${timestamp}.${extension}`
              });
              onFileSelect(renamedFile);
              setShowPasteHint(false);
            }
            return;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [enablePaste, enableTextPaste, disabled, onFileSelect, onTextPaste, accept, maxSizeMB]);

  // Show paste hint when Ctrl+V is detected
  useEffect(() => {
    if (!enablePaste && !enableTextPaste) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !disabled) {
        setShowPasteHint(true);
        setTimeout(() => setShowPasteHint(false), 2000);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enablePaste, enableTextPaste, disabled]);

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        alert(error);
        continue;
      }
      validFiles.push(file);
    }
    
    if (validFiles.length === 0) return;
    
    if (multiple && onMultipleFiles) {
      setSelectedFiles(validFiles);
      onMultipleFiles(validFiles);
    } else {
      const file = validFiles[0];
      setSelectedFiles([file]);
      onFileSelect(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    
    if (multiple && onMultipleFiles) {
      onMultipleFiles(newFiles);
    } else if (newFiles.length === 0) {
      // Reset if no files left
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={cn("w-full", className)} ref={containerRef}>
      {/* Paste Hint */}
      {(enablePaste || enableTextPaste) && showPasteHint && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <div className="flex items-center justify-center gap-2 text-blue-700">
            <Clipboard className="h-4 w-4" />
            <span className="text-sm font-medium">
              Paste your {enableTextPaste && enablePaste ? 'content' : enableTextPaste ? 'text' : 'image'} here (Ctrl+V)
            </span>
          </div>
        </div>
      )}
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 relative",
          isDragOver && !disabled 
            ? "border-blue-500 bg-blue-50" 
            : "border-gray-300 hover:border-gray-400",
          disabled && "opacity-50 cursor-not-allowed bg-gray-50",
          selectedFiles.length > 0 && "border-green-500 bg-green-50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
        
        {children ? children : (
          <div className="space-y-2">
            <Upload className={cn(
              "h-8 w-8 mx-auto",
              isDragOver ? "text-blue-500" : "text-gray-400"
            )} />
            <p className={cn(
              "text-sm",
              isDragOver ? "text-blue-600" : "text-gray-600"
            )}>
              {isDragOver ? "Drop files here" : placeholder}
            </p>
            {(enablePaste || enableTextPaste) && !isDragOver && (
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <Clipboard className="h-3 w-3" />
                <span>or press Ctrl+V to paste {enableTextPaste && enablePaste ? 'content' : enableTextPaste ? 'text' : 'images'} from clipboard</span>
              </div>
            )}
            {!multiple && selectedFiles.length === 0 && (
              <p className="text-xs text-gray-500">
                Maximum file size: {maxSizeMB}MB
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Pasted Text Display */}
      {pastedText && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clipboard className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Pasted Text Content</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPastedText('')}
              className="h-6 w-6 p-0 hover:bg-red-100"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-xs text-gray-600 bg-white p-2 rounded border max-h-32 overflow-y-auto">
            {pastedText.substring(0, 500)}
            {pastedText.length > 500 && '...'}
          </div>
        </div>
      )}

      {/* Selected Files Display */}
      {selectedFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700 truncate">
                  {file.name}
                </span>
                <span className="text-xs text-gray-500">
                  ({(file.size / 1024 / 1024).toFixed(1)}MB)
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="h-6 w-6 p-0 hover:bg-red-100"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}