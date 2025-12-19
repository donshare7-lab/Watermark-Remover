import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import UploadArea from './components/UploadArea';
import ImageCard from './components/ImageCard';
import { ImageItem, ProcessingStatus } from './types';
import { fileToBase64, removeWatermarkFromImage } from './services/geminiService';

const App: React.FC = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isGlobalProcessing, setIsGlobalProcessing] = useState(false);

  const handleFilesSelected = useCallback((files: File[]) => {
    // Limit to 10 total images
    const remainingSlots = 10 - images.length;
    if (remainingSlots <= 0) {
      alert("You can only upload a maximum of 10 images.");
      return;
    }

    const filesToAdd = files.slice(0, remainingSlots);

    const newItems: ImageItem[] = filesToAdd.map(file => ({
      id: crypto.randomUUID(),
      file,
      originalPreviewUrl: URL.createObjectURL(file),
      status: ProcessingStatus.IDLE,
      mimeType: file.type,
    }));

    setImages(prev => [...prev, ...newItems]);
  }, [images.length]);

  const handleRemoveImage = useCallback((id: string) => {
    setImages(prev => {
      const target = prev.find(img => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.originalPreviewUrl);
        if (target.processedUrl) URL.revokeObjectURL(target.processedUrl);
      }
      return prev.filter(img => img.id !== id);
    });
  }, []);

  const processImages = async () => {
    const pendingImages = images.filter(img => img.status === ProcessingStatus.IDLE || img.status === ProcessingStatus.ERROR);
    
    if (pendingImages.length === 0) return;

    setIsGlobalProcessing(true);

    // Process sequentially to avoid rate limits (safe approach) or we can do a limited Promise.all
    // Let's do 2 at a time for better UX
    const batchSize = 2;
    for (let i = 0; i < pendingImages.length; i += batchSize) {
        const batch = pendingImages.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (imageItem) => {
             // Update status to processing
             setImages(prev => prev.map(img => 
               img.id === imageItem.id ? { ...img, status: ProcessingStatus.PROCESSING, errorMessage: undefined } : img
             ));

             try {
               const base64Data = await fileToBase64(imageItem.file);
               const cleanedImageBase64 = await removeWatermarkFromImage(base64Data, imageItem.mimeType);
               
               // Create a blob URL for the result
               const byteCharacters = atob(cleanedImageBase64);
               const byteNumbers = new Array(byteCharacters.length);
               for (let j = 0; j < byteCharacters.length; j++) {
                   byteNumbers[j] = byteCharacters.charCodeAt(j);
               }
               const byteArray = new Uint8Array(byteNumbers);
               const blob = new Blob([byteArray], { type: imageItem.mimeType }); // Default to original mime type
               const processedUrl = URL.createObjectURL(blob);

               setImages(prev => prev.map(img => 
                 img.id === imageItem.id ? { ...img, status: ProcessingStatus.SUCCESS, processedUrl } : img
               ));
             } catch (error: any) {
               setImages(prev => prev.map(img => 
                 img.id === imageItem.id ? { ...img, status: ProcessingStatus.ERROR, errorMessage: error.message } : img
               ));
             }
        }));
    }

    setIsGlobalProcessing(false);
  };

  const clearAll = () => {
    images.forEach(img => {
      URL.revokeObjectURL(img.originalPreviewUrl);
      if (img.processedUrl) URL.revokeObjectURL(img.processedUrl);
    });
    setImages([]);
  };

  const pendingCount = images.filter(img => img.status === ProcessingStatus.IDLE).length;
  const successCount = images.filter(img => img.status === ProcessingStatus.SUCCESS).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] text-slate-100">
      <Header />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 flex flex-col gap-8">
        
        {/* Intro Section */}
        {images.length === 0 && (
          <div className="text-center space-y-4 max-w-2xl mx-auto py-12">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-indigo-400 to-purple-400">
              Vanish Watermarks Instantly
            </h2>
            <p className="text-lg text-slate-400">
              Upload your photos and let our advanced AI reconstruction engine seamlessly remove logos, text, and date stamps while preserving image quality.
            </p>
          </div>
        )}

        {/* Upload Section */}
        <section className="w-full max-w-3xl mx-auto">
          <UploadArea 
            onFilesSelected={handleFilesSelected} 
            disabled={isGlobalProcessing || images.length >= 10} 
          />
        </section>

        {/* Controls Bar */}
        {images.length > 0 && (
           <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700 backdrop-blur-sm sticky top-[88px] z-40 shadow-lg">
             <div className="flex items-center gap-2">
               <span className="font-semibold text-white">Queue: {images.length}/10</span>
               <span className="text-slate-400 text-sm">
                 ({successCount} Done, {pendingCount} Pending)
               </span>
             </div>
             <div className="flex items-center gap-3">
               <button 
                 onClick={clearAll}
                 disabled={isGlobalProcessing}
                 className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
               >
                 Clear All
               </button>
               <button 
                 onClick={processImages}
                 disabled={isGlobalProcessing || pendingCount === 0}
                 className={`
                   px-6 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition-all
                   flex items-center gap-2
                   ${isGlobalProcessing || pendingCount === 0
                     ? 'bg-slate-700 cursor-not-allowed text-slate-400 shadow-none' 
                     : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95'
                   }
                 `}
               >
                 {isGlobalProcessing ? (
                   <>
                     <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     Processing...
                   </>
                 ) : (
                   <>
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                     </svg>
                     Magic Remove
                   </>
                 )}
               </button>
             </div>
           </div>
        )}

        {/* Gallery Grid */}
        {images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
            {images.map(item => (
              <ImageCard 
                key={item.id} 
                item={item} 
                onRemove={handleRemoveImage}
              />
            ))}
          </div>
        )}

      </main>
    </div>
  );
};

export default App;