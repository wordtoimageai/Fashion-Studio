
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';

// --- Types ---
interface HistoryItem {
  id: string;
  url: string;
  timestamp: number;
  garment?: string; // Base64 of garment used
  prompt?: string;
}

type FilterType = 'none' | 'grayscale' | 'sepia' | 'vintage' | 'dramatic';
type Page = 'studio' | 'trends' | 'wardrobe';
type AspectRatio = 'original' | '1:1' | '3:4' | '4:3' | '16:9';

interface TrendStyle {
  id: string;
  title: string;
  category: string;
  image: string;
  description: string;
}

interface WorkspaceState {
  image: string | null;
  filter: FilterType;
  variations: string[];
  blur: number;
  isPortraitActive: boolean;
  customColor: string;
  colorIntensity: number;
}

const FILTERS: { id: FilterType; label: string; filterStr: string }[] = [
  { id: 'none', label: 'None', filterStr: 'none' },
  { id: 'grayscale', label: 'Noir', filterStr: 'grayscale(100%)' },
  { id: 'sepia', label: 'Sepia', filterStr: 'sepia(100%)' },
  { id: 'vintage', label: 'Vintage', filterStr: 'sepia(50%) contrast(110%) brightness(95%) saturate(120%)' },
  { id: 'dramatic', label: 'Drama', filterStr: 'contrast(150%) brightness(90%) saturate(110%)' },
];

