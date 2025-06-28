import React from 'react';
import { FileNode } from '../types/fileExplorer';
import { File, Folder, ChevronRight } from 'lucide-react';

interface FileExplorerProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  onToggleFolder: (id: string) => void;
  selectedFileId?: string | null;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ files, onFileSelect, onToggleFolder, selectedFileId }) => {
  const renderTree = (nodes: FileNode[]) => {
    return nodes.map((node) => (
      <div key={node.id} className="text-sm">
        <div
          className={`flex items-center py-1 px-2 my-px rounded cursor-pointer transition-colors duration-200 ${
            selectedFileId === node.id ? 'bg-blue-600/30' : 'hover:bg-gray-700/50'
          }`}
          onClick={() => {
            if (node.type === 'folder') {
              onToggleFolder(node.id);
            } else {
              onFileSelect(node);
            }
          }}
        >
          {node.type === 'folder' ? (
            <ChevronRight
              size={16}
              className={`mr-1 text-gray-500 transition-transform duration-200 ${node.isOpen ? 'rotate-90' : ''}`}
            />
          ) : (
            <span className="w-4 h-4 mr-1" /> // Indent for alignment
          )}
          {node.type === 'folder' ? (
            <Folder size={16} className="mr-2 text-sky-400" />
          ) : (
            <File size={16} className="mr-2 text-gray-400" />
          )}
          <span className="truncate">{node.name}</span>
        </div>
        {node.type === 'folder' && (
          <div
            className="pl-2 transition-all duration-300 ease-in-out overflow-hidden"
            style={{ maxHeight: node.isOpen ? '1000px' : '0px' }}
          >
            {node.children && renderTree(node.children)}
          </div>
        )}
      </div>
    ));
  };

  return <div className="select-none p-2">{renderTree(files)}</div>;
};

export default FileExplorer;
