import { useState } from 'react';
import { VoiceChat } from './components/VoiceChat';
import { ImageAnalysis } from './components/ImageAnalysis';
import { Mic, Image as ImageIcon, KeyRound } from 'lucide-react';
import { initAI } from './lib/ai';

export default function App() {
  const [activeTab, setActiveTab] = useState<'voice' | 'image'>('voice');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim().length === 39) {
      initAI(password.trim());
      setIsAuthenticated(true);
      setPassword(''); // Clear the password from memory/state
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex flex-col items-center justify-center py-6 px-4 font-sans relative overflow-hidden bg-[#fdfbf7]">
        <div className="w-full max-w-md p-8 sketchy-border bg-[#fdfbf7] flex flex-col items-center">
          <KeyRound className="w-16 h-16 text-[#2c2c2c] mb-6" />
          <h1 className="text-3xl font-bold text-[#2c2c2c] mb-2 text-center">Welcome</h1>
          <p className="text-[#666] text-lg mb-8 text-center">Please enter your password to continue.</p>
          
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Password..."
              className="w-full sketchy-input px-4 py-3 text-xl text-[#2c2c2c] focus:outline-none focus:ring-2 focus:ring-[#2c2c2c]"
              autoFocus
            />
            {password.trim().length > 0 && password.trim().length !== 39 && (
              <p className="text-red-600 font-bold text-sm text-center -mt-2">
                Enter exact 39 char password only (currently {password.trim().length}).
              </p>
            )}
            <button
              type="submit"
              disabled={password.trim().length !== 39}
              className={`w-full py-3 text-xl font-bold flex items-center justify-center gap-2 sketchy-button ${
                password.trim().length !== 39 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col items-center py-6 px-4 font-sans relative overflow-hidden">
      <div className="relative z-10 w-full max-w-6xl flex flex-col items-center h-full min-h-0">
        <div className="flex gap-4 mb-6 shrink-0">
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-2 px-6 py-2.5 text-lg font-bold transition-all duration-300 sketchy-button ${
              activeTab === 'voice' ? 'bg-[#2c2c2c] text-[#fdfbf7]' : 'bg-[#fdfbf7] text-[#2c2c2c]'
            }`}
          >
            <Mic className="w-5 h-5" />
            Voice Chat
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`flex items-center gap-2 px-6 py-2.5 text-lg font-bold transition-all duration-300 sketchy-button ${
              activeTab === 'image' ? 'bg-[#2c2c2c] text-[#fdfbf7]' : 'bg-[#fdfbf7] text-[#2c2c2c]'
            }`}
          >
            <ImageIcon className="w-5 h-5" />
            Image Analysis
          </button>
        </div>

        <main className="w-full flex-1 flex justify-center overflow-hidden min-h-0">
          {activeTab === 'voice' ? (
            <VoiceChat onSessionExpired={() => setIsAuthenticated(false)} />
          ) : (
            <ImageAnalysis onSessionExpired={() => setIsAuthenticated(false)} />
          )}
        </main>
      </div>
    </div>
  );
}