const TREND_DATA: TrendStyle[] = [
  { id: 't1', title: 'Cyberpunk Noir', category: 'Futuristic', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80', description: 'Neon accents with techwear materials.' },
  { id: 't2', title: 'Soft Minimalist', category: 'Casual', image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=600&q=80', description: 'Beige tones and oversized linen cuts.' },
  { id: 't3', title: '90s Revival', category: 'Retro', image: 'https://images.unsplash.com/photo-1529139513477-323c66b6929b?auto=format&fit=crop&w=600&q=80', description: 'Baggy denim and vintage varsity jackets.' },
  { id: 't4', title: 'Gothic Romance', category: 'High Fashion', image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=600&q=80', description: 'Lace textures with deep crimson velvet.' },
  { id: 't5', title: 'Utility Core', category: 'Streetwear', image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80', description: 'Functional multi-pocket vests and cargos.' },
  { id: 't6', title: 'Summer Breeze', category: 'Seasonal', image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=600&q=80', description: 'Floral patterns and light silk fabrics.' },
];

const STYLE_PRESETS = [
  { id: 'sketch', label: 'Sketch', url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=200&q=80' },
  { id: 'oil', label: 'Oil Painting', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=200&q=80' },
  { id: 'pop', label: 'Pop Art', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=200&q=80' },
  { id: 'watercolor', label: 'Watercolor', url: 'https://images.unsplash.com/photo-1541339907198-e08759dfc3ef?auto=format&fit=crop&w=200&q=80' },
];

const COMMON_GARMENTS = [
  { id: 'cg1', label: 'Leather Jacket', image: 'https://images.unsplash.com/photo-1551028711-031cda28351a?auto=format&fit=crop&w=300&q=80', prompt: 'a classic black leather biker jacket' },
  { id: 'cg2', label: 'Denim Shirt', image: 'https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&w=300&q=80', prompt: 'a light blue denim button-down shirt' },
  { id: 'cg3', label: 'Summer Dress', image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=300&q=80', prompt: 'a vibrant red floral summer dress' },
  { id: 'cg4', label: 'Beige Trench', image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=300&q=80', prompt: 'a classic beige double-breasted trench coat' },
  { id: 'cg5', label: 'Soft Hoodie', image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=300&q=80', prompt: 'a comfortable oversized gray drawstring hoodie' },
  { id: 'cg6', label: 'Black Suit', image: 'https://images.unsplash.com/photo-1594932224828-b4b059b6f68e?auto=format&fit=crop&w=300&q=80', prompt: 'a sharp tailored black business suit jacket' },
];

// --- Utils ---
const cleanBase64 = (str: string | null): string => {
  if (!str) return '';
  const base64PrefixRegex = /^data:image\/(png|jpeg|jpg|webp);base64,/;
  return str.replace(base64PrefixRegex, '').trim();
};

const ensureDataUrl = (str: string | null): string | null => {
  if (!str) return null;
  if (str.startsWith('data:image')) return str;
  return `data:image/png;base64,${str}`; // Assuming PNG for simplicity post-processing if type is unknown
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

const urlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const applyFilterToDataUrl = (imageUrl: string, filterStr: string): Promise<string> => {
  if (filterStr === 'none') return Promise.resolve(imageUrl);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(imageUrl); return; }
      ctx.filter = filterStr;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageUrl);
  });
};

// --- Main Component ---
const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('studio');
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [garmentImage, setGarmentImage] = useState<string | null>(null);
  const [garmentPrompt, setGarmentPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingGarment, setIsGeneratingGarment] = useState(false);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [showBlurControl, setShowBlurControl] = useState(false);
  const [showStyleControl, setShowStyleControl] = useState(false);
  const [showColorControl, setShowColorControl] = useState(false);
  const [styleReference, setStyleReference] = useState<string | null>(null);
  const [isStyling, setIsStyling] = useState(false);

  // --- Cropping State ---
  const [showCropper, setShowCropper] = useState(false);
  const [cropTarget, setCropTarget] = useState<'person' | 'result' | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropAspectRatio, setCropAspectRatio] = useState<AspectRatio>('original');
  const cropperContainerRef = useRef<HTMLDivElement>(null);
  // Removed cropperImageRef as we'll use a new Image() object inside applyCrop
  // const cropperImageRef = useRef<HTMLImageElement>(null); 

  // --- Active Workspace State ---
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('none');
  const [blurAmount, setBlurAmount] = useState(0);
  const [isPortraitActive, setIsPortraitActive] = useState(false);
  const [customColor, setCustomColor] = useState('#6366f1');
  const [colorIntensity, setColorIntensity] = useState(0);
  const [variations, setVariations] = useState<string[]>([]);
  const [wsHistory, setWsHistory] = useState<WorkspaceState[]>([{ image: null, filter: 'none', variations: [], blur: 0, isPortraitActive: false, customColor: '#6366f1', colorIntensity: 0 }]);
  const [wsIndex, setWsIndex] = useState(0);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useCamera, setUseCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const personInputRef = useRef<HTMLInputElement>(null);
  const garmentInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);

  // --- Undo/Redo Logic ---
  const addToWorkspaceHistory = (
    image: string | null, 
    filter: FilterType, 
    currentVariations: string[] = variations, 
    blur: number = blurAmount,
    portrait: boolean = isPortraitActive,
    color: string = customColor,
    intensity: number = colorIntensity
  ) => {
    const nextState = { image, filter, variations: currentVariations, blur, isPortraitActive: portrait, customColor: color, colorIntensity: intensity };
    if (
      wsHistory[wsIndex]?.image === image && 
      wsHistory[wsIndex]?.filter === filter && 
      wsHistory[wsIndex]?.variations === currentVariations && 
      wsHistory[wsIndex]?.blur === blur &&
      wsHistory[wsIndex]?.isPortraitActive === portrait &&
      wsHistory[wsIndex]?.customColor === color &&
      wsHistory[wsIndex]?.colorIntensity === intensity
    ) return;

    const newHistory = wsHistory.slice(0, wsIndex + 1);
    newHistory.push(nextState);
    setWsHistory(newHistory);
    setWsIndex(newHistory.length - 1);
    
    setResultImage(image);
    setActiveFilter(filter);
    setVariations(currentVariations);
    setBlurAmount(blur);
    setIsPortraitActive(portrait);
    setCustomColor(color);
    setColorIntensity(intensity);
  };

  const handleUndo = () => {
    if (wsIndex > 0) {
      const prev = wsHistory[wsIndex - 1];
      setWsIndex(wsIndex - 1);
      setResultImage(prev.image);
      setActiveFilter(prev.filter);
      setVariations(prev.variations);
      setBlurAmount(prev.blur);
      setIsPortraitActive(prev.isPortraitActive);
      setCustomColor(prev.customColor);
      setColorIntensity(prev.colorIntensity);
    }
  };

  const handleRedo = () => {
    if (wsIndex < wsHistory.length - 1) {
      const next = wsHistory[wsIndex + 1];
      setWsIndex(wsIndex + 1);
      setResultImage(next.image);
      setActiveFilter(next.filter);
      setVariations(next.variations);
      setBlurAmount(next.blur);
      setIsPortraitActive(next.isPortraitActive);
      setCustomColor(next.customColor); 
      setColorIntensity(next.colorIntensity);
    }
  };

  // --- Cropping Implementation ---
  const openCropper = (target: 'person' | 'result') => {
    const imgSource = target === 'person' ? ensureDataUrl(personImage) : resultImage;
    if (!imgSource) return;
    setCropTarget(target);
    setCropImage(imgSource);
    setCropAspectRatio('original'); // Reset aspect ratio when opening cropper
    setShowCropper(true);
  };

  const applyCrop = () => {
    if (!cropperContainerRef.current || !cropImage) return; // Removed cropperImageRef check
    
    const img = new Image();
    img.src = cropImage;
    
    img.onload = () => { // Ensure image is loaded before attempting to crop
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { 
        setError("Could not create canvas context for cropping.");
        setShowCropper(false);
        return;
      }

      let cropWidth = 0, cropHeight = 0; // Initialize with 0
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      if (imgWidth === 0 || imgHeight === 0) {
        setError("Image dimensions are invalid for cropping.");
        setShowCropper(false);
        return;
      }

      switch (cropAspectRatio) {
        case '1:1':
          cropWidth = cropHeight = Math.min(imgWidth, imgHeight);
          break;
        case '3:4':
          if (imgWidth / imgHeight > 3 / 4) {
            cropHeight = imgHeight;
            cropWidth = imgHeight * (3 / 4);
          } else {
            cropWidth = imgWidth;
            cropHeight = imgWidth * (4 / 3);
          }
          break;
        case '4:3':
          if (imgWidth / imgHeight > 4 / 3) {
            cropHeight = imgHeight;
            cropWidth = imgHeight * (4 / 3);
          } else {
            cropWidth = imgWidth;
            cropHeight = imgWidth * (3 / 4);
          }
          break;
        case '16:9':
          if (imgWidth / imgHeight > 16 / 9) {
            cropHeight = imgHeight;
            cropWidth = imgHeight * (16 / 9);
          } else {
            cropWidth = imgWidth;
            cropHeight = imgWidth * (9 / 16);
          }
          break;
        default: // 'original'
          cropWidth = imgWidth;
          cropHeight = imgHeight;
      }

      // Ensure crop dimensions are positive integers
      cropWidth = Math.max(1, Math.floor(cropWidth));
      cropHeight = Math.max(1, Math.floor(cropHeight));

      const startX = Math.max(0, Math.floor((imgWidth - cropWidth) / 2));
      const startY = Math.max(0, Math.floor((imgHeight - cropHeight) / 2));

      canvas.width = cropWidth;
      canvas.height = cropHeight;
      ctx.drawImage(img, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      
      const croppedDataUrl = canvas.toDataURL('image/png');
      
      if (cropTarget === 'person') {
        setPersonImage(cleanBase64(croppedDataUrl));
      } else {
        addToWorkspaceHistory(croppedDataUrl, activeFilter, variations, blurAmount, isPortraitActive, customColor, colorIntensity);
      }

      setShowCropper(false);
    };
    img.onerror = (e) => {
      console.error("Error loading image for cropping:", e);
      setError("Failed to load image for cropping. Please try again.");
      setShowCropper(false);
    };
  };

  // --- Existing Logic ---
  const handleFilterChange = (filter: FilterType) => {
    addToWorkspaceHistory(resultImage, filter, variations, blurAmount, isPortraitActive, customColor, colorIntensity);
  };

  const handleBlurChange = (val: number) => {
    setBlurAmount(val);
  };

  const commitBlur = () => {
    addToWorkspaceHistory(resultImage, activeFilter, variations, blurAmount, isPortraitActive, customColor, colorIntensity);
  };

  const handlePortraitToggle = () => {
    const nextPortraitState = !isPortraitActive;
    setIsPortraitActive(nextPortraitState);
    const nextBlurAmount = (nextPortraitState && blurAmount === 0) ? 8 : blurAmount;
    setBlurAmount(nextBlurAmount);
    if (nextPortraitState) setShowBlurControl(true);
    addToWorkspaceHistory(resultImage, activeFilter, variations, nextBlurAmount, nextPortraitState, customColor, colorIntensity);
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
  };

  const handleIntensityChange = (val: number) => {
    setColorIntensity(val);
  };

  const commitColor = () => {
    addToWorkspaceHistory(resultImage, activeFilter, variations, blurAmount, isPortraitActive, customColor, colorIntensity);
  };

  const selectVariation = (url: string) => {
    addToWorkspaceHistory(url, activeFilter, variations, blurAmount, isPortraitActive, customColor, colorIntensity);
  };

  const selectCommonGarment = async (garment: typeof COMMON_GARMENTS[0]) => {
    try {
      const base64 = await urlToBase64(garment.image);
      setGarmentImage(base64);
      setGarmentPrompt(garment.prompt);
    } catch (err) {
      setError("Failed to load garment preset.");
    }
  };

  const generateGarmentImage = async () => {
    if (!garmentPrompt) {
      setError("Please provide a description of the garment you'd like to create.");
      return;
    }
    setIsGeneratingGarment(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Create a high-quality, studio-lit product photograph of ${garmentPrompt}. The garment should be presented on a clean white background, perfectly centered.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });
      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setGarmentImage(cleanBase64(part.inlineData.data));
          foundImage = true;
          break;
        }
      }
      if (!foundImage) setError("AI could not generate the garment image.");
    } catch (err: any) {
      setError("Error generating garment: " + (err.message || "Unknown error"));
    } finally {
      setIsGeneratingGarment(false);
    }
  };

  const applyStyleTransfer = async () => {
    if (!resultImage || !styleReference) return;
    setIsStyling(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contentImageBase64 = cleanBase64(resultImage);
      const styleBase64 = cleanBase64(styleReference);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [
          { inlineData: { mimeType: 'image/png', data: contentImageBase64 } },
          { inlineData: { mimeType: 'image/jpeg', data: styleBase64 } },
          { text: "Apply the artistic style of the second image to the content of the first image." }
        ]},
      });
      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const stylizedImage = `data:image/png;base64,${part.inlineData.data}`;
          addToWorkspaceHistory(stylizedImage, activeFilter, [...variations, stylizedImage], blurAmount, isPortraitActive, customColor, colorIntensity);
          foundImage = true;
          setShowStyleControl(false);
          break;
        }
      }
      if (!foundImage) setError("Model failed to stylize the image.");
    } catch (err: any) {
      setError("Style transfer error: " + err.message);
    } finally {
      setIsStyling(false);
    }
  };

  const handleStyleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setStyleReference(base64);
    }
  };

  const selectStylePreset = async (url: string) => {
    try {
      const base64 = await urlToBase64(url);
      setStyleReference(base64);
    } catch (err) {
      setError("Failed to load style preset.");
    }
  };

  const goToStudio = async (image?: string, prompt?: string) => {
    if (image) {
      if (image.includes('base64')) setGarmentImage(cleanBase64(image));
      else if (image.startsWith('http')) {
        try {
          const base64 = await urlToBase64(image);
          setGarmentImage(base64);
        } catch (e) { console.error("Failed to fetch remote image", e); }
      }
    }
    if (prompt) setGarmentPrompt(prompt);
    setCurrentPage('studio');
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (useCamera && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((s) => {
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch((err) => {
          setError("Could not access camera.");
          setUseCamera(false);
        });
    }
    return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
  }, [useCamera, currentPage]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        setPersonImage(cleanBase64(canvasRef.current.toDataURL('image/png')));
        setUseCamera(false);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'person' | 'garment') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        if (type === 'person') setPersonImage(base64);
        else setGarmentImage(base64);
      } catch (err) { setError("Failed to process image."); }
    }
  };

  const removeBackground = async () => {
    if (!personImage) return;
    setIsRemovingBackground(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64(personImage) } },
          { text: "Remove the background from this image. Keep only the person in the foreground." },
        ]},
      });
      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setPersonImage(cleanBase64(part.inlineData.data));
          foundImage = true;
          break;
        }
      }
      if (!foundImage) setError("Failed to remove background.");
    } catch (err: any) {
      setError("Error removing background: " + (err.message || "Unknown error"));
    } finally {
      setIsRemovingBackground(false);
    }
  };

  const handleShare = async () => {
    if (!resultImage) return;
    setIsSharing(true);
    try {
      const finalImage = await applyFilterToDataUrl(resultImage, FILTERS.find(f => f.id === activeFilter)?.filterStr || 'none');
      const blob = await fetch(finalImage).then(r => r.blob());
      const file = new File([blob], 'ai-fashion-look.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My AI Fashion Studio Look' });
      } else alert("Native sharing not supported. Please download manually.");
    } catch (err) { console.error(err); } finally { setIsSharing(false); }
  };

  const handleDownload = async () => {
    if (!resultImage) return;
    const finalImage = await applyFilterToDataUrl(resultImage, FILTERS.find(f => f.id === activeFilter)?.filterStr || 'none');
    const link = document.createElement('a');
    link.href = finalImage;
    link.download = `ai-fashion-look-${Date.now()}.png`;
    link.click();
  };

  const generateTryOn = async () => {
    if (!personImage) { setError("Please provide a photo of yourself first."); return; }
    if (!garmentImage && !garmentPrompt) { setError("Please provide a garment."); return; }
    setIsGenerating(true);
    setError(null);
    setIsComparing(false);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [{ inlineData: { mimeType: 'image/png', data: cleanBase64(personImage) } }];
      if (garmentImage) parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64(garmentImage) } });
      parts.push({ text: `Modify the person in the first image to wear the ${garmentImage ? "garment in the second" : garmentPrompt}. Generate 3 variations.` });
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts } });
      const newVariations: string[] = [];
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) newVariations.push(`data:image/png;base64,${part.inlineData.data}`);
      }
      if (newVariations.length > 0) {
        addToWorkspaceHistory(newVariations[0], 'none', newVariations, 0, false, '#6366f1', 0);
        setHistory(prev => [{ id: Date.now().toString(), url: newVariations[0], timestamp: Date.now(), garment: garmentImage || undefined, prompt: garmentPrompt || undefined }, ...prev]);
      } else setError("AI failed to return variations.");
    } catch (err: any) { setError(err.message || "An error occurred."); } finally { setIsGenerating(false); }
  };

  // --- Page Renderers ---
  const renderStudio = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs mr-2">1</span>
              Your Photo
            </h2>
            <div className="flex space-x-2">
              {personImage && !useCamera && (
                <>
                  <button onClick={() => openCropper('person')} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="Crop Image"><i className="fas fa-crop-alt"></i></button>
                  <button onClick={removeBackground} disabled={isRemovingBackground} className={`p-2 rounded-lg transition-colors ${isRemovingBackground ? 'bg-indigo-50 text-indigo-300' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`} title="Remove Background"><i className={isRemovingBackground ? "fas fa-circle-notch animate-spin" : "fas fa-scissors"}></i></button>
                </>
              )}
              <button onClick={() => setUseCamera(!useCamera)} className={`p-2 rounded-lg ${useCamera ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}><i className="fas fa-camera"></i></button>
              <button onClick={() => personInputRef.current?.click()} className="p-2 bg-gray-100 text-gray-600 rounded-lg"><i className="fas fa-upload"></i></button>
              <input type="file" ref={personInputRef} hidden accept="image/*" onChange={(e) => handleFileChange(e, 'person')} />
            </div>
          </div>
          <div className="aspect-[3/4] rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden relative flex items-center justify-center">
            {useCamera ? (
              <div className="w-full h-full relative">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <button onClick={capturePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-gray-900"></div></button>
              </div>
            ) : personImage ? (
              <div className="w-full h-full relative">
                <img src={ensureDataUrl(personImage)!} className="w-full h-full object-cover" />
                {isRemovingBackground && <div className="absolute inset-0 bg-white/40 flex items-center justify-center"><span className="bg-white px-4 py-2 rounded-full shadow-lg text-xs font-bold">Removing Background...</span></div>}
              </div>
            ) : (
              <div className="text-center p-6 text-slate-400">
                <i className="fas fa-user-tie text-4xl mb-3 opacity-20"></i>
                <p className="text-sm font-medium">Upload portrait or use camera</p>
              </div>
            )}
            {personImage && !useCamera && !isRemovingBackground && <button onClick={() => setPersonImage(null)} className="absolute top-2 right-2 bg-black/50 text-white w-6 h-6 rounded-full text-xs"><i className="fas fa-times"></i></button>}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs mr-2">2</span>
              Select Garment
            </h2>
            <div className="flex space-x-2">
              <input type="file" ref={garmentInputRef} hidden accept="image/*" onChange={(e) => handleFileChange(e, 'garment')} />
            </div>
          </div>
          <div className="space-y-6">
            <div onClick={() => !garmentImage && garmentInputRef.current?.click()} className={`h-40 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden relative flex items-center justify-center group transition-all duration-300 ${!garmentImage ? 'cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30' : ''}`}>
              {isGeneratingGarment ? (
                <div className="text-center space-y-2">
                  <i className="fas fa-magic text-indigo-500 text-2xl animate-pulse"></i>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generating Garment...</p>
                </div>
              ) : garmentImage ? (
                <img src={ensureDataUrl(garmentImage)!} className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center p-4 text-slate-400">
                  <i className="fas fa-cloud-upload-alt text-3xl mb-2 opacity-20"></i>
                  <p className="text-xs font-medium">Click to upload your own garment</p>
                </div>
              )}
              {garmentImage && !isGeneratingGarment && <button onClick={() => setGarmentImage(null)} className="absolute top-2 right-2 bg-black/50 text-white w-6 h-6 rounded-full text-xs hover:bg-black/70 transition-colors"><i className="fas fa-times"></i></button>}
            </div>
            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
              {COMMON_GARMENTS.map((g) => (
                <button key={g.id} onClick={() => selectCommonGarment(g)} className={`flex-shrink-0 relative w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all ${garmentPrompt === g.prompt ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-100'}`} title={g.label}>
                  <img src={g.image} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <input type="text" value={garmentPrompt} onChange={(e) => setGarmentPrompt(e.target.value)} placeholder="E.g. 'a blue floral dress'..." className="block w-full pl-4 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
                <button onClick={() => garmentInputRef.current?.click()} className="px-4 rounded-xl shadow-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"><i className="fas fa-image"></i></button>
                <button onClick={generateGarmentImage} disabled={isGeneratingGarment || !garmentPrompt} className="px-4 rounded-xl shadow-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-300">
                  {isGeneratingGarment ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-wand-magic"></i>}
                </button>
              </div>
            </div>
          </div>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm flex items-start space-x-2"><i className="fas fa-exclamation-circle mt-0.5"></i><span>{error}</span></div>}
        <button onClick={generateTryOn} disabled={isGenerating || isRemovingBackground} className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center space-x-2 ${isGenerating ? 'bg-slate-200 text-slate-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
          {isGenerating ? <><i className="fas fa-circle-notch animate-spin"></i><span>Designing...</span></> : <><i className="fas fa-sparkles"></i><span>Generate Variations</span></>}
        </button>
      </div>

      <div className="lg:col-span-7 flex flex-col space-y-6">
        <div className="bg-white rounded-[2.5rem] p-4 sm:p-8 shadow-2xl border border-slate-100 flex-1 flex flex-col relative overflow-hidden">
          <div className="flex items-center justify-between mb-6 z-10">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-gray-800">The Look</h2>
              <div className="flex items-center bg-slate-50 rounded-lg p-1">
                <button onClick={handleUndo} disabled={wsIndex <= 0} className={`p-2 rounded-md ${wsIndex <= 0 ? 'text-slate-200' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`}><i className="fas fa-undo text-xs"></i></button>
                <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
                <button onClick={handleRedo} disabled={wsIndex >= wsHistory.length - 1} className={`p-2 rounded-md ${wsIndex >= wsHistory.length - 1 ? 'text-slate-200' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`}><i className="fas fa-redo text-xs"></i></button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="bg-slate-100 p-1 rounded-full flex items-center mr-2">
                <button onClick={() => setIsComparing(false)} className={`px-3 py-1 text-[10px] font-black uppercase rounded-full ${!isComparing ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Solo</button>
                <button onClick={() => setIsComparing(true)} disabled={!personImage || !resultImage} className={`px-3 py-1 text-[10px] font-black uppercase rounded-full ${isComparing ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Compare</button>
              </div>
              <button onClick={() => openCropper('result')} disabled={!resultImage} className="p-2 text-slate-400 hover:text-indigo-600" title="Crop Result"><i className="fas fa-crop-alt"></i></button>
              <button onClick={() => { setShowColorControl(!showColorControl); setShowStyleControl(false); setShowBlurControl(false); }} disabled={!resultImage} className={`p-2 rounded-lg ${showColorControl ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`}><i className="fas fa-palette"></i></button>
              <button onClick={() => { setShowStyleControl(!showStyleControl); setShowColorControl(false); setShowBlurControl(false); }} disabled={!resultImage || isStyling} className={`p-2 rounded-lg ${showStyleControl ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`}><i className="fas fa-paintbrush"></i></button>
              <button onClick={handlePortraitToggle} disabled={!resultImage} className={`p-2 rounded-lg ${isPortraitActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`}><i className="fas fa-user-circle"></i></button>
              <button onClick={handleShare} disabled={!resultImage || isSharing} className="p-2 text-slate-400 hover:text-indigo-600">{isSharing ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-share-alt"></i>}</button>
              <button onClick={handleDownload} disabled={!resultImage} className="p-2 text-slate-400 hover:text-indigo-600"><i className="fas fa-download"></i></button>
            </div>
          </div>
          
          {showColorControl && resultImage && (
            <div className="mb-6 bg-slate-50 p-5 rounded-[2rem] border border-slate-100 shadow-inner flex items-center space-x-6 z-10">
              <input type="color" value={customColor} onChange={(e) => handleCustomColorChange(e.target.value)} onBlur={commitColor} className="w-10 h-10 rounded-full border-2 border-white cursor-pointer" />
              <div className="flex-1 space-y-2">
                <input type="range" min="0" max="100" value={colorIntensity} onChange={(e) => handleIntensityChange(parseInt(e.target.value))} onMouseUp={commitColor} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
              </div>
              <button onClick={() => setShowColorControl(false)} className="text-slate-400 font-bold uppercase text-[10px]">Done</button>
            </div>
          )}

          {showStyleControl && resultImage && (
            <div className="mb-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col space-y-4 z-10">
              <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
                {STYLE_PRESETS.map((p) => (
                  <button key={p.id} onClick={() => selectStylePreset(p.url)} className={`flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden border-2 ${styleReference && p.url.includes(styleReference.slice(0, 10)) ? 'border-indigo-600' : 'border-transparent opacity-60'}`}><img src={p.url} className="w-full h-full object-cover" /></button>
                ))}
              </div>
              {styleReference && (
                <button onClick={applyStyleTransfer} disabled={isStyling} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs">
                  {isStyling ? 'Stylizing...' : 'Apply Art Style'}
                </button>
              )}
            </div>
          )}

          {showBlurControl && resultImage && isPortraitActive && (
            <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center space-x-4 z-10">
              <input type="range" min="0" max="20" value={blurAmount} onChange={(e) => handleBlurChange(parseInt(e.target.value))} onMouseUp={commitBlur} className="w-full h-1.5 bg-slate-200 rounded-lg accent-indigo-600" />
              <button onClick={() => setShowBlurControl(false)} className="text-slate-400 font-bold text-[10px]">Done</button>
            </div>
          )}

          <div className="flex-1 min-h-[450px] rounded-3xl bg-slate-100 overflow-hidden relative border border-slate-200/50 flex items-center justify-center">
            {isGenerating || isStyling ? (
              <div className="text-center space-y-4 z-20">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-500 font-medium">{isStyling ? 'Stylizing...' : 'Designing...'}</p>
              </div>
            ) : resultImage ? (
              <div className={`w-full h-full relative ${isComparing ? 'grid grid-cols-2 gap-0.5' : ''}`}>
                {isComparing && (
                  <div className="relative h-full"><img src={ensureDataUrl(personImage)!} className="w-full h-full object-cover" /><div className="absolute top-4 left-4 bg-black/50 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase">Before</div></div>
                )}
                <div className="relative h-full overflow-hidden">
                  <img src={resultImage} className="w-full h-full object-cover" style={{ filter: FILTERS.find(f => f.id === activeFilter)?.filterStr || 'none' }} />
                  {colorIntensity > 0 && <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: customColor, opacity: colorIntensity / 100, mixBlendMode: 'color' }} />}
                  {isPortraitActive && blurAmount > 0 && (
                    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url(${resultImage})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: `blur(${blurAmount}px)`, maskImage: 'radial-gradient(circle at center, transparent 20%, black 85%)', WebkitMaskImage: 'radial-gradient(circle at center, transparent 20%, black 85%)' }} />
                  )}
                  {!isComparing && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-2xl">
                      {FILTERS.map((f) => (
                        <button key={f.id} onClick={() => handleFilterChange(f.id)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold ${activeFilter === f.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>{f.label.toUpperCase()}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center p-12 max-w-sm">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-200 rounded-3xl flex items-center justify-center mx-auto mb-6"><i className="fas fa-sparkles text-3xl"></i></div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Ready for a makeover?</h3>
                <p className="text-slate-400 text-sm">Upload your photos to begin.</p>
              </div>
            )}
          </div>
        </div>

        {variations.length > 0 && !isGenerating && !isStyling && (
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex space-x-3 overflow-x-auto scrollbar-hide">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center w-full">
              <i className="fas fa-layer-group text-indigo-600 mr-2"></i>
              Style Variations
            </h3>
            {variations.map((v, idx) => (
              <div key={idx} onClick={() => selectVariation(v)} className={`flex-shrink-0 w-24 aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border-2 ${resultImage === v ? 'border-indigo-600 scale-105' : 'border-transparent opacity-70'}`}><img src={v} className="w-full h-full object-cover" /></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTrends = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end mb-10">
        <div><h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Style Trends</h1><p className="text-slate-500 mt-2">Curated AI fashion inspirations.</p></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {TREND_DATA.map((trend) => (
          <div key={trend.id} className="group bg-white rounded-[2rem] overflow-hidden shadow-lg border border-slate-100">
            <div className="relative aspect-[4/5] overflow-hidden">
              <img src={trend.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                <button onClick={() => goToStudio(trend.image, trend.title)} className="w-full bg-white py-3 rounded-xl font-bold text-sm">Try This Look</button>
              </div>
            </div>
            <div className="p-6"><h3 className="text-xl font-bold text-gray-800">{trend.title}</h3><p className="text-slate-500 text-sm mt-2">{trend.description}</p></div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderWardrobe = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10"><h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">My Wardrobe</h1><p className="text-slate-500 mt-2 text-lg">Your collection of saved looks.</p></div>
      {history.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-12 text-center border-2 border-dashed border-slate-200"><h3 className="text-2xl font-bold text-gray-800">Wardrobe is empty</h3><button onClick={() => setCurrentPage('studio')} className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg">Go to Studio</button></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {history.map((item) => (
            <div key={item.id} className="group relative aspect-[3/4] rounded-[2rem] overflow-hidden shadow-md border border-slate-100">
              <img src={item.url} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <button onClick={() => { addToWorkspaceHistory(item.url, 'none', [item.url]); setCurrentPage('studio'); }} className="w-full bg-white py-2.5 rounded-xl font-bold text-xs">View in Studio</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen pb-20 bg-[#fbfcfd]">
      <nav className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setCurrentPage('studio')}><div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">V</div><span className="text-xl font-black text-gray-900 tracking-tighter italic uppercase">Fashion Studio</span></div>
        <div className="hidden md:flex space-x-10 text-sm font-bold uppercase tracking-widest text-slate-400">
          <button onClick={() => setCurrentPage('studio')} className={currentPage === 'studio' ? 'text-indigo-600' : ''}>Studio</button>
          <button onClick={() => setCurrentPage('trends')} className={currentPage === 'trends' ? 'text-indigo-600' : ''}>Trends</button>
          <button onClick={() => setCurrentPage('wardrobe')} className={currentPage === 'wardrobe' ? 'text-indigo-600' : ''}>Wardrobe</button>
        </div>
        <button className="bg-gray-900 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all">Studio Pro</button>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {currentPage === 'studio' && renderStudio()}
        {currentPage === 'trends' && renderTrends()}
        {currentPage === 'wardrobe' && renderWardrobe()}
        <footer className="mt-16 mb-8 text-center animate-subtle-fade-in delay-700">
          <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.2em]">Generated by Gemini</p>
        </footer>
      </main>

      {/* Cropping Modal Overlay */}
      {showCropper && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-4xl flex flex-col h-full max-h-[85vh]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-xl flex items-center"><i className="fas fa-crop-alt mr-3 text-indigo-400"></i> Adjust Framing</h3>
              <button onClick={() => setShowCropper(false)} className="text-slate-400 hover:text-white transition-colors"><i className="fas fa-times text-xl"></i></button>
            </div>
            
            <div ref={cropperContainerRef} className="flex-1 bg-slate-900 rounded-3xl overflow-hidden relative border border-white/10 flex items-center justify-center">
              {/* Dynamic Crop Overlay Visualizer */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className={`border-2 border-indigo-500 shadow-[0_0_0_1000px_rgba(0,0,0,0.6)] transition-all duration-300 relative`} style={{
                  aspectRatio: cropAspectRatio === 'original' ? 'auto' : cropAspectRatio.replace(':', '/'),
                  width: cropAspectRatio === 'original' ? '80%' : 'auto',
                  height: cropAspectRatio === 'original' ? '80%' : 'auto',
                  maxHeight: '90%',
                  maxWidth: '90%'
                }}>
                   {/* Corner Handles */}
                   <div className="absolute -top-1 -left-1 w-3 h-3 bg-indigo-500 rounded-full"></div>
                   <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full"></div>
                   <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-500 rounded-full"></div>
                   <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full"></div>
                   {/* Rule of Thirds Grid */}
                   <div className="absolute inset-0 flex"><div className="w-1/3 border-r border-white/20 h-full"></div><div className="w-1/3 border-r border-white/20 h-full"></div></div>
                   <div className="absolute inset-0 flex flex-col"><div className="h-1/3 border-b border-white/20 w-full"></div><div className="h-1/3 border-b border-white/20 w-full"></div></div>
                </div>
              </div>
              {/* Removed ref={cropperImageRef} from here as we create a new Image() object inside applyCrop */}
              <img src={cropImage || ''} className="max-w-[95%] max-h-[95%] object-contain opacity-40 select-none" alt="Image to crop" />
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-white/5 space-x-1">
                {(['original', '1:1', '3:4', '4:3', '16:9'] as AspectRatio[]).map((ratio) => (
                  <button key={ratio} onClick={() => setCropAspectRatio(ratio)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${cropAspectRatio === ratio ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>{ratio}</button>
                ))}
              </div>
              <div className="flex items-center space-x-4 w-full sm:w-auto">
                <button onClick={() => setShowCropper(false)} className="px-8 py-3 rounded-2xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                <button onClick={applyCrop} className="flex-1 sm:flex-none px-10 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-900/40 hover:bg-indigo-700 active:scale-95 transition-all">Apply Crop</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 glass-panel flex justify-around py-4 z-50">
        <button onClick={() => setCurrentPage('studio')} className={`flex flex-col items-center ${currentPage === 'studio' ? 'text-indigo-600' : 'text-slate-400'}`}><i className="fas fa-magic"></i><span className="text-[10px] font-bold">Studio</span></button>
        <button onClick={() => setCurrentPage('trends')} className={`flex flex-col items-center ${currentPage === 'trends' ? 'text-indigo-600' : 'text-slate-400'}`}><i className="fas fa-compass"></i><span className="text-[10px] font-bold">Trends</span></button>
        <button onClick={() => setCurrentPage('wardrobe')} className={`flex flex-col items-center ${currentPage === 'wardrobe' ? 'text-indigo-600' : 'text-slate-400'}`}><i className="fas fa-box-open"></i><span className="text-[10px] font-bold">Wardrobe</span></button>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
