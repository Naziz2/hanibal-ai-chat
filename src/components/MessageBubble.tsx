import React, { useState, useMemo } from 'react';
import { Copy, Check, User, Bot, AlertCircle, Download, Code } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message } from '../types';
import { SUPPORTED_LANGUAGES } from '../services/CodeExecutionService';

// Helper function to process message content and extract code blocks
const processMessageContent = (content: string) => {
  const supportedLanguageAliases = new Set(SUPPORTED_LANGUAGES.flatMap(lang => lang.aliases));
  const codeBlockRegex = /(```(\w*)\n([\s\S]*?)\n```)/g;
  
  let lastIndex = 0;
  const elements: Array<{ type: 'text' | 'code'; content: string; language?: string; hasScroll?: boolean }> = [];
  let match;
  
  // Find all code blocks
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const [fullMatch, , language, code] = match;
    const isRunnable = supportedLanguageAliases.has(language?.toLowerCase() || 'plaintext');
    const lineCount = (code.match(/\n/g) || []).length + 1;
    
    // Add text before the code block
    if (match.index > lastIndex) {
      elements.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      });
    }
    
    // Add the code block (only if it's a runnable language)
    if (isRunnable) {
      elements.push({
        type: 'code',
        content: code,
        language: language || 'plaintext',
        hasScroll: lineCount > 15 || code.length > 500 // Enable scroll for large code blocks
      });
    } else {
      // For non-runnable blocks, add as plain text without the code fences
      elements.push({
        type: 'text',
        content: code
      });
    }
    
    lastIndex = match.index + fullMatch.length;
  }
  
  // Add any remaining text
  if (lastIndex < content.length) {
    elements.push({
      type: 'text',
      content: content.slice(lastIndex)
    });
  }
  
  return elements;
};

interface MessageBubbleProps {
  message: Message;
  onViewCode: (files: { code: string; language: string }[]) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onViewCode }) => {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const handleCodeCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedStates(prev => ({ ...prev, [id]: true }));
      setTimeout(() => setCopiedStates(prev => ({ ...prev, [id]: false })), 2000);
    }).catch(err => console.error('Failed to copy code: ', err));
  };

  const handleDownloadCode = (code: string, language: string) => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const langExt = language || 'txt';
    a.download = `code.${langExt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isUser = message.role === 'user';
  
  // Process message content to separate code blocks from regular text
  const messageElements = useMemo(() => processMessageContent(message.content), [message.content]);
  
  // Extract only the runnable code blocks for the View Code button
  const runnableCodeBlocks = useMemo(() => {
    const blocks: { code: string; language: string }[] = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)\n```/g;
    const supportedLangs = new Set(SUPPORTED_LANGUAGES.flatMap(lang => lang.aliases));
    let match;
    
    while ((match = codeBlockRegex.exec(message.content)) !== null) {
      try {
        const language = (match[1] || '').toLowerCase() || 'plaintext';
        const code = match[2]?.trim() || '';
        
        // Only add if it's a supported language or no language specified
        if (!match[1] || supportedLangs.has(language)) {
          blocks.push({ 
            code: code, 
            language: language || 'plaintext' 
          });
        }
      } catch (error) {
        console.error('Error processing code block:', error);
      }
    }
    
    return blocks;
  }, [message.content]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'ml-3 bg-blue-600' : 'mr-3 bg-gray-700'}`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>
        <div className={`relative group px-4 py-3 ${isUser ? 'bg-blue-600 rounded-l-2xl rounded-tr-lg' : 'bg-gray-700 rounded-r-2xl rounded-tl-lg'}`}>
          {message.isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
            </div>
          ) : message.isError ? (
            <div className="flex items-center space-x-2 text-red-300">
              <AlertCircle size={16} />
              <span>{message.content}</span>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none prose-pre:p-0 prose-pre:bg-transparent">
              <div>
                {messageElements.map((element, index) => {
                  if (element.type === 'code') {
                    const codeId = `${message.id}-${index}`;
                    const needsScroll = element.hasScroll;
                    
                    return (
                      <div key={index} className={`my-3 bg-gray-900 rounded-lg border border-gray-700/50 overflow-hidden ${needsScroll ? 'max-h-[60vh]' : ''}`}>
                        <div className="flex justify-between items-center px-3 py-2 bg-gray-800/70 border-b border-gray-700/50">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium text-teal-400">{element.language || 'code'}</span>
                            <span className="text-xs text-gray-500">
                              {element.content.split('\n').length} {element.content.split('\n').length === 1 ? 'line' : 'lines'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleDownloadCode(element.content, element.language || 'txt')}
                              title="Download file" 
                              className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                            >
                              <Download size={14} />
                            </button>
                            <button 
                              onClick={() => handleCodeCopy(element.content, codeId)}
                              title="Copy code" 
                              className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                            >
                              {copiedStates[codeId] ? (
                                <Check size={14} className="text-green-500" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                            {runnableCodeBlocks.length > 0 && (
                              <button
                                onClick={() => onViewCode(runnableCodeBlocks)}
                                title="Open in code runner"
                                className="p-1.5 rounded hover:bg-teal-900/30 text-teal-400 hover:text-teal-300 transition-colors"
                              >
                                <Code size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className={`relative ${needsScroll ? 'max-h-[calc(60vh-40px)]' : ''} overflow-auto`}>
                          <div className={`${needsScroll ? 'absolute inset-0 overflow-auto' : ''}`}>
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={element.language}
                              PreTag="div"
                              wrapLines={!needsScroll ? 'true' : undefined}
                              wrapLongLines={!needsScroll ? 'true' : undefined}
                              customStyle={{
                                margin: 0,
                                padding: '1rem',
                                background: 'transparent',
                                fontSize: '0.875rem',
                                lineHeight: '1.5',
                                fontFamily: '"Fira Code", monospace',
                                minWidth: 'fit-content',
                                minHeight: '100%',
                                boxSizing: 'border-box'
                              }}
                              codeTagProps={{
                                style: {
                                  fontFamily: 'inherit',
                                  color: '#f8f8f2',
                                  background: 'transparent',
                                  textShadow: 'none',
                                  whiteSpace: needsScroll ? 'pre' : 'pre-wrap'
                                }
                              }}
                            >
                              {element.content}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // Render regular text with ReactMarkdown for markdown formatting
                  return (
                    <ReactMarkdown
                      key={index}
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          if (inline) {
                            return <code className="bg-gray-800/50 text-amber-300 font-semibold px-1 py-0.5 rounded-md">{children}</code>;
                          }
                          return <code className={className} {...props}>{children}</code>;
                        }
                      }}
                    >
                      {element.content}
                    </ReactMarkdown>
                  );
                })}
              </div>
              {message.images && message.images.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {message.images.map((img, index) => (
                    <img key={index} src={img} alt={`Generated ${index + 1}`} className="max-w-full h-auto rounded-lg shadow-md" />
                  ))}
                </div>
              )}
              {runnableCodeBlocks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <button
                    onClick={() => onViewCode(runnableCodeBlocks)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-md bg-gray-800/60 hover:bg-gray-800 transition-colors"
                    disabled={runnableCodeBlocks.length === 0}
                  >
                    <Code size={14} />
                    <span>View Code ({runnableCodeBlocks.length} {runnableCodeBlocks.length !== 1 ? 'files' : 'file'})</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};