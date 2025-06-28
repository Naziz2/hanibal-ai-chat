import React, { useState, useEffect } from 'react';
import FileExplorer from './FileExplorer';
import CodeViewer from './CodeViewer';
import { FileNode } from '../types/fileExplorer';
import { CodeExecutionService, SUPPORTED_LANGUAGES } from '../services/CodeExecutionService';
import { Message } from '../types';
import { CodeExecution } from './CodeExecution';

interface WorkspaceProps {
  lastMessage: Message | null;
}

export const Workspace: React.FC<WorkspaceProps> = ({ lastMessage }) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  useEffect(() => {
    if (lastMessage && lastMessage.role === 'assistant') {
      addFilesFromAI(lastMessage.content);
    }
  }, [lastMessage]);

  const toggleFolder = (id: string) => {
    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.id === id) {
          return { ...node, isOpen: !node.isOpen };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };
    setFiles(updateNode(files));
  };

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
    setExecutionResult(null); // Clear previous results
  };

  const handleRunCode = async (code: string, language: string) => {
    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const lang = SUPPORTED_LANGUAGES.find(l => 
        l.aliases.includes(language.toLowerCase())
      );
      const languageId = lang ? lang.id : 63; // Default to JavaScript

      const result = await CodeExecutionService.executeCode(code, languageId);
      setExecutionResult(result);
    } catch (error) {
      console.error('Execution error:', error);
      setExecutionResult({ 
        status: { id: -1, description: 'Error' },
        stderr: error instanceof Error ? error.message : 'Failed to execute code' 
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const addFilesFromAI = (aiResponse: string) => {
    const newFiles: FileNode[] = [];
    const fileMatches = aiResponse.match(/```(\w*)\n([\s\S]*?)\n```/g) || [];
    
    fileMatches.forEach((match, index) => {
      const parts = match.match(/```(\w*)\n([\s\S]*?)\n```/);
      if (parts && parts.length > 2) {
        const language = parts[1] || 'text';
        const content = parts[2].trim();
        const langData = SUPPORTED_LANGUAGES.find(l => l.aliases.includes(language.toLowerCase()));

        newFiles.push({
          id: `file-${Date.now()}-${index}`,
          name: `file${index + 1}.${langData ? langData.ext : 'txt'}`,
          type: 'file',
          language,
          content,
        });
      }
    });

    if (newFiles.length > 0) {
        setFiles(prevFiles => {
            const existingContents = new Set(prevFiles.map(f => f.content));
            const uniqueNewFiles = newFiles.filter(f => !f.content || !existingContents.has(f.content));
            return [...prevFiles, ...uniqueNewFiles];
        });
    }
  };

  return (
    <div className="flex h-full bg-gray-800 text-white">
      <div className="w-64 border-r border-gray-700 bg-gray-850 overflow-y-auto">
        <div className="p-3 font-semibold text-sm text-gray-300 border-b border-gray-700">File Explorer</div>
        <FileExplorer
          files={files}
          onFileSelect={handleFileSelect}
          onToggleFolder={toggleFolder}
          selectedFileId={selectedFile?.id}
        />
      </div>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <CodeViewer file={selectedFile} onRunCode={handleRunCode} />
        {(isExecuting || executionResult) && (
          <div className="flex-shrink-0 border-t border-gray-700 p-4 bg-gray-850">
            <CodeExecution
              result={executionResult}
              isLoading={isExecuting}
              onClose={() => setExecutionResult(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};


