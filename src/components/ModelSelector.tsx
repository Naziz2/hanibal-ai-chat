import React from 'react';
import { ChevronDown, MessageSquare, Image } from 'lucide-react';
import { Model } from '../types';

interface ModelSelectorProps {
  models: Model[];
  currentModel: Model;
  onModelChange: (model: Model) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  currentModel,
  onModelChange
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const getModelIcon = (type: Model['type']) => {
    return type === 'text' ? 
      <MessageSquare className="w-4 h-4 text-blue-500" /> : 
      <Image className="w-4 h-4 text-purple-500" />;
  };

  const textModels = models.filter(model => model.type === 'text');
  const imageModels = models.filter(model => model.type === 'image');

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition-colors duration-200 min-w-[200px]"
      >
        {getModelIcon(currentModel.type)}
        <div className="flex-1 text-left">
          <div className="text-gray-200 font-medium truncate">{currentModel.name}</div>
          <div className="text-xs text-gray-400 capitalize">{currentModel.type} generation</div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            {textModels.length > 0 && (
              <div className="mb-2">
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Text Generation
                </div>
                {textModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelChange(model);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                      model.id === currentModel.id
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-700 text-gray-200'
                    }`}
                  >
                    {getModelIcon(model.type)}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs opacity-75 truncate">{model.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {imageModels.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Image Generation
                </div>
                {imageModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelChange(model);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                      model.id === currentModel.id
                        ? 'bg-purple-600 text-white'
                        : 'hover:bg-gray-700 text-gray-200'
                    }`}
                  >
                    {getModelIcon(model.type)}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs opacity-75 truncate">{model.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};