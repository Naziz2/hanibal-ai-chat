import React from 'react';
import { ChevronDown, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { Provider } from '../types';

interface ProviderSelectorProps {
  providers: Provider[];
  currentProvider: Provider;
  onProviderChange: (provider: Provider) => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  providers,
  currentProvider,
  onProviderChange
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const getStatusIcon = (status: Provider['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'limited':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <Zap className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (status: Provider['status']) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'limited':
        return 'Rate Limited';
      case 'error':
        return 'Error';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition-colors duration-200"
      >
        {getStatusIcon(currentProvider.status)}
        <span className="text-gray-200 font-medium">{currentProvider.name}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-2">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => {
                  onProviderChange(provider);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors duration-200 ${
                  provider.id === currentProvider.id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-700 text-gray-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(provider.status)}
                  <div className="text-left">
                    <div className="font-medium">{provider.name}</div>
                    <div className="text-xs opacity-75">
                      {getStatusText(provider.status)} • {provider.models.length} models
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};