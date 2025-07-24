import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Pause, Play, Square, Send, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CHAIN_OPTIONS = [
  "ATTACHMENT PROCESSING (LABS)",
  "ATTACHMENT PROCESSING (SLEEP STUDY)", 
  "ATTACHMENT PROCESSING (RESEARCH STUDY)",
  "QuickAddQHC",
  "REFERRAL PROCESSING",
  "CLIENT REPORT SENT",
  "SLEEP STUDY RESULTS"
];

interface TranscriptionSegment {
  text: string;
  timestamp: number;
  isFinal: boolean;
}

interface PatientInfo {
  name: string;
  dateOfBirth: string;
  sourceId: string;
}

// Check for browser support
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function AudioTranscriptionLocal() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionSegment[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [selectedChain, setSelectedChain] = useState("ATTACHMENT PROCESSING (LABS)");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  // Check browser support on mount
  useEffect(() => {
    if (!SpeechRecognition) {
      toast({
        title: "Browser Not Supported",
        description: "Your browser doesn't support speech recognition. Please use Chrome, Edge, or Safari.",
        variant: "destructive",
      });
    }
  }, []);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const extractPatientInfo = (text: string) => {
    // Extract patient name
    const nameMatch = text.match(/(?:patient|name is|patient name is?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i) ||
                      text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is the patient|patient)/i);
    
    // Extract date of birth
    const dobMatch = text.match(/(?:born|date of birth|DOB|birthday)\s+(?:is\s+)?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i) ||
                     text.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
    
    if (nameMatch || dobMatch) {
      const name = nameMatch ? nameMatch[1].trim() : '';
      let dateOfBirth = '';
      let sourceId = '';
      
      if (dobMatch) {
        const dobParts = dobMatch[1].split(/[/-]/);
        if (dobParts.length === 3) {
          const month = dobParts[0].padStart(2, '0');
          const day = dobParts[1].padStart(2, '0');
          let year = dobParts[2];
          if (year.length === 2) {
            year = (parseInt(year) > 50 ? '19' : '20') + year;
          }
          dateOfBirth = `${month}/${day}/${year}`;
          
          if (name) {
            const nameParts = name.split(' ');
            const lastName = nameParts[nameParts.length - 1];
            const firstName = nameParts[0];
            sourceId = `${lastName}_${firstName}__${month}_${day}_${year}`.replace(/[^a-zA-Z0-9_]/g, '_');
          }
        }
      }
      
      if (name || dateOfBirth) {
        const info = { name, dateOfBirth, sourceId };
        setPatientInfo(info);
        return info;
      }
    }
    
    return null;
  };

  const startRecording = () => {
    if (!SpeechRecognition) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser.",
        variant: "destructive",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognitionRef.current = recognition;
    
    recognition.onstart = () => {
      setIsRecording(true);
      setIsPaused(false);
      toast({
        title: "Recording Started",
        description: "Speak clearly - transcription will appear in real-time",
      });
    };
    
    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      
      if (final) {
        const newSegment: TranscriptionSegment = {
          text: final.trim(),
          timestamp: Date.now(),
          isFinal: true
        };
        
        setTranscription(prev => [...prev, newSegment]);
        setCurrentTranscript(prev => prev + ' ' + final.trim());
        
        // Try to extract patient info from the final transcript
        extractPatientInfo(currentTranscript + ' ' + final);
      }
      
      setInterimTranscript(interim);
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Ignore no-speech errors as they're common
        return;
      }
      
      toast({
        title: "Recognition Error",
        description: `Error: ${event.error}`,
        variant: "destructive",
      });
      
      if (event.error === 'not-allowed') {
        setIsRecording(false);
      }
    };
    
    recognition.onend = () => {
      if (isRecording && !isPaused) {
        // Restart recognition if it ended unexpectedly
        recognition.start();
      }
    };
    
    recognition.start();
  };

  const pauseRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsPaused(true);
      toast({
        title: "Recording Paused",
        description: "Click resume to continue recording",
      });
    }
  };

  const resumeRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
      setIsPaused(false);
      toast({
        title: "Recording Resumed",
        description: "Continue speaking",
      });
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    setIsRecording(false);
    setIsPaused(false);
    
    toast({
      title: "Recording Stopped",
      description: "Transcription complete",
    });
  };

  const submitToAutomation = async () => {
    if (!patientInfo || !patientInfo.sourceId) {
      toast({
        title: "Missing Information",
        description: "Please ensure patient name and date of birth are mentioned in the recording",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/run-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chaintorun: selectedChain,
          source_id: patientInfo.sourceId,
          run_email: "jeffrey.Bander@providerloop.com",
          folder_id: "",
          source_name: "",
          first_step_user_input: "",
          starting_variables: {
            patient_name: patientInfo.name,
            date_of_birth: patientInfo.dateOfBirth,
            transcription: currentTranscript,
            recording_time: formatTime(recordingTime)
          },
          human_readable_record: `Audio transcription for ${patientInfo.name} recorded via external app`
        }),
      });

      if (!response.ok) throw new Error('Failed to submit');

      const result = await response.json();
      
      toast({
        title: "Automation Triggered",
        description: `Chain run ID: ${result.uniqueId}`,
      });

      // Reset form
      setTranscription([]);
      setCurrentTranscript("");
      setPatientInfo(null);
      setRecordingTime(0);
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Could not trigger automation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-6 w-6" />
            Audio Transcription (Local - No API)
          </CardTitle>
          <CardDescription>
            Record patient visits with real-time transcription using your browser's speech recognition - no API costs!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!SpeechRecognition && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-semibold">Browser Not Supported</p>
                <p className="text-sm">Speech recognition requires Chrome, Edge, or Safari. Please use a supported browser.</p>
              </div>
            </div>
          )}
          
          {/* Recording Controls */}
          <div className="flex items-center gap-4 flex-wrap">
            {!isRecording ? (
              <Button onClick={startRecording} size="lg" disabled={!SpeechRecognition}>
                <Mic className="h-5 w-5 mr-2" />
                Start Recording
              </Button>
            ) : (
              <>
                {!isPaused ? (
                  <Button onClick={pauseRecording} variant="secondary" size="lg">
                    <Pause className="h-5 w-5 mr-2" />
                    Pause
                  </Button>
                ) : (
                  <Button onClick={resumeRecording} variant="secondary" size="lg">
                    <Play className="h-5 w-5 mr-2" />
                    Resume
                  </Button>
                )}
                <Button onClick={stopRecording} variant="destructive" size="lg">
                  <Square className="h-5 w-5 mr-2" />
                  Stop
                </Button>
              </>
            )}
            
            {isRecording && (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                <span className="font-mono text-lg">{formatTime(recordingTime)}</span>
              </div>
            )}
          </div>
          
          {/* Patient Information */}
          {patientInfo && (
            <Card className="bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">Detected Patient Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="font-semibold">Name:</span> {patientInfo.name}
                </div>
                <div>
                  <span className="font-semibold">Date of Birth:</span> {patientInfo.dateOfBirth}
                </div>
                <div>
                  <span className="font-semibold">Source ID:</span> <code className="bg-muted px-2 py-1 rounded">{patientInfo.sourceId}</code>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Live Transcription */}
          {(transcription.length > 0 || interimTranscript) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Live Transcription</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {transcription.map((segment, index) => (
                    <div key={index} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex-1">{segment.text}</p>
                        <Badge variant={segment.isFinal ? "default" : "secondary"} className="text-xs">
                          {new Date(segment.timestamp).toLocaleTimeString()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {interimTranscript && (
                    <div className="p-3 bg-muted/50 rounded-lg italic text-muted-foreground">
                      {interimTranscript}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Submit to Automation */}
          {currentTranscript && !isRecording && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Submit to Chain</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedChain} onValueChange={setSelectedChain}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAIN_OPTIONS.map((chain: string) => (
                      <SelectItem key={chain} value={chain}>
                        {chain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button 
                  onClick={submitToAutomation} 
                  disabled={!patientInfo || isSubmitting}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Submitting..." : "Submit Transcription"}
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}