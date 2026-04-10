export class AudioPlayer {
  context: AudioContext;
  nextPlayTime: number;
  sources: AudioBufferSourceNode[] = [];

  constructor() {
    this.context = new AudioContext({ sampleRate: 24000 });
    this.nextPlayTime = this.context.currentTime;
  }

  playBase64PCM(base64: string) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = this.context.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.context.destination);

    const startTime = Math.max(this.nextPlayTime, this.context.currentTime);
    source.start(startTime);
    this.nextPlayTime = startTime + audioBuffer.duration;
    this.sources.push(source);
    
    source.onended = () => {
      this.sources = this.sources.filter(s => s !== source);
    };
  }

  stop() {
    this.sources.forEach(source => source.stop());
    this.sources = [];
    this.nextPlayTime = this.context.currentTime;
  }
}

const pcmProcessorCode = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.offset = 0;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.offset++] = channelData[i];
        if (this.offset >= this.buffer.length) {
          this.port.postMessage(this.buffer);
          this.buffer = new Float32Array(4096);
          this.offset = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

export class AudioRecorder {
  context: AudioContext | null = null;
  stream: MediaStream | null = null;
  workletNode: AudioWorkletNode | null = null;
  source: MediaStreamAudioSourceNode | null = null;
  onData: (base64: string) => void;

  constructor(onData: (base64: string) => void) {
    this.onData = onData;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: {
      channelCount: 1,
      sampleRate: 16000,
    } });
    this.context = new AudioContext({ sampleRate: 16000 });
    
    const blob = new Blob([pcmProcessorCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await this.context.audioWorklet.addModule(url);
    
    this.source = this.context.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.context, 'pcm-processor');
    
    this.workletNode.port.onmessage = (event) => {
      const float32Array = event.data as Float32Array;
      const buffer = new ArrayBuffer(float32Array.length * 2);
      const view = new DataView(buffer);
      let offset = 0;
      for (let i = 0; i < float32Array.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
      
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = window.btoa(binary);
      this.onData(base64);
    };
    
    const gainNode = this.context.createGain();
    gainNode.gain.value = 0;
    this.workletNode.connect(gainNode);
    gainNode.connect(this.context.destination);
    this.source.connect(this.workletNode);
  }

  stop() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}
