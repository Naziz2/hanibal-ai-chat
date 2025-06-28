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
import { FileUpload } from './FileUpload';
import { MainWorkspace } from './MainWorkspace';
import ImageStyleSelector from './ImageStyleSelector';

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  preview?: string;
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
  const [isSearching, setIsSearching] = useState(false);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const analyzeFilesWithAI = async (files: UploadedFile[]): Promise<string> => {
    if (!fileAnalysisService.current || files.length === 0) return '';

    try {
      let analysisText = '\n\n--- AI File Analysis ---\n';
      
      for (const file of files) {
        try {
          let fileBlob: Blob;
          
          if (file.content.startsWith('data:')) {
            const response = await fetch(file.content);
            fileBlob = await response.blob();
          } else {
            fileBlob = new Blob([file.content], { type: file.type });
          }
          
          const fileObj = new File([fileBlob], file.name, { type: file.type });
          const result = await fileAnalysisService.current.analyzeFile(fileObj);
          
          analysisText += `\n**${file.name}** (${file.type}):\n`;
          analysisText += `${result.analysis}\n\n`;
          
          if (result.fileType === 'text' && result.content) {
            const contentPreview = result.content.length > 500 
              ? result.content.substring(0, 500) + '...' 
              : result.content;
            analysisText += `**Content:**\n\`\`\`\n${contentPreview}\n\`\`\`\n\n`;
          }
          
        } catch (error) {
          console.error(`Error analyzing file ${file.name}:`, error);
          analysisText += `\n**${file.name}**: Analysis failed - ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
        }
      }
      
      return analysisText;
    } catch (error) {
      console.error('Error in file analysis:', error);
      return '\n\n--- File Analysis Error ---\nFailed to analyze files with AI.\n\n';
    }
  };

  const formatFilesForMessage = (files: UploadedFile[]): string => {
    if (files.length === 0) return '';
    
    let filesText = '\n\n--- Uploaded Files ---\n';
    files.forEach((file, index) => {
      filesText += `\n${index + 1}. **${file.name}** (${file.type}, ${formatFileSize(file.size)})\n`;
      
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
        filesText += `[Image file - Please analyze and describe this image in detail, including any text, objects, people, colors, composition, and other visual elements you can observe.]\n`;
        if (provider.id === 'google' || provider.id === 'openrouter') {
          filesText += `Image data: ${file.content}\n`;
        }
      } else {
        filesText += `[Binary file - ${file.type}]\n`;
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
      content: `Web search: ${input}`,
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
      
      let responseText = `**Web Search Results for: "${searchQuery}"**\n\n`;
      
      if (searchResults.results && searchResults.results.length > 0) {
        searchResults.results.forEach((result, index) => {
          responseText += `**${index + 1}. ${result.title}**\n`;
          responseText += `${result.snippet}\n`;
          responseText += `🔗 [${result.url}](${result.url})\n\n`;
        });
        
        if (searchResults.total_results) {
          responseText += `\n*Found ${searchResults.total_results} total results*`;
        }
      } else {
        responseText += 'No search results found for this query.';
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
        content: `Web search failed: ${error.message}`,
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
    
    // If web search is enabled and we have a query, perform web search
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
    
    // Check if user is asking for file analysis
    const isRequestingFileAnalysis = uploadedFiles.length > 0 && (
      input.toLowerCase().includes('analyze') ||
      input.toLowerCase().includes('analysis') ||
      input.toLowerCase().includes('examine') ||
      input.toLowerCase().includes('review') ||
      input.toLowerCase().includes('what is') ||
      input.toLowerCase().includes('describe') ||
      input.toLowerCase().includes('explain')
    );

    if (isRequestingFileAnalysis && fileAnalysisService.current) {
      const analysisResult = await analyzeFilesWithAI(uploadedFiles);
      messageContent += analysisResult;
    }

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
        content: `Error: ${error.message}`,
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
        content: 'Please select the Image Generation provider to generate images.',
        timestamp: new Date(now),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    const now = Date.now();
    const userMessage: Message = {
      id: `user-img-${now}`,
      role: 'user',
      content: `Image prompt: ${input}`,
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
                content: isMidjourney ? 'Generated Midjourney image:' : 'Generated image:', 
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
        content: `Sorry, I encountered an error generating the image: ${error.message}`,
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
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-purple-900/20 text-white overflow-hidden">
      {/* Header */}
      <div className="relative z-10 flex-shrink-0 border-b border-gray-700/50 bg-gray-900/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-lg font-bold text-white">H</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                  Hanibal AI
                </h1>
                <p className="text-xs text-gray-400">Advanced AI Assistant</p>
              </div>
            </div>
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
          <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onViewCode={handleViewCode} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* File Upload Area */}
      {showFileUpload && (
        <div className="border-t border-gray-700/50 bg-gray-800/95 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto p-4">
            <FileUpload
              onFilesUploaded={handleFilesUploaded}
              onClose={() => setShowFileUpload(false)}
              maxFiles={5}
              maxSizeInMB={10}
              acceptedTypes={['image/*', 'text/*', '.pdf', '.doc', '.docx', '.json', '.csv', '.md', '.js', '.ts', '.py', '.java', '.cpp', '.c']}
            />
          </div>
        </div>
      )}

      {/* Enhanced Input Area */}
      <div className="p-4 min-w-full">
        {/* Show uploaded files */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3 max-w-6xl mx-auto">
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center space-x-2 bg-gray-800/70 px-3 py-2 rounded-full text-sm border border-gray-600/50 backdrop-blur-sm"
                >
                  {file.preview && (
                    <div className="w-6 h-6 rounded-full overflow-hidden">
                      <img src={file.preview} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <span className="text-gray-300 truncate max-w-32">{file.name}</span>
                  <button
                    onClick={() => setUploadedFiles(files => files.filter(f => f.id !== file.id))}
                    className="text-gray-400 hover:text-red-400 p-1 rounded-full hover:bg-red-500/10 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="relative max-w-6xl mx-auto">
          <div className="relative flex flex-col border border-white/10 rounded-xl bg-black/50 backdrop-blur-sm">
            <div className="overflow-y-auto">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                rows={3}
                style={{ overflow: 'hidden', outline: 'none' }}
                className="w-full px-4 py-3 resize-none bg-transparent border-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-white/50 align-top leading-normal min-h-[80px] text-white"
                placeholder={
                  provider.id === 'rapidapi' 
                    ? 'Describe the image you want to generate...' 
                    : isWebSearchEnabled 
                      ? 'Search the web...' 
                      : 'Ask Hanibal anything...'
                }
                disabled={isLoading || isSearching}
              />
            </div>
            <div className="h-14">
              <div className="absolute left-3 right-3 bottom-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowFileUpload(!showFileUpload)}
                    className={`p-2 transition-colors rounded-lg border border-white/10 hover:border-white/20 ${
                      showFileUpload || uploadedFiles.length > 0
                        ? 'text-blue-400 bg-blue-500/10'
                        : 'text-white/50 hover:text-white'
                    }`}
                    aria-label="Attach file"
                    type="button"
                  >
                    <svg
                      className="w-4 h-4"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeWidth="2"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 24 24"
                      height="16"
                      width="16"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                    className={`p-2 transition-colors rounded-lg border border-white/10 hover:border-white/20 ${
                      isWebSearchEnabled
                        ? 'text-green-400 bg-green-500/10'
                        : 'text-white/50 hover:text-white'
                    }`}
                    aria-label="Toggle web search"
                    type="button"
                  >
                    <svg
                      className="w-4 h-4"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeWidth="2"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 24 24"
                      height="16"
                      width="16"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle r="10" cy="12" cx="12" />
                      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                      <path d="M2 12h20" />
                    </svg>
                  </button>
                  
                  <button
                    className="p-2 text-white/50 hover:text-white transition-colors rounded-lg border border-white/10 hover:border-white/20"
                    aria-label="Attach Figma link"
                    type="button"
                  >
                    <svg
                      className="w-4 h-4 text-pink-500"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeWidth="2"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 24 24"
                      height="16"
                      width="16"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
                      <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
                      <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
                      <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z" />
                      <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || isSearching || (!input.trim() && uploadedFiles.length === 0)}
                  className="p-2 transition-colors text-blue-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                  type="button"
                >
                  {isLoading || isSearching ? (
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : provider.id === 'rapidapi' ? (
                    <svg
                      className="w-6 h-6"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeWidth="2"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 24 24"
                      height="24"
                      width="24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  ) : isWebSearchEnabled ? (
                    <svg
                      className="w-6 h-6"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeWidth="2"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 24 24"
                      height="24"
                      width="24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeWidth="2"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 24 24"
                      height="24"
                      width="24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle r="10" cy="12" cx="12" />
                      <path d="m16 12-4-4-4 4" />
                      <path d="M12 16V8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
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