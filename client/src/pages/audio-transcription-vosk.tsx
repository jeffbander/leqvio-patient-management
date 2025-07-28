import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Download, Send, AlertCircle, Loader2, HardDrive, Edit2, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CHAIN_OPTIONS = [
  "ATTACHMENT PROCESSING (LABS)",
  "ATTACHMENT PROCESSING (SLEEP STUDY)", 
  "ATTACHMENT PROCESSING (RESEARCH STUDY)",
  "QuickAddQHC",
  "REFERRAL PROCESSING",
  "CLIENT REPORT SENT",
  "SLEEP STUDY RESULTS"
];

// Vosk model URLs - using vosk-browser compatible model
// Note: vosk-browser requires unzipped model files hosted with proper CORS headers
const MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15";
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
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editedPatientInfo, setEditedPatientInfo] = useState<PatientInfo>({});
  
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

      console.log('Starting model download from:', MODEL_URL);
      
      toast({
        title: "Downloading Model",
        description: `Downloading ${MODEL_SIZE_MB}MB speech recognition model. This may take a moment...`,
      });

      // Try different model URLs if the first one fails
      const modelUrls = [
        MODEL_URL,
        "https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15",
        "https://cdn.jsdelivr.net/gh/ccoreilly/vosk-browser@latest/examples/models/vosk-model-small-en-us-0.15"
      ];

      let modelLoaded = false;
      let lastError = null;

      for (const url of modelUrls) {
        try {
          console.log('Attempting to load model from:', url);
          
          // Create a simple progress simulation
          const progressInterval = setInterval(() => {
            setModelProgress(prev => {
              if (prev >= 90) {
                clearInterval(progressInterval);
                return 90;
              }
              return prev + 5;
            });
          }, 500);

          // Load the model with timeout
          const modelPromise = Vosk.createModel(url);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Model download timeout (30s)')), 30000)
          );

          modelRef.current = await Promise.race([modelPromise, timeoutPromise]);
          
          clearInterval(progressInterval);
          setModelProgress(100);
          modelLoaded = true;
          console.log('Model loaded successfully from:', url);
          break;
        } catch (err) {
          console.error(`Failed to load model from ${url}:`, err);
          lastError = err;
        }
      }

      if (!modelLoaded) {
        throw new Error(`Failed to load model from any source. Last error: ${lastError?.message || 'Unknown error'}`);
      }
      
      setModelLoaded(true);
      
      toast({
        title: "Model Loaded",
        description: "Speech recognition model loaded successfully!",
      });
    } catch (error) {
      console.error('Failed to load model:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load speech recognition model';
      setError(`Model loading failed: ${errorMessage}. This might be due to CORS restrictions. Please try refreshing the page or using the API-based transcription instead.`);
      toast({
        title: "Model Loading Failed",
        description: "Unable to download the speech recognition model. Please check your internet connection or try the API-based transcription.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingModel(false);
    }
  };

  // Extract patient information from transcript
  const extractPatientInfo = (text: string) => {
    // Normalize text for better matching
    const normalizedText = text.toLowerCase();
    
    const patterns = {
      name: [
        // More flexible patterns
        /patient(?:\s+is)?(?:\s+named?)?\s+([a-z]+)\s+([a-z]+)/i,
        /name(?:\s+is)?(?:\s+)?\s+([a-z]+)\s+([a-z]+)/i,
        /([a-z]+)\s+([a-z]+)(?:\s+is)?(?:\s+the)?(?:\s+patient)/i,
        /treating\s+([a-z]+)\s+([a-z]+)/i,
        /for\s+([a-z]+)\s+([a-z]+)/i,
        /mr\.?\s+([a-z]+)\s+([a-z]+)/i,
        /mrs\.?\s+([a-z]+)\s+([a-z]+)/i,
        /ms\.?\s+([a-z]+)\s+([a-z]+)/i,
        /miss\s+([a-z]+)\s+([a-z]+)/i,
        /doctor\s+([a-z]+)\s+([a-z]+)/i,
        // First name last name patterns
        /first\s+name\s+(?:is\s+)?([a-z]+).*last\s+name\s+(?:is\s+)?([a-z]+)/i,
        /([a-z]+)\s+is\s+the\s+first\s+name.*([a-z]+)\s+is\s+the\s+last\s+name/i,
      ],
      dob: [
        // More flexible date patterns
        /born(?:\s+on)?\s+(\d{1,2})[\s\-\/](\d{1,2})[\s\-\/](\d{2,4})/i,
        /date\s+of\s+birth(?:\s+is)?\s+(\d{1,2})[\s\-\/](\d{1,2})[\s\-\/](\d{2,4})/i,
        /dob(?:\s+is)?\s+(\d{1,2})[\s\-\/](\d{1,2})[\s\-\/](\d{2,4})/i,
        /birthday(?:\s+is)?\s+(\d{1,2})[\s\-\/](\d{1,2})[\s\-\/](\d{2,4})/i,
        // Month name patterns
        /born(?:\s+on)?\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})/i,
        /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})\s+birth/i,
        // Numeric only patterns
        /(\d{1,2})[\s\-\/](\d{1,2})[\s\-\/](\d{2,4})/,
      ],
      monthNames: {
        january: '01', february: '02', march: '03', april: '04',
        may: '05', june: '06', july: '07', august: '08',
        september: '09', october: '10', november: '11', december: '12',
        jan: '01', feb: '02', mar: '03', apr: '04',
        jun: '06', jul: '07', aug: '08', sep: '09', sept: '09',
        oct: '10', nov: '11', dec: '12'
      }
    };

    let extractedInfo: PatientInfo = {};

    // Extract name with improved matching
    for (const pattern of patterns.name) {
      const match = text.match(pattern);
      if (match) {
        // Capitalize first letters
        extractedInfo.firstName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        extractedInfo.lastName = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
        break;
      }
    }

    // Extract DOB with improved patterns
    for (const pattern of patterns.dob) {
      const match = text.match(pattern);
      if (match) {
        let month: string, day: string, year: string;
        
        // Check if first match is a month name
        if (isNaN(parseInt(match[1]))) {
          const monthName = match[1].toLowerCase();
          month = patterns.monthNames[monthName as keyof typeof patterns.monthNames] || '01';
          day = match[2].padStart(2, '0');
          year = match[3];
        } else {
          month = match[1].padStart(2, '0');
          day = match[2].padStart(2, '0');
          year = match[3];
        }
        
        // Handle 2-digit years
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
          if (info.firstName || info.lastName || info.dob) {
            setPatientInfo(prev => ({
              ...prev,
              ...info
            }));
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
                  {!isLoadingModel && !error ? (
                    <>
                      <HardDrive className="h-12 w-12 mx-auto text-gray-400" />
                      <div>
                        <h3 className="font-semibold">Download Speech Recognition Model</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          One-time download of {MODEL_SIZE_MB}MB. Works completely offline after download.
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Note: Download may fail due to CORS restrictions on some networks.
                        </p>
                      </div>
                      <Button onClick={loadModel} disabled={isLoadingModel}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Model
                      </Button>
                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500 mb-2">Or try these alternatives:</p>
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.location.href = '/audio'}
                          >
                            API Version
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.location.href = '/audio-local'}
                          >
                            Browser Speech
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : isLoadingModel ? (
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
                        <p className="text-xs text-gray-400 mt-2">
                          This may take 1-2 minutes depending on your connection
                        </p>
                      </div>
                    </>
                  ) : error ? (
                    <>
                      <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
                      <div>
                        <h3 className="font-semibold text-red-700">Download Failed</h3>
                        <p className="text-sm text-gray-600 mt-1">{error}</p>
                      </div>
                      <div className="space-y-2">
                        <Button onClick={() => {
                          setError(null);
                          loadModel();
                        }} variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Retry Download
                        </Button>
                        <div className="pt-2">
                          <p className="text-xs text-gray-500 mb-2">Try these alternatives instead:</p>
                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => window.location.href = '/audio'}
                            >
                              Use API Version
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => window.location.href = '/audio-local'}
                            >
                              Use Browser Speech
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
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
                <div className="space-y-4">
                  <div className="text-center">
                    <Badge variant="destructive" className="animate-pulse">
                      <div className="h-2 w-2 bg-red-500 rounded-full mr-2 animate-pulse" />
                      Recording... Speak clearly
                    </Badge>
                  </div>
                  
                  {/* Patient Info Guide */}
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="pt-4">
                      <h4 className="font-semibold text-sm text-blue-900 mb-2">Say patient information like:</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• "Patient is John Smith"</li>
                        <li>• "Treating Mary Johnson"</li>
                        <li>• "For Mr. Robert Davis"</li>
                        <li>• "Date of birth January 15th 1980"</li>
                        <li>• "Born on 03/25/1965"</li>
                      </ul>
                    </CardContent>
                  </Card>
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
              {(patientInfo || transcript) && (
                <Card className={patientInfo?.sourceId ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className={`text-lg ${patientInfo?.sourceId ? "text-green-800" : "text-orange-800"}`}>
                      {patientInfo?.sourceId ? "Patient Information Extracted" : "Patient Information Needed"}
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditingPatient(!isEditingPatient);
                        if (!isEditingPatient) {
                          setEditedPatientInfo(patientInfo || {});
                        }
                      }}
                    >
                      {isEditingPatient ? (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </>
                      ) : (
                        <>
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </>
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {!isEditingPatient ? (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">First Name:</span> {patientInfo?.firstName || <span className="text-gray-400">Not detected</span>}
                        </div>
                        <div>
                          <span className="font-medium">Last Name:</span> {patientInfo?.lastName || <span className="text-gray-400">Not detected</span>}
                        </div>
                        <div>
                          <span className="font-medium">DOB:</span> {patientInfo?.dob || <span className="text-gray-400">Not detected</span>}
                        </div>
                        <div>
                          <span className="font-medium">Source ID:</span> {patientInfo?.sourceId || <span className="text-gray-400">Will be generated</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="firstName">First Name</Label>
                            <Input
                              id="firstName"
                              value={editedPatientInfo.firstName || ''}
                              onChange={(e) => setEditedPatientInfo({...editedPatientInfo, firstName: e.target.value})}
                              placeholder="Enter first name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input
                              id="lastName"
                              value={editedPatientInfo.lastName || ''}
                              onChange={(e) => setEditedPatientInfo({...editedPatientInfo, lastName: e.target.value})}
                              placeholder="Enter last name"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="dob">Date of Birth</Label>
                          <Input
                            id="dob"
                            type="date"
                            value={editedPatientInfo.dob || ''}
                            onChange={(e) => setEditedPatientInfo({...editedPatientInfo, dob: e.target.value})}
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => {
                            const firstName = editedPatientInfo.firstName;
                            const lastName = editedPatientInfo.lastName;
                            const dob = editedPatientInfo.dob;
                            
                            if (firstName && lastName && dob) {
                              const [year, month, day] = dob.split('-');
                              const sourceId = `${lastName}_${firstName}__${month}_${day}_${year}`;
                              
                              setPatientInfo({
                                ...editedPatientInfo,
                                sourceId
                              });
                              
                              toast({
                                title: "Patient Information Updated",
                                description: "Patient details have been saved successfully.",
                              });
                            } else {
                              toast({
                                title: "Missing Information",
                                description: "Please fill in all fields to generate Source ID.",
                                variant: "destructive",
                              });
                            }
                            
                            setIsEditingPatient(false);
                          }}
                        >
                          Save Patient Information
                        </Button>
                      </div>
                    )}
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