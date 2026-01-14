import React, { useCallback } from 'react';
import { Upload, ImageIcon, Loader2 } from 'lucide-react';
import { ImageUploadProps } from '../types';

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSelected, isLoading }) => {
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        onImageSelected(base64String);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageSelected]);

  return (
    <div className="w-full max-w-xl mx-auto mb-8">
      <label 
        className={`
          relative flex flex-col items-center justify-center w-full h-64 
          border-2 border-dashed rounded-2xl cursor-pointer 
          transition-all duration-300 ease-in-out
          ${isLoading 
            ? 'border-blue-500 bg-blue-500/10 cursor-not-allowed' 
            : 'border-slate-600 bg-slate-800/50 hover:bg-slate-800 hover:border-blue-400'
          }
        `}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
          {isLoading ? (
            <>
              <Loader2 className="w-12 h-12 mb-4 text-blue-400 animate-spin" />
              <p className="text-sm text-blue-200 font-medium">Analisando tipografia...</p>
            </>
          ) : (
            <>
              <div className="p-4 bg-slate-700/50 rounded-full mb-4">
                <Upload className="w-8 h-8 text-blue-400" />
              </div>
              <p className="mb-2 text-lg font-semibold text-slate-200">
                Clique, arraste ou cole (Ctrl+V)
              </p>
              <p className="text-xs text-slate-400">
                Suporta PNG, JPG (Máx 5MB)
              </p>
            </>
          )}
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange} 
          disabled={isLoading}
        />
      </label>
    </div>
  );
};