import React from 'react';
import { FileNode } from '../types/fileExplorer';
import { Play, Loader2 } from 'lucide-react';

interface CodeViewerProps {
  file: FileNode | null;
  onRunCode: (code: string, language: string) => void;
  isExecuting: boolean;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ file, onRunCode, isExecuting }) => {
  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a file to view its content
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center bg-gray-800 px-4 py-2 border-b border-gray-700">
        <span className="text-sm font-mono">{file.name}</span>
        <button
          onClick={() => file.content && onRunCode(file.content, file.language || 'javascript')}
          className="flex items-center px-3 py-1 text-sm bg-green-600 hover:bg-green-700 rounded disabled:bg-green-800 disabled:cursor-not-allowed transition-colors"
          disabled={isExecuting}
        >
          {isExecuting ? (
            <>
              <Loader2 size={14} className="mr-1 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play size={14} className="mr-1" />
              Run
            </>
          )}
        </button>
      </div>
      <pre className="p-4 bg-gray-900 text-gray-200 whitespace-pre-wrap break-words">
        <code>{file.content}</code>
      </pre>
    </div>
  );
};

export default CodeViewer;
