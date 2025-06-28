import React from 'react';
import { MessageSquare, Image, Zap, Shield, Upload } from 'lucide-react';

export const WelcomeScreen: React.FC = () => {
  const features = [
    {
      icon: <MessageSquare className="w-6 h-6 text-blue-500" />,
      title: 'Text Generation',
      description: 'Chat with advanced AI models from multiple providers'
    },
    {
      icon: <Image className="w-6 h-6 text-purple-500" />,
      title: 'Image Generation',
      description: 'Create stunning images from text descriptions'
    },
    {
      icon: <Upload className="w-6 h-6 text-green-500" />,
      title: 'File Upload',
      description: 'Upload and analyze documents, images, and code files'
    },
    {
      icon: <Zap className="w-6 h-6 text-yellow-500" />,
      title: 'Code Execution',
      description: 'Run and test code in multiple programming languages'
    },
    {
      icon: <Shield className="w-6 h-6 text-teal-500" />,
      title: 'Secure & Private',
      description: 'Your conversations and files are processed securely'
    }
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-3xl mx-auto text-center">
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to AI Chat
          </h1>
          <p className="text-xl text-gray-400">
            Chat with powerful AI models, generate images, and analyze files
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl backdrop-blur-sm hover:bg-gray-800/70 transition-colors duration-200"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                {feature.icon}
                <div>
                  <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-gray-400 mb-2">Ready to get started?</p>
          <p className="text-sm text-gray-500">
            Type a message, upload files, or generate images to begin
          </p>
        </div>
      </div>
    </div>
  );
};