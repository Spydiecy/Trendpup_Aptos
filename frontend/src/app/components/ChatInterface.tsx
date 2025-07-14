'use client';

import { useState, useEffect, useRef } from 'react';
import { IoSendSharp, IoMicSharp, IoMicOffSharp } from 'react-icons/io5';
import { FaDog, FaUser } from 'react-icons/fa';
import { HiSpeakerWave, HiSpeakerXMark } from 'react-icons/hi2';
import Image from 'next/image';

interface Message {
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  fullPage?: boolean;
}

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
    };
  }
}

export default function ChatInterface({ fullPage = false }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [synthesis, setSynthesis] = useState<SpeechSynthesis | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize speech recognition and synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Initialize speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          inputRef.current?.focus();
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event);
          setIsListening(false);
        };

        setRecognition(recognition);
      }

      // Initialize speech synthesis
      if (window.speechSynthesis) {
        setSynthesis(window.speechSynthesis);
      }
    }
  }, []);

  // Ping the agent backend once on app load to ensure the agent process is started
  if (typeof window !== 'undefined') {
    fetch('/api/vertex-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '__ping__' })
    }).catch(() => {});
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startVoiceInput = () => {
    if (recognition && !isListening) {
      recognition.start();
    }
  };

  const stopVoiceInput = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
  };

  const speakText = (text: string) => {
    if (synthesis && voiceEnabled && text.trim()) {
      // Cancel any ongoing speech
      synthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      // Try to use a pleasant voice if available
      const voices = synthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.name.includes('Female') || 
        voice.name.includes('Samantha') ||
        voice.name.includes('Google US English')
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      synthesis.speak(utterance);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const messageText = input.trim();
    setMessages(prev => [...prev, {
      type: 'user',
      content: messageText,
      timestamp: new Date()
    }]);
    setIsTyping(true);
    setInput('');
    inputRef.current?.focus();
    let assistantMsg = '';
    let assistantMsgIdx = -1;
    try {
      const res = await fetch('/api/vertex-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });
      const data = await res.json();
      assistantMsg = data.response || data.error || '';
      setMessages(prev => {
        assistantMsgIdx = prev.length;
        return [
          ...prev,
          {
            type: 'assistant',
            content: assistantMsg,
            timestamp: new Date()
          }
        ];
      });
      
      // Speak the assistant's response if voice is enabled
      if (voiceEnabled && assistantMsg) {
        // Small delay to ensure the message is rendered
        setTimeout(() => {
          speakText(assistantMsg);
        }, 100);
      }
    } catch (error: any) {
      const errorMsg = `Error: ${error.message || 'Failed to contact agent.'}`;
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: errorMsg,
        timestamp: new Date()
      }]);
      
      if (voiceEnabled) {
        setTimeout(() => {
          speakText(errorMsg);
        }, 100);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const containerHeight = fullPage ? 'h-[calc(100vh-8rem)]' : 'h-[calc(100vh-12rem)]';

  return (
    <div className={`flex flex-col ${containerHeight} max-w-4xl mx-auto rounded-xl shadow-xl overflow-hidden border border-trendpup-brown/20 bg-white`}>
      {!fullPage && (
        <div className="bg-trendpup-dark text-white p-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-3">
              <Image 
                src="/trendpup-logo.png" 
                alt="TrendPup Logo" 
                width={32} 
                height={32}
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold">TrendPup Assistant</h1>
              <p className="text-sm opacity-75">
                Connected to TrendPup Agent - Ready to chat
              </p>
            </div>
          </div>
          
          {/* Voice Output Toggle */}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              voiceEnabled 
                ? 'bg-trendpup-orange hover:bg-orange-600' 
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
            title={voiceEnabled ? 'Disable voice output' : 'Enable voice output'}
          >
            {voiceEnabled ? (
              <HiSpeakerWave className="text-xl" />
            ) : (
              <HiSpeakerXMark className="text-xl" />
            )}
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-trendpup-light">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start max-w-[80%] ${msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                  msg.type === 'user' ? 'bg-trendpup-orange ml-2' : 'bg-trendpup-brown mr-2'
                }`}>
                  {msg.type === 'user' ? (
                    <FaUser className="text-white text-sm" />
                  ) : (
                    <FaDog className="text-white text-sm" />
                  )}
                </div>
                <div
                  className={`rounded-lg p-3 ${
                    msg.type === 'user'
                      ? 'bg-trendpup-orange text-white'
                      : 'bg-white text-trendpup-dark border border-trendpup-brown/20'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <span className="text-xs opacity-75 mt-1 block">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-trendpup-brown mr-2 flex items-center justify-center">
                  <FaDog className="text-white text-sm" />
                </div>
                <div className="bg-white text-gray-800 rounded-lg p-3 border border-trendpup-brown/20">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-trendpup-brown rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-trendpup-brown rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-trendpup-brown rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-trendpup-brown/10">
        <div className="flex items-end space-x-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Ask about memecoins, trends, or market insights..." : "Connecting..."}
            disabled={!isConnected}
            className="flex-1 p-3 border border-trendpup-brown/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-trendpup-orange resize-none h-12 max-h-32 min-h-[3rem]"
            rows={1}
          />
          
          {/* Microphone Button */}
          {recognition && (
            <button
              onClick={isListening ? stopVoiceInput : startVoiceInput}
              disabled={!isConnected}
              className={`p-3 rounded-lg transition-colors ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : 'bg-gray-500 hover:bg-gray-600'
              } text-white disabled:bg-gray-400 disabled:cursor-not-allowed`}
              title={isListening ? 'Stop recording' : 'Start voice input'}
            >
              {isListening ? (
                <IoMicOffSharp className="text-xl" />
              ) : (
                <IoMicSharp className="text-xl" />
              )}
            </button>
          )}
          
          {/* Send Button */}
          <button
            onClick={sendMessage}
            disabled={!isConnected || !input.trim()}
            className="p-3 bg-trendpup-orange text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <IoSendSharp className="text-xl" />
          </button>
        </div>
        
        {/* Voice Input Status */}
        {isListening && (
          <div className="mt-2 text-sm text-red-600 flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
            Listening... Speak now
          </div>
        )}
      </div>
    </div>
  );
}