import React, { useState, useEffect, useRef } from 'react';
import { Message, Model, Provider } from '../types';

import { PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODEL } from '../config/models';
import { CodeExecutionService, detectLanguage } from '../services/CodeExecutionService';
import { GoogleGenAIService } from '../services/GoogleGenAIService';
import { OpenRouterService } from '../services/OpenRouterService';
import { ImageGenerationService } from '../services/ImageGenerationService';
import { MidjourneyService } from '../services/MidjourneyService';
import { FileAnalysisService } from '../services/FileAnalysisService';
import { WebSearchService } from '../services/WebSearchService';
import { MessageBubble } from './MessageBubble';
import { ModelSelector } from './ModelSelector';
import { ProviderSelector } from './ProviderSelector';
import { WelcomeScreen } from './WelcomeScreen';
import { EnhancedFileUpload } from './EnhancedFileUpload';
import { Send, Image as ImageIcon, Paperclip, X, Globe, Sparkles, Zap } from 'lucide-react';
import { MainWorkspace } from './MainWorkspace';
import ImageStyleSelector from './ImageStyleSelector';

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  preview?: string;
  analysis?: string;
  uploadedFile?: { uri: string; mimeType: string; name: string };
}

// Constants for context management
const MAX_FILE_CONTENT_CHARS = 50000;
const MAX_CONVERSATION_HISTORY_MESSAGES = 10;

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<Provider>(DEFAULT_PROVIDER);
  const [model, setModel] = useState<Model>(DEFAULT_MODEL);
  const [workspaceFiles, setWorkspaceFiles] = useState<{ code: string; language: string }[]>([]);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [executionState, setExecutionState] = useState<{
    isRunning: boolean;
    output: string;
  }>({ isRunning: false, output: '' });
  const [input, setInput] = useState('');
  const [imageStyle, setImageStyle] = useState(1);
  const [imageSize, setImageSize] = useState('1-1');
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const openRouterService = useRef(new OpenRouterService()).current;
  const googleAIService = useRef(new GoogleGenAIService()).current;
  const imageGenerationService = useRef(new ImageGenerationService()).current;
  const midjourneyService = useRef(new MidjourneyService()).current;
  const fileAnalysisService = useRef<FileAnalysisService | null>(null);
  const webSearchService = useRef(new WebSearchService()).current;

  // Initialize file analysis service
  useEffect(() => {
    try {
      fileAnalysisService.current = new FileAnalysisService();
    } catch (error) {
      console.warn('File analysis service not available:', error);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    const newModel = newProvider.models[0];
    setModel(newModel);
  };

  const handleModelChange = (newModel: Model) => {
    setModel(newModel);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleFilesUploaded = (files: UploadedFile[]) => {
    setUploadedFiles(files);
  };

  const formatFilesForMessage = (files: UploadedFile[]): string => {
    if (files.length === 0) return '';
    
    let filesText = '\n\n--- Uploaded Files ---\n';
    files.forEach((file, index) => {
      filesText += `\n${index + 1}. **${file.name}** (${file.type}, ${formatFileSize(file.size)})\n`;
      
      // Show analysis if available
      if (file.analysis) {
        filesText += `\n${file.analysis}\n\n`;
      } else {
        // For text files, include content
        if (file.type.startsWith('text/') || 
            file.type.includes('json') || 
            file.type.includes('csv') ||
            file.name.endsWith('.md') ||
            file.name.endsWith('.txt') ||
            file.name.endsWith('.json') ||
            file.name.endsWith('.csv')) {
          
          let content = file.content;
          let truncated = false;
          
          if (content.length > MAX_FILE_CONTENT_CHARS) {
            content = content.substring(0, MAX_FILE_CONTENT_CHARS);
            truncated = true;
          }
          
          filesText += `Content:\n\`\`\`\n${content}\n\`\`\`\n`;
          
          if (truncated) {
            filesText += `[Content truncated - showing first ${MAX_FILE_CONTENT_CHARS} characters of ${file.content.length} total]\n`;
          }
        } else if (file.type.startsWith('image/')) {
          filesText += `[Image file: ${file.name}]\n`;
        } else {
          filesText += `[File: ${file.name} - ${file.type}]\n`;
        }
      }
    });
    
    return filesText;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleWebSearch = async () => {
    if (!input.trim()) return;

    setIsSearching(true);
    const now = Date.now();
    
    const userMessage: Message = {
      id: `user-search-${now}`,
      role: 'user',
      content: `🌐 Web search: ${input}`,
      timestamp: new Date(now),
    };

    const loadingMessageId = `loading-search-${Date.now()}`;
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: 'assistant',
      content: '',
      isLoading: true,
      timestamp: new Date(),
      model: 'web-search',
    };
    
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    const searchQuery = input;
    setInput('');

    try {
      const searchResults = await webSearchService.search(searchQuery);
      
      let responseText = `## 🌐 Web Search Results for: "${searchQuery}"\n\n`;
      
      if (searchResults.results && searchResults.results.length > 0) {
        searchResults.results.forEach((result, index) => {
          responseText += `### ${index + 1}. ${result.title}\n`;
          responseText += `${result.snippet}\n\n`;
          responseText += `🔗 **Source:** [${result.url}](${result.url})\n\n`;
          responseText += `---\n\n`;
        });
        
        if (searchResults.total_results) {
          responseText += `\n*📊 Found ${searchResults.total_results} total results*`;
        }
      } else {
        responseText += '❌ No search results found for this query.';
      }

      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessageId 
            ? { 
                ...msg, 
                content: responseText, 
                isLoading: false 
              } 
            : msg
        )
      );
    } catch (error: any) {
      console.error('Error performing web search:', error);
      const errorMessage: Message = {
        id: loadingMessageId,
        role: 'assistant',
        content: `❌ Web search failed: ${error.message}`,
        isError: true,
        timestamp: new Date(),
        model: 'web-search',
      };
      setMessages(prev => [...prev.filter(msg => msg.id !== loadingMessageId), errorMessage]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;
    
    // If web search is enabled, perform search instead
    if (isWebSearchEnabled && input.trim()) {
      await handleWebSearch();
      return;
    }
    
    if (provider.id === 'rapidapi') {
      handleGenerateImage();
      return;
    }

    const now = Date.now();
    let messageContent = input;
    
    // Check if we have files with Google AI uploads
    const filesWithUploads = uploadedFiles.filter(f => f.uploadedFile);
    
    if (filesWithUploads.length > 0 && provider.id === 'google') {
      // Use Google AI's file upload API for better handling
      const userMessage: Message = {
        id: `user-${now}`,
        role: 'user',
        content: `${messageContent}\n\n--- Files Attached ---\n${uploadedFiles.map(f => f.name).join(', ')}`,
        timestamp: new Date(now),
      };

      const loadingMessageId = `loading-${Date.now()}`;
      const loadingMessage: Message = {
        id: loadingMessageId,
        role: 'assistant',
        content: '',
        isLoading: true,
        timestamp: new Date(),
        model: model.id,
      };
      
      setMessages(prev => [...prev, userMessage, loadingMessage]);
      setIsLoading(true);
      setInput('');
      setUploadedFiles([]);

      try {
        const responseText = await googleAIService.generateContentWithFiles(
          messageContent,
          filesWithUploads.map(f => f.uploadedFile!),
          model.id
        );

        setMessages(prev => 
          prev.map(msg => 
            msg.id === loadingMessageId 
              ? { 
                  ...msg, 
                  content: responseText, 
                  isLoading: false 
                } 
              : msg
          )
        );
      } catch (error: any) {
        console.error('Error sending message with files:', error);
        const errorMessage: Message = {
          id: loadingMessageId,
          role: 'assistant',
          content: `❌ Error: ${error.message}`,
          isError: true,
          timestamp: new Date(),
          model: model.id,
        };
        setMessages(prev => [...prev.filter(msg => msg.id !== loadingMessageId), errorMessage]);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // Fallback to regular message handling
    messageContent += formatFilesForMessage(uploadedFiles);
    
    const userMessage: Message = {
      id: `user-${now}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date(now),
    };

    const loadingMessageId = `loading-${Date.now()}`;
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: 'assistant',
      content: '',
      isLoading: true,
      timestamp: new Date(),
      model: model.id,
    };
    
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);
    setInput('');
    setUploadedFiles([]);

    try {
      let responseText = '';
      
      const recentMessages = messages.slice(-MAX_CONVERSATION_HISTORY_MESSAGES);
      const conversationHistory = recentMessages.map(msg => ({ 
        role: msg.role, 
        content: msg.content || '' 
      }));
      
      const currentMessages = [...conversationHistory, { role: 'user' as const, content: messageContent }];
      
      if (provider.id === 'openrouter') {
        responseText = await openRouterService.generateText(
          model.id, 
          currentMessages
        );
      } else if (provider.id === 'google') {
        responseText = await googleAIService.generateText(
          currentMessages, 
          model.id
        );
      }

      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessageId 
            ? { 
                ...msg, 
                content: responseText, 
                isLoading: false 
              } 
            : msg
        )
      );
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: loadingMessageId,
        role: 'assistant',
        content: `❌ Error: ${error.message}`,
        isError: true,
        timestamp: new Date(),
        model: model.id,
      };
      setMessages(prev => [...prev.filter(msg => msg.id !== loadingMessageId), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!input.trim()) return;
    
    if (provider.id !== 'rapidapi') {
      const now = Date.now();
      const errorMessage: Message = {
        id: `error-${now}`,
        role: 'assistant',
        content: '❌ Please select the Image Generation provider to generate images.',
        timestamp: new Date(now),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    const now = Date.now();
    const userMessage: Message = {
      id: `user-img-${now}`,
      role: 'user',
      content: `🎨 Image prompt: ${input}`,
      timestamp: new Date(now),
    };

    const isMidjourney = model.id.includes('midjourney');
    
    const loadingMessageId = `loading-img-${Date.now()}`;
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: 'assistant',
      content: '',
      isLoading: true,
      timestamp: new Date(),
      model: isMidjourney ? 'rapidapi/midjourney' : 'rapidapi/flux',
    };
    
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);
    const currentInput = input;
    setInput('');

    try {
      let imageUrl: string;
      
      if (isMidjourney) {
        console.log('Generating Midjourney image with prompt:', currentInput);
        const result = await midjourneyService.generateImage(currentInput, {
          width: 1024,
          height: 1024,
          guidance_scale: 7.5,
          num_inference_steps: 30,
          upscale: true
        });
        imageUrl = result;
      } else {
        imageUrl = await imageGenerationService.generateImage(currentInput, {
          style_id: imageStyle,
          size: imageSize
        });
      }

      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessageId 
            ? { 
                ...msg, 
                content: isMidjourney ? '🎨 Generated Midjourney image:' : '🎨 Generated image:', 
                images: [imageUrl],
                isLoading: false 
              } 
            : msg
        )
      );
    } catch (error: any) {
      console.error('Error generating image:', error);
      const errorMessage: Message = {
        id: loadingMessageId,
        role: 'assistant',
        content: `❌ Sorry, I encountered an error generating the image: ${error.message}`,
        isError: true,
        timestamp: new Date(),
        model: isMidjourney ? 'rapidapi/midjourney' : 'rapidapi/flux',
      };
      setMessages(prev => [...prev.filter(msg => msg.id !== loadingMessageId), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewCode = (files: { code: string; language: string }[]) => {
    setWorkspaceFiles(files);
    setShowWorkspace(true);
    setExecutionState({ isRunning: false, output: '' });
  };

  const handleRunCode = async (code: string, language: string, input: string = '') => {
    try {
      setExecutionState({ isRunning: true, output: 'Running code...' });
      
      const lang = detectLanguage(code, language);
      console.log(`Detected language: ${lang.name} (ID: ${lang.id})`);
      
      let processedCode = code;
      
      if (lang.id === 62) {
        if (!code.includes('public class Main')) {
          const className = code.match(/class\s+(\w+)/)?.[1] || 'Main';
          processedCode = `public class ${className} {
    public static void main(String[] args) {
${code.split('\n').map(line => `        ${line}`).join('\n')}
    }
}`;
        }
      } else if (lang.id === 71 || lang.id === 70) {
        processedCode = code.replace(/print\s+(?![(])/g, 'print(') + '\n';
      }
      
      console.log('Executing code with language:', lang.name);
      
      const result = await CodeExecutionService.executeCode(processedCode, lang.id, input);
      
      let output = '';
      if (input) output += `Input:\n${input}\n\n`;
      if (result.stdout) output += `Output:\n${result.stdout}\n\n`;
      if (result.stderr) output += `Error:\n${result.stderr}\n\n`;
      if (result.compile_output) output += `Compile Output:\n${result.compile_output}\n\n`;
      if (result.message) output += `Message: ${result.message}\n`;
      
      if (!output.trim()) {
        output = 'Code executed successfully with no output';
      }
      
      setExecutionState({
        isRunning: false,
        output: output.trim()
      });
      
    } catch (error) {
      console.error('Execution error:', error);
      let errorMessage = 'Failed to execute code';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes('timeout') || errorMessage.includes('Time limit exceeded')) {
          errorMessage = 'Execution timed out. Your code took too long to run.';
        } else if (errorMessage.includes('memory') || errorMessage.includes('Memory limit exceeded')) {
          errorMessage = 'Memory limit exceeded. Your code used too much memory.';
        } else if (errorMessage.includes('NZEC')) {
          errorMessage = 'Runtime error. Your code exited with an error. Check for syntax errors or unhandled exceptions.';
        } else if (errorMessage.includes('compilation error')) {
          errorMessage = 'Compilation error. Please check your code for syntax errors.';
        }
      }
      
      setExecutionState({
        isRunning: false,
        output: `Error: ${errorMessage}\n\nIf you need help, try:\n- Checking for syntax errors\n- Adding print statements for debugging\n- Making sure all variables are defined\n- Verifying input/output formats`
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden main-container">
      {/* Header */}
      <div className="relative z-10 flex-shrink-0 border-b border-gray-700 bg-gray-900/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              AI Chat
            </h1>
            <div className="flex items-center space-x-3">
              <ProviderSelector
                providers={PROVIDERS}
                currentProvider={provider}
                onProviderChange={handleProviderChange}
              />
              <ModelSelector
                models={provider.models}
                currentModel={model}
                onModelChange={handleModelChange}
              />
              {provider.id === 'rapidapi' && model.id === 'rapidapi-flux' && (
                <ImageStyleSelector
                  onSelect={(styleId: number, size: string) => {
                    setImageStyle(styleId);
                    setImageSize(size);
                  }}
                  selectedStyle={imageStyle}
                  selectedSize={imageSize}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onViewCode={handleViewCode} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* File Upload Area */}
      {showFileUpload && (
        <div className="border-t border-gray-700 bg-gray-800/95 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto p-4">
            <EnhancedFileUpload
              onFilesUploaded={handleFilesUploaded}
              onClose={() => setShowFileUpload(false)}
              maxFiles={5}
              maxSizeInMB={10}
              acceptedTypes={['image/*', 'text/*', '.pdf', '.doc', '.docx', '.json', '.csv', '.md', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.mp3', '.mp4', '.wav']}
              enableAnalysis={true}
              autoAnalyze={false}
            />
          </div>
        </div>
      )}

      {/* Enhanced Input Area */}
      <div className="p-4 border-t border-gray-700 bg-gray-900/95 backdrop-blur-sm">
        {/* Show uploaded files */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3 max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center space-x-2 bg-gray-800/70 backdrop-blur-sm px-3 py-2 rounded-full text-sm border border-gray-600/50 hover:border-gray-500/50 transition-all duration-200"
                >
                  {file.preview && (
                    <div className="w-6 h-6 rounded-full overflow-hidden ring-2 ring-blue-500/30">
                      <img src={file.preview} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <span className="text-gray-300 truncate max-w-32 font-medium">{file.name}</span>
                  {file.analysis && (
                    <div className="w-2 h-2 bg-green-400 rounded-full" title="Analyzed" />
                  )}
                  <button
                    onClick={() => setUploadedFiles(files => files.filter(f => f.id !== file.id))}
                    className="text-gray-400 hover:text-red-400 p-1 rounded-full hover:bg-red-500/10 transition-all duration-200"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Input Container */}
        <div className="max-w-4xl mx-auto">
          <div className="relative flex flex-col border border-white/10 rounded-2xl bg-gray-800/50 backdrop-blur-sm shadow-2xl">
            {/* Textarea Container */}
            <div className="overflow-y-auto">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                rows={1}
                style={{ overflow: 'hidden', outline: 'none' }}
                className="w-full px-4 py-4 resize-none bg-transparent border-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-white/50 text-white leading-relaxed min-h-[60px] max-h-[120px]"
                placeholder={
                  isWebSearchEnabled 
                    ? "🌐 Search the web..." 
                    : provider.id === 'rapidapi' 
                      ? "🎨 Describe the image you want to generate..." 
                      : "💬 Ask me anything..."
                }
                disabled={isLoading || isSearching}
              />
            </div>

            {/* Controls Container */}
            <div className="h-16">
              <div className="absolute left-4 right-4 bottom-4 flex items-center justify-between">
                {/* Left Controls */}
                <div className="flex items-center gap-2">
                  {/* File Upload Button */}
                  <button
                    onClick={() => setShowFileUpload(!showFileUpload)}
                    className={`p-2.5 transition-all duration-200 rounded-xl border border-white/10 hover:border-white/20 ${
                      showFileUpload || uploadedFiles.length > 0
                        ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 shadow-lg shadow-blue-500/10'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                    title="Upload files"
                  >
                    <Paperclip size={18} />
                  </button>

                  {/* Web Search Toggle Button */}
                  <button
                    onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                    className={`p-2.5 transition-all duration-300 rounded-xl border border-white/10 hover:border-white/20 relative overflow-hidden ${
                      isWebSearchEnabled
                        ? 'bg-gradient-to-r from-green-600/20 to-blue-600/20 text-green-400 border-green-500/30 shadow-lg shadow-green-500/10'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                    title={isWebSearchEnabled ? "Disable web search" : "Enable web search"}
                  >
                    <div className="relative">
                      <Globe 
                        size={18} 
                        className={`transition-all duration-300 ${
                          isWebSearchEnabled ? 'scale-110' : 'scale-100'
                        }`}
                      />
                      {isWebSearchEnabled && (
                        <div className="absolute -top-1 -right-1">
                          <Sparkles size={10} className="text-green-400 animate-pulse" />
                        </div>
                      )}
                    </div>
                    {isWebSearchEnabled && (
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-blue-500/10 animate-pulse rounded-xl" />
                    )}
                  </button>

                  {/* Status Indicator */}
                  {isWebSearchEnabled && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-xs text-green-400 font-medium">Web Search</span>
                    </div>
                  )}
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || isSearching || (!input.trim() && uploadedFiles.length === 0)}
                  className={`p-3 transition-all duration-200 rounded-xl flex items-center justify-center min-w-[48px] ${
                    isLoading || isSearching || (!input.trim() && uploadedFiles.length === 0)
                      ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                      : isWebSearchEnabled
                        ? 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white shadow-lg shadow-green-500/20 hover:shadow-green-500/30 hover:scale-105'
                        : provider.id === 'rapidapi'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 hover:scale-105'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-105'
                  }`}
                  title={
                    isWebSearchEnabled 
                      ? "Search the web" 
                      : provider.id === 'rapidapi' 
                        ? "Generate image" 
                        : "Send message"
                  }
                >
                  {isLoading || isSearching ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isWebSearchEnabled ? (
                    <Globe size={20} />
                  ) : provider.id === 'rapidapi' ? (
                    <ImageIcon size={20} />
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Status Bar */}
          {(isLoading || isSearching) && (
            <div className="mt-2 flex items-center justify-center">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/70 backdrop-blur-sm border border-gray-700/50 rounded-full">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                <span className="text-xs text-gray-400">
                  {isSearching ? 'Searching the web...' : 'Generating response...'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showWorkspace && workspaceFiles && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 p-4 flex items-center justify-center">
          <div className="h-full w-full max-w-6xl bg-gray-800 rounded-lg overflow-hidden flex flex-col shadow-2xl">
            <MainWorkspace 
              files={workspaceFiles}
              onClose={() => setShowWorkspace(false)}
              onRunCode={handleRunCode}
              executionState={executionState}
              isVisible={showWorkspace}
            />
          </div>
        </div>
      )}
    </div>
  );
};