import React, { useState } from 'react';
import { FLUX_STYLES } from '../config/fluxStyles';
import { 
  Image as ImageIcon,
  Palette,
  Sparkles,
  Gamepad2,
  FileImage,
  Smile,
  Type,
  StickyNote,
  Zap,
  X,
  Settings,
  ChevronDown
} from 'lucide-react';

interface SizeOption {
  value: string;
  label: string;
  icon: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Photograph': <ImageIcon size={16} />,
  'Art': <Palette size={16} />,
  'Cartoon': <Sparkles size={16} />,
  'Game': <Gamepad2 size={16} />,
  'Logo': <FileImage size={16} />,
  'Tattoo': <Zap size={16} />,
  'Icon': <Smile size={16} />,
  'Text': <Type size={16} />,
  'Sticker': <StickyNote size={16} />
};

const SIZES: SizeOption[] = [
  { value: '1-1', label: 'Square', icon: '□' },
  { value: '16-9', label: 'Wide', icon: '▭' },
  { value: '9-16', label: 'Portrait', icon: '▮' },
  { value: '3-2', label: '3:2', icon: '▯' },
  { value: '2-3', label: '2:3', icon: '▯' },
];

interface ImageStyleSelectorProps {
  onSelect: (styleId: number, size: string) => void;
  selectedStyle?: number;
  selectedSize?: string;
  className?: string;
}

const ImageStyleSelector: React.FC<ImageStyleSelectorProps> = ({
  onSelect,
  selectedStyle = 1,
  selectedSize = '1-1',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Photograph');
  const currentStyle = selectedStyle || 1;
  const currentSize = selectedSize || '1-1';

  const handleStyleSelect = (styleId: number) => {
    onSelect(styleId, currentSize);
  };

  const handleSizeSelect = (size: string) => {
    onSelect(currentStyle, size);
  };

  const getCurrentStyleName = () => {
    for (const category of Object.values(FLUX_STYLES)) {
      const style = category.find(s => s.id === currentStyle);
      if (style) return style.style;
    }
    return 'No Style';
  };

  const getCurrentSizeLabel = () => {
    return SIZES.find(s => s.value === currentSize)?.label || 'Square';
  };

  return (
    <div className={`relative ${className}`}>
      {/* Compact Style Selector Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 hover:border-gray-500 transition-all duration-200 min-w-[200px]"
      >
        <Settings size={16} className="text-purple-400" />
        <div className="flex-1 text-left">
          <div className="text-gray-200 font-medium truncate">{getCurrentStyleName()}</div>
          <div className="text-xs text-gray-400">{getCurrentSizeLabel()}</div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50 max-h-[70vh] overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-gray-200">Image Style & Size</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-gray-700 transition-colors"
              aria-label="Close style selector"
            >
              <X size={20} />
            </button>
          </div>

          <div className="max-h-[calc(70vh-80px)] overflow-y-auto">
            {/* Categories */}
            <div className="p-4 border-b border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {Object.keys(FLUX_STYLES).map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                      activeCategory === category
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'text-gray-300 hover:bg-gray-700 border border-gray-600'
                    }`}
                    aria-label={`Select ${category} category`}
                  >
                    {CATEGORY_ICONS[category]}
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Styles */}
            <div className="p-4 border-b border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Styles</h4>
              <div className="grid grid-cols-3 gap-3">
                {FLUX_STYLES[activeCategory]?.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => handleStyleSelect(style.id)}
                    className={`group flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200 ${
                      currentStyle === style.id
                        ? 'border-purple-500 bg-purple-500/10 shadow-lg scale-105'
                        : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/50'
                    }`}
                    aria-label={`Select ${style.style} style`}
                    aria-pressed={currentStyle === style.id}
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden mb-2 bg-gray-700">
                      <img
                        src={style.avatar}
                        alt={style.style}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-xs text-center text-gray-200 font-medium truncate w-full">
                      {style.style}
                    </span>
                    <div className="flex gap-1 mt-1">
                      {style.hot && (
                        <span className="px-1.5 py-0.5 text-xs text-red-200 bg-red-600/20 border border-red-500/30 rounded">
                          Hot
                        </span>
                      )}
                      {style.newFeature && (
                        <span className="px-1.5 py-0.5 text-xs text-blue-200 bg-blue-600/20 border border-blue-500/30 rounded">
                          New
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sizes */}
            <div className="p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Size</h4>
              <div className="grid grid-cols-5 gap-2">
                {SIZES.map((size) => (
                  <button
                    key={size.value}
                    onClick={() => handleSizeSelect(size.value)}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 text-sm font-medium transition-all duration-200 ${
                      currentSize === size.value
                        ? 'border-purple-500 bg-purple-500/10 text-purple-200'
                        : 'border-gray-600 hover:bg-gray-700/50 text-gray-300 hover:border-gray-500'
                    }`}
                    aria-label={`Select ${size.label} size`}
                    aria-pressed={currentSize === size.value}
                  >
                    <span className="text-lg mb-1">{size.icon}</span>
                    <span className="text-xs">{size.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageStyleSelector;