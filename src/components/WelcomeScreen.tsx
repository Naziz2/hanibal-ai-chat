import React from 'react';
import { MessageSquare, Image, Zap, Shield, Upload, Brain, Search, Code } from 'lucide-react';

export const WelcomeScreen: React.FC = () => {
  const features = [
    {
      icon: <Brain className="w-8 h-8 text-purple-500" />,
      title: 'Advanced AI Reasoning',
      description: 'Powered by cutting-edge AI models for intelligent conversations'
    },
    {
      icon: <MessageSquare className="w-8 h-8 text-blue-500" />,
      title: 'Multi-Model Chat',
      description: 'Access multiple AI providers and models in one interface'
    },
    {
      icon: <Image className="w-8 h-8 text-pink-500" />,
      title: 'Image Generation',
      description: 'Create stunning images with FLUX and Midjourney styles'
    },
    {
      icon: <Search className="w-8 h-8 text-green-500" />,
      title: 'Real-time Web Search',
      description: 'Search the web and get up-to-date information instantly'
    },
    {
      icon: <Upload className="w-8 h-8 text-orange-500" />,
      title: 'File Analysis',
      description: 'Upload and analyze documents, images, and code files with AI'
    },
    {
      icon: <Code className="w-8 h-8 text-cyan-500" />,
      title: 'Code Execution',
      description: 'Run and test code in multiple programming languages'
    },
    {
      icon: <Shield className="w-8 h-8 text-teal-500" />,
      title: 'Secure & Private',
      description: 'Your conversations and files are processed securely'
    },
    {
      icon: <Zap className="w-8 h-8 text-yellow-500" />,
      title: 'Lightning Fast',
      description: 'Optimized for speed and performance across all features'
    }
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <div className="max-w-6xl mx-auto text-center">
        <div className="mb-12">
          {/* Hanibal AI Logo/Avatar */}
          <div className="w-32 h-32 mx-auto mb-8 relative">
            <div className="w-full h-full bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
              <div className="w-28 h-28 bg-gray-900 rounded-2xl flex items-center justify-center">
                <Brain className="w-16 h-16 text-purple-400" />
              </div>
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            </div>
          </div>
          
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 mb-4">
            Hanibal AI
          </h1>
          <p className="text-2xl text-gray-300 mb-2">
            Your Advanced AI Assistant
          </p>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Engage with powerful AI models, generate images, analyze files, search the web, and execute code - all in one intelligent interface
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 bg-gray-800/30 border border-gray-700/50 rounded-2xl backdrop-blur-sm hover:bg-gray-800/50 hover:border-purple-500/30 transition-all duration-300 hover:scale-105"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-gray-800/50 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2 text-purple-400">
            <Zap className="w-5 h-5" />
            <span className="text-lg font-medium">Ready to get started?</span>
            <Zap className="w-5 h-5" />
          </div>
          <p className="text-gray-400 text-lg">
            Type a message, upload files, search the web, or generate images to begin
          </p>
          <div className="flex items-center justify-center space-x-6 text-sm text-gray-500 mt-8">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>All systems operational</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Multiple AI models available</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Enhanced with web search</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};