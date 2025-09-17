
import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { UploadIcon, SparklesIcon, DownloadIcon, XCircleIcon, ArrowPathIcon } from './components/icons';

const RESTORE_PROMPT = "Restore and colorize this photo in ultra high quality 4K resolution. Remove scratches, broken lines, and visual defects. Sharpen facial details, enhance textures, and brighten the image for better clarity. Apply natural and realistic colors, making the photo vivid, clear, and true to life while preserving its authenticity.";

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve({ base64, mimeType: file.type });
        };
        reader.onerror = (error) => reject(error);
    });
};

// --- UI Components defined at top level ---

interface FileUploadProps {
    onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    isLoading: boolean;
}

const FileUploader: React.FC<FileUploadProps> = ({ onFileChange, isLoading }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onAreaClick = () => {
        if (!isLoading && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    return (
        <div 
            onClick={onAreaClick}
            className={`w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-600 rounded-2xl bg-gray-800/50 transition-all duration-300 ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-indigo-500 hover:bg-gray-800'}`}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={onFileChange}
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                disabled={isLoading}
            />
            <div className="text-center">
                <div className="mx-auto h-16 w-16 text-gray-500">
                    <UploadIcon />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">Upload a photo</h3>
                <p className="mt-2 text-sm text-gray-400">Drag and drop or click to select a file</p>
                <p className="mt-1 text-xs text-gray-500">PNG, JPG, WEBP</p>
            </div>
        </div>
    );
};


interface ImageDisplayProps {
    originalImage: string;
    restoredImage: string | null;
    isLoading: boolean;
    fileName: string | null;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ originalImage, restoredImage, isLoading, fileName }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        <div className="flex flex-col items-center">
            <h3 className="text-lg font-medium text-gray-300 mb-4">Original</h3>
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-800 shadow-lg">
                <img src={originalImage} alt="Original" className="w-full h-full object-contain" />
            </div>
             <p className="mt-3 text-sm text-gray-400 truncate w-full text-center">{fileName}</p>
        </div>
        <div className="flex flex-col items-center">
            <h3 className="text-lg font-medium text-gray-300 mb-4">Restored</h3>
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-800 shadow-lg flex items-center justify-center relative">
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                        <div className="w-10 h-10 animate-spin text-indigo-400"><SparklesIcon /></div>
                        <p className="mt-4 text-white font-semibold">Restoring your photo...</p>
                        <p className="mt-1 text-sm text-gray-300">This may take a moment.</p>
                    </div>
                )}
                {restoredImage ? (
                    <img src={restoredImage} alt="Restored" className="w-full h-full object-contain" />
                ) : (
                    !isLoading && (
                        <div className="text-center text-gray-500 p-4">
                            <div className="w-12 h-12 mx-auto"><SparklesIcon /></div>
                            <p className="mt-2 font-medium">Your restored photo will appear here</p>
                        </div>
                    )
                )}
            </div>
        </div>
    </div>
);

// --- Main App Component ---

function App() {
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [originalMimeType, setOriginalMimeType] = useState<string | null>(null);
    const [restoredImage, setRestoredImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleReset();
            try {
                const { base64, mimeType } = await fileToBase64(file);
                setOriginalImage(`data:${mimeType};base64,${base64}`);
                setOriginalMimeType(mimeType);
                setFileName(file.name);
            } catch (err) {
                setError("Failed to read the image file.");
                console.error(err);
            }
        }
    };

    const handleRestorePhoto = useCallback(async () => {
        if (!originalImage || !originalMimeType || !process.env.API_KEY) {
            setError("Please upload an image and ensure your API key is configured.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setRestoredImage(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const base64Data = originalImage.split(',')[1];

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        { inlineData: { data: base64Data, mimeType: originalMimeType } },
                        { text: RESTORE_PROMPT },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            let foundImage = false;
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    const restoredBase64 = part.inlineData.data;
                    const restoredMimeType = part.inlineData.mimeType;
                    setRestoredImage(`data:${restoredMimeType};base64,${restoredBase64}`);
                    foundImage = true;
                    break;
                }
            }
            if (!foundImage) {
                throw new Error("The AI model did not return an image. It might have refused the request.");
            }

        } catch (e: any) {
            setError(e.message || "An error occurred during the restoration process.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [originalImage, originalMimeType]);

    const handleDownload = () => {
        if (!restoredImage) return;
        const link = document.createElement('a');
        link.href = restoredImage;
        const originalName = fileName?.split('.').slice(0, -1).join('.') || 'photo';
        link.download = `${originalName}-restored.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleReset = () => {
        setOriginalImage(null);
        setOriginalMimeType(null);
        setRestoredImage(null);
        setIsLoading(false);
        setError(null);
        setFileName(null);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <header className="w-full max-w-6xl mx-auto text-center mb-8">
                <div className="inline-flex items-center gap-3 mb-2">
                    <SparklesIcon className="w-8 h-8 text-indigo-400" />
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 text-transparent bg-clip-text">
                        AI Photo Restorer & Colorizer
                    </h1>
                </div>
                <p className="text-gray-400 max-w-3xl mx-auto">
                    Bring your old photos back to life. Upload an image to automatically remove scratches, fix damage, and add vibrant, natural color.
                </p>
            </header>

            <main className="w-full max-w-6xl mx-auto flex-grow flex flex-col items-center justify-center">
                {error && (
                    <div className="mb-6 w-full max-w-3xl bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center gap-3">
                        <XCircleIcon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {!originalImage ? (
                    <FileUploader onFileChange={handleFileChange} isLoading={isLoading} />
                ) : (
                    <div className="w-full flex flex-col items-center gap-8">
                        <ImageDisplay
                            originalImage={originalImage}
                            restoredImage={restoredImage}
                            isLoading={isLoading}
                            fileName={fileName}
                        />
                        <div className="flex flex-wrap justify-center items-center gap-4 mt-4">
                            <button
                                onClick={handleRestorePhoto}
                                disabled={isLoading}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-900 disabled:bg-indigo-800/50 disabled:cursor-not-allowed transition-colors"
                            >
                                <SparklesIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                                {isLoading ? 'Restoring...' : 'Restore Photo'}
                            </button>
                            <button
                                onClick={handleDownload}
                                disabled={!restoredImage || isLoading}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-gray-900 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                            >
                                <DownloadIcon className="w-5 h-5" />
                                Download
                            </button>
                             <button
                                onClick={handleReset}
                                disabled={isLoading}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold text-gray-300 bg-gray-700 rounded-lg shadow-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:ring-offset-gray-900 disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors"
                            >
                                <ArrowPathIcon className="w-5 h-5" />
                                Upload New Photo
                            </button>
                        </div>
                    </div>
                )}
            </main>
            <footer className="w-full max-w-6xl mx-auto text-center mt-12 py-4">
                <p className="text-sm text-gray-500">Powered by Google Gemini</p>
            </footer>
        </div>
    );
}

export default App;
