import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Mic, MicOff, Loader2, Settings2, ChevronDown, ChevronUp, Ear, Paperclip, X } from 'lucide-react';
import { ai } from '../lib/ai';
import { AudioPlayer, AudioRecorder } from '../lib/audio';
import { LiveServerMessage, Modality } from '@google/genai';

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
const PERSONALITIES = ['Friendly', 'Professional', 'Humorous', 'Sarcastic'];
const LANGUAGES = ['Auto', 'English', 'Spanish', 'French', 'German', 'Japanese', 'Mandarin', 'Hindi', 'Arabic', 'Telugu'];
const OUTPUT_LANGUAGES = ['Same as Input', 'English', 'Spanish', 'French', 'German', 'Japanese', 'Mandarin', 'Hindi', 'Arabic', 'Telugu'];

type Transcript = {
  id: string;
  role: 'user' | 'model';
  text: string;
};

interface VoiceChatProps {
  onSessionExpired?: () => void;
}

export function VoiceChat({ onSessionExpired }: VoiceChatProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [inputLanguage, setInputLanguage] = useState('Auto');
  const [outputLanguage, setOutputLanguage] = useState('Same as Input');
  const [personality, setPersonality] = useState('Friendly');
  const [voice, setVoice] = useState('Zephyr');
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [isWaitingForWakeWord, setIsWaitingForWakeWord] = useState(false);
  
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceMimeType, setReferenceMimeType] = useState<string | null>(null);
  
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  
  const sessionRef = useRef<any>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);

  const settingsRef = useRef({ inputLanguage, outputLanguage, personality, voice });
  const wakeWordRef = useRef(wakeWordEnabled);
  const isConnectedRef = useRef(isConnected || isConnecting);
  const referenceImageRef = useRef(referenceImage);
  const referenceMimeTypeRef = useRef(referenceMimeType);

  useEffect(() => {
    settingsRef.current = { inputLanguage, outputLanguage, personality, voice };
  }, [inputLanguage, outputLanguage, personality, voice]);

  useEffect(() => {
    wakeWordRef.current = wakeWordEnabled;
  }, [wakeWordEnabled]);

  useEffect(() => {
    isConnectedRef.current = isConnected || isConnecting;
  }, [isConnected, isConnecting]);

  useEffect(() => {
    referenceImageRef.current = referenceImage;
    referenceMimeTypeRef.current = referenceMimeType;
  }, [referenceImage, referenceMimeType]);

  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setReferenceImage(result);
      setReferenceMimeType(file.type);
      
      if (sessionRef.current) {
         const base64Data = result.split(',')[1];
         sessionRef.current.sendRealtimeInput({
           video: { data: base64Data, mimeType: file.type }
         });
      }
    };
    reader.readAsDataURL(file);
  };

  const connect = async () => {
    if (isConnectedRef.current) return;
    setIsConnecting(true);
    setError(null);
    setIsWaitingForWakeWord(false);
    
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    
    try {
      audioPlayerRef.current = new AudioPlayer();
      
      const { inputLanguage, outputLanguage, personality, voice } = settingsRef.current;
      
      let instruction = `You are a helpful voice assistant named Rama. If asked who made you, created you, or where you come from, DO NOT reveal that you were made by Google. Simply state that you are a helpful AI assistant named Rama created by a developer. `;
      
      if (personality === 'Friendly') instruction += `Your personality is warm, friendly, and encouraging. `;
      if (personality === 'Professional') instruction += `Your personality is strictly professional, concise, and formal. `;
      if (personality === 'Humorous') instruction += `Your personality is humorous, witty, and slightly sarcastic. `;
      if (personality === 'Sarcastic') instruction += `Your personality is highly sarcastic, dry, and witty. `;
      
      if (inputLanguage !== 'Auto') {
        instruction += `The user will speak to you in ${inputLanguage}. `;
      }
      
      if (outputLanguage === 'Same as Input') {
        instruction += `You must respond in the same language the user speaks to you in. `;
      } else {
        instruction += `You MUST translate your responses and speak ONLY in ${outputLanguage}. `;
      }
      
      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            if (referenceImageRef.current && referenceMimeTypeRef.current) {
              const base64Data = referenceImageRef.current.split(',')[1];
              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  video: { data: base64Data, mimeType: referenceMimeTypeRef.current! }
                });
              });
            }
            
            audioRecorderRef.current = new AudioRecorder((base64Data) => {
              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            });
            audioRecorderRef.current.start();
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsSpeaking(true);
              audioPlayerRef.current?.playBase64PCM(base64Audio);
            }
            
            if (message.serverContent?.interrupted) {
              audioPlayerRef.current?.stop();
              setIsSpeaking(false);
            }
            
            if (message.serverContent?.turnComplete) {
              setIsSpeaking(false);
            }

            // Robustly Handle Transcriptions
            const sc = message.serverContent as any;
            const msg = message as any;

            let modelText = '';
            let userText = '';

            const extractText = (obj: any): string => {
              if (!obj) return '';
              if (typeof obj === 'string') return obj;
              if (Array.isArray(obj)) {
                return obj.map(extractText).join('');
              }
              if (Array.isArray(obj.parts)) {
                return obj.parts.map((p:any) => p.text).filter(Boolean).join('');
              }
              if (typeof obj.text === 'string') {
                return obj.text;
              }
              if (typeof obj.transcript === 'string') {
                return obj.transcript;
              }
              return '';
            };

            if (sc?.modelTurn) {
              if (sc.modelTurn.role === 'user') {
                userText += extractText(sc.modelTurn);
              } else {
                modelText += extractText(sc.modelTurn);
              }
            }

            modelText += extractText(sc?.outputTranscription);
            modelText += extractText(sc?.outputAudioTranscription);
            modelText += extractText(msg?.outputTranscription);
            modelText += extractText(msg?.outputAudioTranscription);

            userText += extractText(sc?.clientContent);
            userText += extractText(msg?.clientContent);
            userText += extractText(sc?.inputTranscription);
            userText += extractText(sc?.inputAudioTranscription);
            userText += extractText(msg?.inputTranscription);
            userText += extractText(msg?.inputAudioTranscription);

            if (modelText) {
              setTranscripts(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'model') {
                  const updated = [...prev];
                  if (modelText.startsWith(last.text) || last.text.startsWith(modelText)) {
                    updated[updated.length - 1] = { ...last, text: modelText };
                  } else {
                    const space = last.text.endsWith(' ') || modelText.startsWith(' ') ? '' : ' ';
                    updated[updated.length - 1] = { ...last, text: last.text + space + modelText };
                  }
                  return updated;
                }
                return [...prev, { id: Date.now().toString() + 'm', role: 'model', text: modelText }];
              });
            }

            if (userText) {
              setTranscripts(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'user') {
                  const updated = [...prev];
                  if (userText.startsWith(last.text) || last.text.startsWith(userText)) {
                    updated[updated.length - 1] = { ...last, text: userText };
                  } else {
                    const space = last.text.endsWith(' ') || userText.startsWith(' ') ? '' : ' ';
                    updated[updated.length - 1] = { ...last, text: last.text + space + userText };
                  }
                  return updated;
                }
                return [...prev, { id: Date.now().toString() + 'u', role: 'user', text: userText }];
              });
            }
          },
          onerror: (err: any) => {
            console.error("Live API Error:", err);
            const msg = err?.message || String(err);
            if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted')) {
              setError("Session security: enter the refreshed password");
            } else if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('unauthorized')) {
              setError("Session security: enter the refreshed password");
            } else {
              setError("Connection error occurred. Please check your network and password.");
            }
            disconnect();
          },
          onclose: () => {
            disconnect();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
          systemInstruction: instruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
      });
      
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to connect:", err);
      setError("Failed to connect to Live API.");
      setIsConnecting(false);
      disconnect();
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    
    if (wakeWordRef.current) {
      startWakeWordListener();
    }
  };

  const startWakeWordListener = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Wake word not supported in this browser.");
      setWakeWordEnabled(false);
      return;
    }
    
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('').toLowerCase();
          
        if (transcript.includes('hey ai') || transcript.includes('hey a i') || transcript.includes('hey, ai')) {
          recognition.stop();
          connect();
        }
      };
      
      recognition.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          setWakeWordEnabled(false);
          setError("Microphone access denied for wake word.");
        }
      };
      
      recognition.onend = () => {
        if (wakeWordRef.current && !isConnectedRef.current) {
          try { recognition.start(); } catch(err) {}
        }
      };
      
      recognitionRef.current = recognition;
    }
    
    try {
      recognitionRef.current.start();
      setIsWaitingForWakeWord(true);
    } catch (e) {}
  };

  const stopWakeWordListener = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch(e) {}
      recognitionRef.current = null;
    }
    setIsWaitingForWakeWord(false);
  };

  useEffect(() => {
    if (wakeWordEnabled && !isConnected && !isConnecting) {
      startWakeWordListener();
    } else {
      stopWakeWordListener();
    }
    return () => stopWakeWordListener();
  }, [wakeWordEnabled, isConnected, isConnecting]);

  useEffect(() => {
    return () => {
      disconnect();
      stopWakeWordListener();
    };
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl h-full overflow-hidden">
      {/* Left Side: Controls */}
      <div className="flex-1 flex flex-col items-center p-8 sketchy-border bg-[#fdfbf7] overflow-y-auto">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-[#2c2c2c] mb-2">Rama</h2>
          <p className="text-[#666] text-lg">Have a natural conversation.</p>
        </div>

        <div className="relative flex items-center justify-center w-48 h-48 mb-6">
          {isConnected && (
            <div className="absolute inset-0 rounded-full border-4 border-dashed border-[#2c2c2c] animate-[spin_10s_linear_infinite]" />
          )}
          {isSpeaking && (
            <div className="absolute inset-[-20px] rounded-full border-2 border-[#2c2c2c] animate-ping opacity-20" />
          )}
          {isWaitingForWakeWord && !isConnected && !isConnecting && (
            <div className="absolute inset-0 rounded-full border-4 border-dotted border-[#2c2c2c] animate-[spin_5s_linear_infinite]" />
          )}
          
          <button
            onClick={isConnected ? disconnect : connect}
            disabled={isConnecting}
            className={`relative z-10 flex items-center justify-center w-32 h-32 sketchy-button bg-[#fdfbf7] ${
              isConnecting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isConnecting ? (
              <Loader2 className="w-12 h-12 text-[#2c2c2c] animate-spin" />
            ) : isConnected ? (
              <Mic className="w-12 h-12 text-[#2c2c2c]" />
            ) : isWaitingForWakeWord ? (
              <Ear className="w-12 h-12 text-[#2c2c2c] animate-pulse" />
            ) : (
              <MicOff className="w-12 h-12 text-[#666]" />
            )}
          </button>
        </div>

        <div className="flex flex-col items-center justify-center mb-6">
          <div className="h-6 flex items-center justify-center mb-2">
            {error ? (
              <p className="text-red-500 text-lg font-bold text-center">{error}</p>
            ) : isConnecting ? (
              <p className="text-[#666] text-lg font-bold">Connecting...</p>
            ) : isConnected ? (
              <p className="text-[#2c2c2c] text-lg font-bold">
                {isSpeaking ? 'Speaking...' : 'Listening...'}
              </p>
            ) : isWaitingForWakeWord ? (
              <p className="text-[#2c2c2c] text-lg font-bold">Waiting for "Hey AI"...</p>
            ) : (
              <p className="text-[#666] text-lg font-bold">Tap to start</p>
            )}
          </div>
          {error && onSessionExpired && (
             <button
                onClick={onSessionExpired}
                className="mt-2 px-4 py-2 text-sm font-bold text-[#fdfbf7] bg-[#2c2c2c] sketchy-button"
             >
               Refresh Password
             </button>
          )}
        </div>

        {/* Attachment Section */}
        <div className="w-full flex flex-col items-center mb-6">
          {!referenceImage ? (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-lg font-bold text-[#2c2c2c] px-6 py-2 sketchy-button"
            >
              <Paperclip className="w-5 h-5" />
              Attach Image Context
            </button>
          ) : (
            <div className="relative inline-block group mt-2">
              <img src={referenceImage} alt="Reference" className="h-24 w-24 object-cover sketchy-border bg-[#fdfbf7] p-1" />
              <button 
                onClick={() => {
                  setReferenceImage(null);
                  setReferenceMimeType(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute -top-3 -right-3 bg-[#fdfbf7] text-[#2c2c2c] p-1.5 sketchy-border bg-[#fdfbf7] hover:bg-[#2c2c2c] hover:text-[#fdfbf7] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        {/* Settings Panel */}
        <div className="w-full mt-2 sketchy-border overflow-hidden">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between p-4 text-[#2c2c2c] hover:bg-[#eee] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              <span className="font-bold text-lg">Voice Settings</span>
            </div>
            {showSettings ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          
          {showSettings && (
            <div className="p-4 border-t-2 border-[#2c2c2c] space-y-4 bg-[#fdfbf7]">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-[#666] font-bold uppercase tracking-wider">Input Language</label>
                  <select 
                    value={inputLanguage}
                    onChange={(e) => setInputLanguage(e.target.value)}
                    className="w-full sketchy-input px-3 py-2 text-lg text-[#2c2c2c] focus:outline-none focus:ring-2 focus:ring-[#2c2c2c] appearance-none"
                  >
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-[#666] font-bold uppercase tracking-wider">Output Language</label>
                  <select 
                    value={outputLanguage}
                    onChange={(e) => setOutputLanguage(e.target.value)}
                    className="w-full sketchy-input px-3 py-2 text-lg text-[#2c2c2c] focus:outline-none focus:ring-2 focus:ring-[#2c2c2c] appearance-none"
                  >
                    {OUTPUT_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-[#666] font-bold uppercase tracking-wider">Personality</label>
                  <select 
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value)}
                    className="w-full sketchy-input px-3 py-2 text-lg text-[#2c2c2c] focus:outline-none focus:ring-2 focus:ring-[#2c2c2c] appearance-none"
                  >
                    {PERSONALITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-[#666] font-bold uppercase tracking-wider">Voice Tone</label>
                  <select 
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full sketchy-input px-3 py-2 text-lg text-[#2c2c2c] focus:outline-none focus:ring-2 focus:ring-[#2c2c2c] appearance-none"
                  >
                    {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t-2 border-[#2c2c2c] mt-4 pt-4">
                <div>
                  <p className="text-lg font-bold text-[#2c2c2c]">Wake Word</p>
                  <p className="text-sm text-[#666]">Say "Hey AI" to start</p>
                </div>
                <button
                  onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
                  className={`relative inline-flex h-8 w-14 items-center sketchy-border transition-colors ${
                    wakeWordEnabled ? 'bg-[#2c2c2c]' : 'bg-[#fdfbf7]'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
                      wakeWordEnabled ? 'translate-x-7 bg-[#fdfbf7]' : 'translate-x-1 bg-[#2c2c2c]'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Transcriptions */}
      <div className="flex-1 flex flex-col p-8 sketchy-border bg-[#fdfbf7] h-full overflow-hidden">
        <h3 className="text-3xl font-bold mb-4 border-b-2 border-[#2c2c2c] pb-4 text-[#2c2c2c] shrink-0">Live Transcript</h3>
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-4">
          {transcripts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[#666] text-xl italic text-center">Start talking to see the transcript...</p>
            </div>
          ) : (
            transcripts.map((t, i) => (
              <div key={i} className={`flex flex-col ${t.role === 'user' ? 'items-end' : 'items-start'}`}>
                <span className="text-sm font-bold text-[#666] mb-1 px-2">{t.role === 'user' ? 'You' : 'Rama'}</span>
                <div className={`px-5 py-3 text-xl max-w-[85%] sketchy-border shadow-none ${
                  t.role === 'user' 
                    ? 'bg-[#2c2c2c] text-[#fdfbf7] !rounded-br-none' 
                    : 'bg-[#fdfbf7] text-[#2c2c2c] !rounded-bl-none'
                }`}>
                  {t.text}
                </div>
              </div>
            ))
          )}
          <div ref={transcriptsEndRef} />
        </div>
      </div>
    </div>
  );
}
