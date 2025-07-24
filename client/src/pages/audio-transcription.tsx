import React, { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, Send, User, AlertCircle, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import providerloopLogo from "/generated-icon.png";

interface TranscriptionSegment {
  text: string;
  timestamp: number;
  isFinal: boolean;
}

interface PatientInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sourceId: string;
}

export default function AudioTranscription() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionSegment[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [selectedChain, setSelectedChain] = useState("ATTACHMENT PROCESSING (LABS)");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const segmentChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSendingAudioRef = useRef(false);
  const isPausedRef = useRef(false);
  
  const { toast } = useToast();

  // Timer for recording duration
  useEffect(() => {
    if (isRecording && !isPaused) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
    
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording, isPaused]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Clear all intervals
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      segmentChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          segmentChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsPaused(false);
      isPausedRef.current = false;
      
      // Start periodic transcription
      transcriptionIntervalRef.current = setInterval(async () => {
        if (audioChunksRef.current.length > 0 && !isPausedRef.current && mediaRecorderRef.current?.state === 'recording') {
          await sendAudioForTranscription();
        }
      }, 5000); // Send audio every 5 seconds
      
      toast({
        title: "Recording Started",
        description: "Speak clearly - transcription will appear in real-time",
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const sendAudioForTranscription = async () => {
    // Check if we have segment chunks to send
    if (segmentChunksRef.current.length === 0 || isSendingAudioRef.current) return;
    
    isSendingAudioRef.current = true;
    setIsProcessing(true);
    
    try {
      // Create a blob from ONLY the current segment chunks (cost-effective)
      const audioBlob = new Blob(segmentChunksRef.current, { type: 'audio/webm' });
      
      // Check if blob has content
      if (audioBlob.size === 0) {
        console.log('Empty audio blob, skipping transcription');
        return;
      }
      
      // Create form data
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('isFinal', 'false');
      
      // Send to backend for transcription
      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Transcription failed');
      }
      
      const result = await response.json();
      
      if (result.text) {
        const newSegment: TranscriptionSegment = {
          text: result.text,
          timestamp: Date.now(),
          isFinal: false
        };
        
        setTranscription(prev => [...prev, newSegment]);
        setCurrentTranscript(prev => prev + ' ' + result.text);
        
        // Try to extract patient info
        if (result.patientInfo) {
          setPatientInfo(result.patientInfo);
        }
        
        // Clear segment chunks after successful transcription
        segmentChunksRef.current = [];
      }
    } catch (error) {
      console.error('Transcription error:', error);
    } finally {
      setIsProcessing(false);
      isSendingAudioRef.current = false;
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      isPausedRef.current = true;
      toast({
        title: "Recording Paused",
        description: "Click resume to continue recording",
      });
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      isPausedRef.current = false;
      toast({
        title: "Recording Resumed",
        description: "Continue speaking",
      });
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      
      // Stop the stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Clear transcription interval
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current);
      }
      
      setIsRecording(false);
      setIsPaused(false);
      
      // Send final transcription
      if (audioChunksRef.current.length > 0) {
        await sendFinalTranscription();
      }
      
      toast({
        title: "Recording Stopped",
        description: "Processing final transcription...",
      });
    }
  };

  const sendFinalTranscription = async () => {
    // Skip if no chunks to process
    if (audioChunksRef.current.length === 0) {
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Send all chunks for final transcription
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('isFinal', 'true');
      
      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Final transcription failed');
      }
      
      const result = await response.json();
      
      if (result.fullTranscript) {
        setCurrentTranscript(result.fullTranscript);
      }
      
      if (result.patientInfo) {
        setPatientInfo(result.patientInfo);
      }
    } catch (error) {
      console.error('Final transcription error:', error);
      toast({
        title: "Transcription Error",
        description: "Failed to process final transcription",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetRecording = () => {
    setTranscription([]);
    setCurrentTranscript("");
    setRecordingTime(0);
    setPatientInfo(null);
    audioChunksRef.current = [];
    
    toast({
      title: "Recording Reset",
      description: "Ready to start a new recording",
    });
  };

  const submitToAutomation = async () => {
    if (!patientInfo || !currentTranscript) {
      toast({
        title: "Missing Information",
        description: "Please ensure patient is identified and transcript is available",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const requestBody = {
        run_email: "jeffrey.Bander@providerloop.com",
        chain_to_run: selectedChain,
        human_readable_record: "external app - audio transcription",
        source_id: patientInfo.sourceId,
        first_step_user_input: "",
        starting_variables: {
          first_name: patientInfo.firstName,
          last_name: patientInfo.lastName,
          date_of_birth: patientInfo.dateOfBirth,
          transcription: currentTranscript,
          recording_duration: formatTime(recordingTime),
          recording_date: new Date().toLocaleDateString(),
          recording_time: new Date().toLocaleTimeString(),
        }
      };
      
      const response = await fetch("https://start-chain-run-943506065004.us-central1.run.app", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      
      const result = await response.text();
      
      if (response.ok) {
        let chainRunId = '';
        try {
          const chainRunMatch = result.match(/"ChainRun_ID"\s*:\s*"([^"]+)"/);
          if (chainRunMatch) {
            chainRunId = chainRunMatch[1];
          }
        } catch (e) {
          console.log('Could not extract ChainRun_ID');
        }
        
        toast({
          title: "Transcription Submitted ✓",
          description: `Chain triggered! Chain Run ID: ${chainRunId || 'Generated'}`,
        });
        
        // Reset after successful submission
        resetRecording();
      } else {
        throw new Error(`API failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to trigger automation chain",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <Button variant="outline" size="sm">
                  ← Back
                </Button>
              </Link>
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img src={providerloopLogo} alt="Providerloop" className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Audio Transcription</h1>
                <p className="text-sm text-gray-600">Record and transcribe patient conversations</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Recording Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Recording Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {!isRecording ? (
                  <Button onClick={startRecording} size="lg" className="bg-red-600 hover:bg-red-700">
                    <Mic className="mr-2 h-5 w-5" />
                    Start Recording
                  </Button>
                ) : (
                  <>
                    {!isPaused ? (
                      <Button onClick={pauseRecording} size="lg" variant="outline">
                        <Pause className="mr-2 h-5 w-5" />
                        Pause
                      </Button>
                    ) : (
                      <Button onClick={resumeRecording} size="lg" variant="outline">
                        <Play className="mr-2 h-5 w-5" />
                        Resume
                      </Button>
                    )}
                    <Button onClick={stopRecording} size="lg" variant="destructive">
                      <MicOff className="mr-2 h-5 w-5" />
                      Stop
                    </Button>
                  </>
                )}
                <Button onClick={resetRecording} variant="outline" disabled={isRecording}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
              
              <div className="flex items-center space-x-4">
                <Badge variant={isRecording ? "destructive" : "secondary"} className="text-lg px-4 py-2">
                  {formatTime(recordingTime)}
                </Badge>
                {isProcessing && (
                  <Badge variant="outline" className="animate-pulse">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Processing...
                  </Badge>
                )}
              </div>
            </div>
            
            {isRecording && (
              <Alert>
                <Mic className="h-4 w-4" />
                <AlertDescription>
                  Recording in progress. Speak clearly and mention patient's name and date of birth for automatic identification.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Transcription Display */}
        <Card>
          <CardHeader>
            <CardTitle>Live Transcription</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="transcript">
              <TabsList className="mb-4">
                <TabsTrigger value="transcript">Full Transcript</TabsTrigger>
                <TabsTrigger value="segments">Segments</TabsTrigger>
              </TabsList>
              
              <TabsContent value="transcript">
                <Textarea
                  value={currentTranscript}
                  onChange={(e) => setCurrentTranscript(e.target.value)}
                  placeholder="Transcription will appear here as you speak..."
                  className="min-h-[200px] font-mono text-sm"
                  readOnly={isRecording}
                />
                {!isRecording && currentTranscript && (
                  <p className="text-sm text-gray-500 mt-2">
                    You can edit the transcript above before submitting
                  </p>
                )}
              </TabsContent>
              
              <TabsContent value="segments" className="space-y-2">
                {transcription.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No segments yet. Start recording to see real-time transcription.</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {transcription.map((segment, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm">{segment.text}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(segment.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Patient Identification */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Identification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {patientInfo ? (
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2 flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Patient Identified
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>Name</Label>
                    <p className="font-medium">{patientInfo.firstName} {patientInfo.lastName}</p>
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <p className="font-medium">{patientInfo.dateOfBirth}</p>
                  </div>
                  <div className="col-span-2">
                    <Label>Source ID</Label>
                    <p className="font-mono text-xs bg-white px-2 py-1 rounded">
                      {patientInfo.sourceId}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Patient not yet identified. Mention patient's full name and date of birth during recording.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Manual Patient Entry */}
            {!patientInfo && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-sm font-medium">Manual Patient Entry</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    <Input placeholder="Enter first name" />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input placeholder="Enter last name" />
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <Input type="date" />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit to Automation */}
        {currentTranscript && patientInfo && (
          <Card>
            <CardHeader>
              <CardTitle>Submit to Automation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Chain to Run</Label>
                <Select value={selectedChain} onValueChange={setSelectedChain}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATTACHMENT PROCESSING (LABS)">
                      Attachment Processing (Labs)
                    </SelectItem>
                    <SelectItem value="ATTACHMENT PROCESSING (SLEEP STUDY)">
                      Attachment Processing (Sleep Study)
                    </SelectItem>
                    <SelectItem value="ATTACHMENT PROCESSING (RESEARCH STUDY)">
                      Attachment Processing (Research Study)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={submitToAutomation} 
                className="w-full" 
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Transcription
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}