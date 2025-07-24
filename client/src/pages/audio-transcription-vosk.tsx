import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Download, Send, AlertCircle, Loader2, HardDrive } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const CHAIN_OPTIONS = [
  "ATTACHMENT PROCESSING (LABS)",
  "ATTACHMENT PROCESSING (SLEEP STUDY)", 
  "ATTACHMENT PROCESSING (RESEARCH STUDY)",
  "QuickAddQHC",
  "REFERRAL PROCESSING",
  "CLIENT REPORT SENT",
  "SLEEP STUDY RESULTS"
];

// Vosk model URLs - using small English model for efficiency
const MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip";
const MODEL_SIZE_MB = 40;

interface PatientInfo {
  firstName?: string;
  lastName?: string;
  dob?: string;
  sourceId?: string;
}

export default function AudioTranscriptionVosk() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [partialTranscript, setPartialTranscript] = useState("");
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [selectedChain, setSelectedChain] = useState(CHAIN_OPTIONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const recognizerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<any>(null);

  // Load Vosk dynamically
  useEffect(() => {
    // Check if Vosk is already loaded
    if (typeof window !== 'undefined' && !(window as any).Vosk) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
      script.async = true;
      script.onload = () => {
        console.log('Vosk library loaded');
      };
      script.onerror = () => {
        setError('Failed to load Vosk library');
      };
      document.body.appendChild(script);
    }
  }, []);

  // Load the model when component mounts or when user clicks download
  const loadModel = async () => {
    if (isLoadingModel || modelLoaded) return;
    
    setIsLoadingModel(true);
    setError(null);
    setModelProgress(0);
    
    try {
      const Vosk = (window as any).Vosk;
      if (!Vosk) {
        throw new Error('Vosk library not loaded yet. Please wait and try again.');
      }

      toast({
        title: "Downloading Model",
        description: `Downloading ${MODEL_SIZE_MB}MB speech recognition model...`,
      });

      // Create a simple progress simulation since Vosk doesn't provide download progress
      const progressInterval = setInterval(() => {
        setModelProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 1000);

      // Load the model
      modelRef.current = await Vosk.createModel(MODEL_URL);
      
      clearInterval(progressInterval);
      setModelProgress(100);
      setModelLoaded(true);
      
      toast({
        title: "Model Loaded",
        description: "Speech recognition model loaded successfully!",
      });
    } catch (error) {
      console.error('Failed to load model:', error);
      setError(error instanceof Error ? error.message : 'Failed to load speech recognition model');
      toast({
        title: "Model Loading Failed",
        description: "Failed to load the speech recognition model. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingModel(false);
    }
  };

  // Extract patient information from transcript
  const extractPatientInfo = (text: string) => {
    const patterns = {
      name: [
        /patient(?:\s+is)?(?:\s+named?)?\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
        /name(?:\s+is)?(?:\s+)?\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
        /([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s+is)?(?:\s+the)?(?:\s+patient)?/i,
      ],
      dob: [
        /born(?:\s+on)?\s+(\d{1,2})[\s-\/](\d{1,2})[\s-\/](\d{2,4})/i,
        /date of birth(?:\s+is)?\s+(\d{1,2})[\s-\/](\d{1,2})[\s-\/](\d{2,4})/i,
        /DOB(?:\s+is)?\s+(\d{1,2})[\s-\/](\d{1,2})[\s-\/](\d{2,4})/i,
        /(\d{1,2})[\s-\/](\d{1,2})[\s-\/](\d{2,4})(?:\s+birth)?/i,
      ]
    };

    let extractedInfo: PatientInfo = {};

    // Extract name
    for (const pattern of patterns.name) {
      const match = text.match(pattern);
      if (match) {
        extractedInfo.firstName = match[1];
        extractedInfo.lastName = match[2];
        break;
      }
    }

    // Extract DOB
    for (const pattern of patterns.dob) {
      const match = text.match(pattern);
      if (match) {
        const month = match[1].padStart(2, '0');
        const day = match[2].padStart(2, '0');
        let year = match[3];
        if (year.length === 2) {
          year = (parseInt(year) > 50 ? '19' : '20') + year;
        }
        extractedInfo.dob = `${year}-${month}-${day}`;
        break;
      }
    }

    // Generate source ID if we have the required info
    if (extractedInfo.firstName && extractedInfo.lastName && extractedInfo.dob) {
      const [year, month, day] = extractedInfo.dob.split('-');
      extractedInfo.sourceId = `${extractedInfo.lastName}_${extractedInfo.firstName}__${month}_${day}_${year}`;
    }

    return extractedInfo;
  };

  // Start recording
  const startRecording = async () => {
    if (!modelLoaded) {
      toast({
        title: "Model Not Loaded",
        description: "Please load the speech recognition model first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Vosk requires 16kHz
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      streamRef.current = stream;
      
      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      
      // Create recognizer
      const Vosk = (window as any).Vosk;
      recognizerRef.current = new modelRef.current.KaldiRecognizer(16000);
      
      // Set up event listeners
      recognizerRef.current.on("result", (message: any) => {
        const result = message.result;
        if (result && result.text) {
          const fullText = transcript + " " + result.text;
          setTranscript(fullText.trim());
          setPartialTranscript("");
          
          // Extract patient info from the complete transcript
          const info = extractPatientInfo(fullText);
          if (info.sourceId) {
            setPatientInfo(info);
          }
        }
      });
      
      recognizerRef.current.on("partialresult", (message: any) => {
        const result = message.result;
        if (result && result.partial) {
          setPartialTranscript(result.partial);
        }
      });
      
      // Create audio processing pipeline
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (event) => {
        if (recognizerRef.current && isRecording) {
          try {
            recognizerRef.current.acceptWaveform(event.inputBuffer);
          } catch (error) {
            console.error('Audio processing error:', error);
          }
        }
      };
      
      // Connect audio pipeline
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      setIsRecording(true);
      setError(null);
      
      toast({
        title: "Recording Started",
        description: "Speak clearly. Patient information will be extracted automatically.",
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to access microphone. Please check permissions.');
      toast({
        title: "Recording Failed",
        description: "Could not access microphone. Please check your browser permissions.",
        variant: "destructive",
      });
    }
  };

  // Stop recording
  const stopRecording = () => {
    setIsRecording(false);
    
    // Clean up audio resources
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (recognizerRef.current) {
      recognizerRef.current.remove();
      recognizerRef.current = null;
    }
    
    // Process any remaining partial transcript
    if (partialTranscript) {
      setTranscript(prev => (prev + " " + partialTranscript).trim());
      setPartialTranscript("");
    }
  };

  // Submit to automation
  const submitToAutomation = async () => {
    if (!patientInfo || !patientInfo.sourceId) {
      toast({
        title: "Missing Information",
        description: "Please ensure patient name and date of birth are mentioned in the recording.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/automation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: patientInfo.firstName,
          last_name: patientInfo.lastName,
          dob: patientInfo.dob,
          chain_to_run: selectedChain,
          source_id: patientInfo.sourceId,
          first_step_user_input: "",
          human_readable_record: `Audio transcription via offline Vosk model: ${transcript}`,
          starting_variables: {
            audio_transcript: transcript,
            transcription_method: "vosk_offline",
            patient_first_name: patientInfo.firstName,
            patient_last_name: patientInfo.lastName,
            patient_dob: patientInfo.dob
          }
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Success",
          description: `Transcription submitted to ${selectedChain}`,
        });
        
        // Clear form
        setTranscript("");
        setPartialTranscript("");
        setPatientInfo(null);
      } else {
        throw new Error(data.error || 'Failed to trigger automation');
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit transcription",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <HardDrive className="h-6 w-6" />
                Audio Transcription (Offline - Vosk)
              </CardTitle>
              <CardDescription>
                100% offline speech recognition using Vosk. No API costs, complete privacy.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              <HardDrive className="h-3 w-3 mr-1" />
              Offline Mode
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Model Loading Section */}
          {!modelLoaded && (
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  {!isLoadingModel ? (
                    <>
                      <HardDrive className="h-12 w-12 mx-auto text-gray-400" />
                      <div>
                        <h3 className="font-semibold">Download Speech Recognition Model</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          One-time download of {MODEL_SIZE_MB}MB. Works completely offline after download.
                        </p>
                      </div>
                      <Button onClick={loadModel} disabled={isLoadingModel}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Model
                      </Button>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-12 w-12 mx-auto animate-spin text-blue-500" />
                      <div>
                        <h3 className="font-semibold">Downloading Model...</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Progress: {modelProgress}%
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${modelProgress}%` }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Recording Controls */}
          {modelLoaded && (
            <>
              <div className="flex justify-center">
                <Button
                  size="lg"
                  variant={isRecording ? "destructive" : "default"}
                  onClick={isRecording ? stopRecording : startRecording}
                  className="px-8"
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-5 w-5 mr-2" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5 mr-2" />
                      Start Recording
                    </>
                  )}
                </Button>
              </div>

              {/* Recording Status */}
              {isRecording && (
                <div className="text-center">
                  <Badge variant="destructive" className="animate-pulse">
                    <div className="h-2 w-2 bg-red-500 rounded-full mr-2 animate-pulse" />
                    Recording... Speak clearly
                  </Badge>
                </div>
              )}

              {/* Transcript Display */}
              {(transcript || partialTranscript) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Transcript</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm whitespace-pre-wrap">
                        {transcript}
                        {partialTranscript && (
                          <span className="text-gray-400 italic"> {partialTranscript}</span>
                        )}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Extracted Patient Info */}
              {patientInfo && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-green-800">
                      Patient Information Extracted
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Name:</span> {patientInfo.firstName} {patientInfo.lastName}
                      </div>
                      <div>
                        <span className="font-medium">DOB:</span> {patientInfo.dob}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">Source ID:</span> {patientInfo.sourceId}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Submit Section */}
              {transcript && !isRecording && (
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}