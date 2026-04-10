import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Upload, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Settings2, ChevronUp, ChevronDown } from 'lucide-react';
import { ai } from '../lib/ai';

interface ImageAnalysisProps {
  onSessionExpired?: () => void;
}

export function ImageAnalysis({ onSessionExpired }: ImageAnalysisProps) {
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('models/gemini-2.0-flash');
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const modelPager = await ai.models.list();
        const models = [];
        for await (const model of modelPager) {
          // Filter for gemini models
          if (model.name.includes('gemini')) {
             models.push(model);
          }
        }
        setAvailableModels(models);
        
        // Prefer latest models or stick with a default
        const defaultModel = models.find(m => m.name.includes('2.0-flash')) || 
                             models.find(m => m.name.includes('1.5-flash')) || 
                             models[0];
        if (defaultModel) setSelectedModel(defaultModel.name);
      } catch (err: any) {
        console.error("Failed to fetch models:", err);
        const msg = err?.message || String(err);
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted')) {
          setError("Session security: enter the refreshed password");
        } else if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('unauthorized') || err?.status === 401 || err?.status === 403) {
          setError("Session security: enter the refreshed password");
        }
      }
    };
    fetchModels();
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImage(result);
      setMimeType(file.type);
      setAnalysis(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!image || !mimeType) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const base64Data = image.split(',')[1];

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              },
              {
                text: 'Analyze this image in detail. What do you see?',
              },
            ],
          },
        ],
      });

      setAnalysis(response.text || "No analysis generated.");
    } catch (err: any) {
      console.error("Analysis error details:", {
        message: err.message,
        status: err.status,
        name: err.name,
        stack: err.stack
      });
      const msg = err?.message || String(err);
      if (err?.status === 429 || msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted')) {
        setError("Session security: enter the refreshed password");
      } else if (err?.status === 401 || err?.status === 403 || msg.includes('401') || msg.includes('403')) {
        setError("Session security: enter the refreshed password");
      } else {
        setError(`Failed to analyze image: ${err.message || "Unknown error"}. Please try again.`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setMimeType(null);
    setAnalysis(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center p-8 sketchy-border max-w-4xl w-full mx-auto h-full overflow-y-auto">
      <div className="mb-8 text-center shrink-0">
        <h2 className="text-4xl font-bold text-[#2c2c2c] mb-2">Image Analysis</h2>
        <p className="text-[#666] text-xl">Upload a photo to get a detailed description.</p>
      </div>

      {!image ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-64 border-4 border-dashed border-[#2c2c2c] rounded-[2rem] flex flex-col items-center justify-center cursor-pointer bg-[#fdfbf7] hover:bg-[#eee] transition-all duration-300 group"
        >
          <div className="w-20 h-20 rounded-full sketchy-border flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-300">
            <Upload className="w-10 h-10 text-[#2c2c2c]" />
          </div>
          <p className="text-[#2c2c2c] text-2xl font-bold">Click to upload image</p>
          <p className="text-[#666] text-lg mt-2">Supports JPG, PNG, WEBP</p>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center">
          <div className="relative w-full max-w-xl sketchy-border p-2 mb-8 bg-[#fdfbf7]">
            <img src={image} alt="Uploaded" className="w-full h-auto object-contain max-h-96" />
            <button
              onClick={reset}
              className="absolute -top-4 -right-4 p-3 bg-[#fdfbf7] hover:bg-[#2c2c2c] hover:text-[#fdfbf7] text-[#2c2c2c] transition-colors sketchy-border"
            >
              <RefreshCw className="w-6 h-6" />
            </button>
          </div>

          <div className="w-full max-w-xl mb-6 sketchy-border overflow-hidden">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between p-4 text-[#2c2c2c] hover:bg-[#eee] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                <span className="font-bold text-lg">Analysis Settings</span>
              </div>
              {showSettings ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            
            {showSettings && (
              <div className="p-4 border-t-2 border-[#2c2c2c] bg-[#fdfbf7]">
                <label className="block text-sm font-bold text-[#666] mb-2 uppercase tracking-wider">AI Model Selection</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full p-3 text-lg font-bold sketchy-input appearance-none bg-[#fdfbf7] focus:outline-none focus:ring-2 focus:ring-[#2c2c2c]"
                >
                  {availableModels.length === 0 ? (
                    <option value={selectedModel}>Loading models...</option>
                  ) : (
                    availableModels.map(model => (
                      <option key={model.name} value={model.name}>
                        {model.name.replace('models/', '')} - {model.displayName}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>

          {!analysis && !isAnalyzing && (
            <button
              onClick={analyzeImage}
              className="px-10 py-4 text-2xl font-bold flex items-center gap-3 sketchy-button"
            >
              <ImageIcon className="w-8 h-8" />
              Analyze Image
            </button>
          )}

          {isAnalyzing && (
            <div className="flex items-center gap-4 text-[#2c2c2c] py-4 px-8 sketchy-border">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="font-bold text-xl">Analyzing image...</span>
            </div>
          )}

          {error && (
            <div className="w-full flex flex-col items-center p-6 sketchy-border border-red-500 text-red-600 mt-4">
              <span className="text-xl font-bold text-center mb-4">{error}</span>
              {onSessionExpired && error.includes('Session security') && (
                <button
                  onClick={onSessionExpired}
                  className="px-6 py-2 text-lg font-bold text-[#fdfbf7] bg-[#2c2c2c] sketchy-button"
                >
                  Refresh Password
                </button>
              )}
            </div>
          )}

          {analysis && (
            <div className="w-full mt-8 p-8 sketchy-border bg-[#fdfbf7]">
              <h3 className="text-3xl font-bold text-[#2c2c2c] mb-6 flex items-center gap-3 border-b-2 border-[#2c2c2c] pb-4">
                <Sparkles className="w-8 h-8" />
                Analysis Result
              </h3>
              <div className="prose prose-lg max-w-none text-[#2c2c2c] text-xl leading-relaxed font-sans">
                {analysis.split('\n').map((paragraph, idx) => (
                  <p key={idx} className="mb-4 last:mb-0">{paragraph}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
