import React, { useState, useRef, useEffect, useCallback } from 'react';
import Cropper from './src/components/Cropper';
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

const ECOMMERCE_SUGGESTIONS = [
  { id: 'es1', label: 'Floral Maxi Dress', image: 'https://images.unsplash.com/photo-1596752007018-97217a151dc3?auto=format&fit=crop&w=300&q=80', prompt: 'a vibrant floral maxi dress', shopLink: 'https://example.com/floral-maxi-dress' },
  { id: 'es2', label: 'Casual Denim Jeans', image: 'https://images.unsplash.com/photo-1541099645162-678567119f07?auto=format&fit=crop&w=300&q=80', prompt: 'a pair of relaxed fit blue denim jeans', shopLink: 'https://example.com/denim-jeans' },
  { id: 'es3', label: 'White Button-Up Shirt', image: 'https://images.unsplash.com/photo-1603254944470-4963866175e1?auto=format&fit=crop&w=300&q=80', prompt: 'a crisp white cotton button-up shirt', shopLink: 'https://example.com/white-shirt' },
  { id: 'es4', label: 'Striped T-Shirt', image: 'https://images.unsplash.com/photo-1620862590212-e87f642643a6?auto=format&fit=crop&w=300&q=80', prompt: 'a classic navy and white striped t-shirt', shopLink: 'https://example.com/striped-tshirt' },
  { id: 'es5', label: 'Black Pencil Skirt', image: 'https://images.unsplash.com/photo-1582559535032-475a7c2e0b50?auto=format&fit=crop&w=300&q=80', prompt: 'a sleek black pencil skirt', shopLink: 'https://example.com/pencil-skirt' },
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
  // const cropperContainerRef = useRef<HTMLDivElement>(null); // Removed as it's now handled within Cropper component

  // --- Active Workspace State ---
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('none');
  const [blurAmount, setBlurAmount] = useState(0);
  const [isPortraitActive, setIsPortraitActive] = useState(false);
  const [foregroundCache, setForegroundCache] = useState<Record<string, string>>({});
  const [isGeneratingForeground, setIsGeneratingForeground] = useState(false);
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
  const styleInputRef = useRef<HTMLInputElement>(null); // Ref for style image upload

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

  // --- Cropping Logic ---
  const openCropper = useCallback((target: 'person' | 'result') => {
    const imgSource = target === 'person' ? ensureDataUrl(personImage) : resultImage;
    if (!imgSource) return;
    setCropTarget(target);
    setCropImage(imgSource);
    setCropAspectRatio('original'); // Reset aspect ratio when opening cropper
    setShowCropper(true);
  }, [personImage, resultImage]);

  const handleApplyCrop = useCallback((croppedDataUrl: string) => {
    if (!cropTarget) return;
    if (cropTarget === 'person') {
      setPersonImage(cleanBase64(croppedDataUrl));
    } else {
      addToWorkspaceHistory(croppedDataUrl, activeFilter, variations, blurAmount, isPortraitActive, customColor, colorIntensity);
    }
    setShowCropper(false);
  }, [cropTarget, activeFilter, variations, blurAmount, isPortraitActive, customColor, colorIntensity]);

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

  const handlePortraitToggle = async () => {
    if (!resultImage) return;
    const nextPortraitState = !isPortraitActive;
    
    if (nextPortraitState && !foregroundCache[resultImage]) {
      setIsGeneratingForeground(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [
            { inlineData: { mimeType: 'image/png', data: cleanBase64(resultImage) } },
            { text: "Remove the background from this image. Keep only the person in the foreground." },
          ]},
        });
        let foundImage = false;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            const fgImage = `data:image/png;base64,${cleanBase64(part.inlineData.data)}`;
            setForegroundCache(prev => ({ ...prev, [resultImage]: fgImage }));
            foundImage = true;
            break;
          }
        }
        if (!foundImage) throw new Error("Failed to generate foreground.");
      } catch (err: any) {
        setError("Error generating portrait mode: " + (err.message || "Unknown error"));
        setIsGeneratingForeground(false);
        return; // Don't toggle if failed
      }
      setIsGeneratingForeground(false);
    }

    setIsPortraitActive(nextPortraitState);
    const nextBlurAmount = (nextPortraitState && blurAmount === 0) ? 8 : blurAmount;
    setBlurAmount(nextBlurAmount);
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

  const selectEcommerceGarment = async (item: typeof ECOMMERCE_SUGGESTIONS[0]) => {
    setError(null);
    try {
      const base64 = await urlToBase64(item.image); // Use item.image as the source for the try-on
      setGarmentImage(base64);
      setGarmentPrompt(item.prompt); // Update prompt for context
    } catch (err) {
      setError("Failed to load e-commerce garment image.");
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
          { inlineData: { mimeType: 'image/jpeg', data: styleBase64 } }, // Assuming style images are typically JPEG or can be converted.
          { text: "Apply the artistic style of the second image to the content of the first image." }
        ]},
      });
      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const stylizedImage = `data:image/png;base64,${part.inlineData.data}`;
          // Make the stylized image the new current result and add to variations
          addToWorkspaceHistory(stylizedImage, activeFilter, [...variations, stylizedImage], blurAmount, isPortraitActive, customColor, colorIntensity);
          foundImage = true;
          setShowStyleControl(false); // Close style control after applying
          break;
        }
      }
      if (!foundImage) setError("Model failed to stylize the image.");
    } catch (err: any) {
      setError("Style transfer error: " + (err.message || "Unknown error"));
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
  const renderCropper = () => {
    if (!cropImage || !cropTarget) return null;
    return (
      <Cropper
        imageSrc={cropImage}
        aspectRatio={cropAspectRatio}
        onCrop={handleApplyCrop}
        onClose={() => setShowCropper(false)}
      />
    );
  };

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
                <img src={ensureDataUrl(personImage)!} className="w-full h-full object-cover" alt="Your Photo" />
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

        {/* Select Garment Section - Redesigned */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center mb-6">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs mr-2">2</span>
            Select Garment
          </h2>

          {/* Current Garment Display */}
          <div className="h-40 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden relative flex items-center justify-center group transition-all duration-300 mb-6">
            {isGeneratingGarment ? (
              <div className="text-center space-y-2">
                <i className="fas fa-magic text-indigo-500 text-2xl animate-pulse"></i>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generating Garment...</p>
              </div>
            ) : garmentImage ? (
              <img src={ensureDataUrl(garmentImage)!} className="w-full h-full object-contain p-2" alt="Selected Garment" />
            ) : (
              <div className="text-center p-4 text-slate-400 transition-transform group-hover:scale-105">
                <i className="fas fa-cloud-upload-alt text-3xl mb-2 opacity-20 group-hover:opacity-40"></i>
                <p className="text-xs font-medium">Upload, generate, or select a garment</p>
              </div>
            )}
            {garmentImage && !isGeneratingGarment && <button onClick={() => setGarmentImage(null)} className="absolute top-2 right-2 bg-black/50 text-white w-6 h-6 rounded-full text-xs hover:bg-black/70 transition-colors"><i className="fas fa-times"></i></button>}
          </div>

          {/* Upload Your Own */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Your Files</span>
              <button onClick={() => garmentInputRef.current?.click()} className="text-[10px] font-black uppercase text-indigo-600 hover:underline">Upload Image</button>
              <input type="file" ref={garmentInputRef} hidden accept="image/*" onChange={(e) => handleFileChange(e, 'garment')} />
            </div>
            {/* The main garment display acts as the primary upload target too */}
          </div>

          {/* Design with AI */}
          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">AI Garment Factory</span>
              <span className="text-[10px] text-slate-300">Generate New</span>
            </div>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <input 
                  type="text" value={garmentPrompt} onChange={(e) => setGarmentPrompt(e.target.value)} 
                  placeholder="E.g. 'a blue floral dress'..." 
                  className="block w-full pl-4 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                  <i className="fas fa-pen-nib text-xs"></i>
                </div>
              </div>
              <button 
                onClick={generateGarmentImage}
                disabled={isGeneratingGarment || !garmentPrompt}
                className={`px-4 rounded-xl shadow-md transition-all flex items-center justify-center ${isGeneratingGarment || !garmentPrompt ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-100'}`}
                title="Generate with AI"
              >
                {isGeneratingGarment ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-wand-magic"></i>}
              </button>
            </div>
          </div>

          {/* Quick Picks / Essentials */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3 px-1">
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Essentials</span>
               <span className="text-[10px] text-slate-300">Quick Select</span>
            </div>
            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide mask-fade-right">
              {COMMON_GARMENTS.map((g) => (
                <button 
                  key={g.id} 
                  onClick={() => selectCommonGarment(g)}
                  className={`flex-shrink-0 group relative w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all transform active:scale-95 ${garmentPrompt === g.prompt ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-100 hover:border-indigo-200'}`}
                  title={g.label}
                >
                  <img src={g.image} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={g.label} />
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors"></div>
                </button>
              ))}
            </div>
          </div>

          {/* Shop the Trends (New E-commerce Suggestions) */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Shop the Trends</span>
              <span className="text-[10px] text-slate-300">Curated by AI</span>
            </div>
            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide mask-fade-right">
              {ECOMMERCE_SUGGESTIONS.map((g) => (
                <div key={g.id} className="flex-shrink-0 group relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-100 hover:border-indigo-200 transition-all transform active:scale-95">
                  <img src={g.image} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={g.label} />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <button
                      onClick={() => selectEcommerceGarment(g)}
                      className="bg-white text-indigo-600 text-[10px] font-black px-3 py-1.5 rounded-full uppercase shadow-md hover:bg-indigo-50 transition-colors"
                    >
                      Try On
                    </button>
                     <a href={g.shopLink} target="_blank" rel="noopener noreferrer"
                       className="ml-2 bg-indigo-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase shadow-md hover:bg-indigo-700 transition-colors"
                     >
                      Shop
                     </a>
                  </div>
                </div>
              ))}
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
              <button onClick={() => { setShowColorControl(!showColorControl); setShowStyleControl(false); }} disabled={!resultImage} className={`p-2 rounded-lg ${showColorControl ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`}><i className="fas fa-palette"></i></button>
              <button onClick={() => { setShowStyleControl(!showStyleControl); setShowColorControl(false); }} disabled={!resultImage || isStyling} className={`p-2 rounded-lg ${showStyleControl ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`}><i className="fas fa-paintbrush"></i></button>
              <button onClick={handlePortraitToggle} disabled={!resultImage || isGeneratingForeground} className={`p-2 rounded-lg ${isPortraitActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`}>
                {isGeneratingForeground ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-user-circle"></i>}
              </button>
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
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Style Presets</span>
                <span className="text-[10px] text-slate-300">Quick Select</span>
              </div>
              <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide mask-fade-right">
                {STYLE_PRESETS.map((p) => (
                  <button 
                    key={p.id} 
                    onClick={() => selectStylePreset(p.url)} 
                    className={`flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden border-2 ${styleReference === (cleanBase64(p.url) || null) ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-100 hover:border-indigo-200 opacity-80'}`}
                    title={p.label}
                  >
                    <img src={p.url} className="w-full h-full object-cover" alt={p.label} />
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 mb-3 px-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Custom Style</span>
                <button onClick={() => styleInputRef.current?.click()} className="text-[10px] font-black uppercase text-indigo-600 hover:underline">Upload Image</button>
                <input type="file" ref={styleInputRef} hidden accept="image/*" onChange={handleStyleFileChange} />
              </div>
              {styleReference && (
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-indigo-600 ring-2 ring-indigo-100 flex-shrink-0">
                    <img src={ensureDataUrl(styleReference)!} className="w-full h-full object-cover" alt="Selected Style" />
                  </div>
                  <span className="text-sm text-slate-600">Selected custom style.</span>
                  <button onClick={() => setStyleReference(null)} className="ml-auto text-slate-400 hover:text-red-500 text-xs"><i className="fas fa-times"></i></button>
                </div>
              )}
              <button onClick={applyStyleTransfer} disabled={isStyling || !resultImage || !styleReference} className={`w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs ${isStyling ? 'bg-slate-200 text-slate-500' : 'hover:bg-indigo-700 active:scale-95'}`}>
                {isStyling ? <><i className="fas fa-circle-notch animate-spin mr-2"></i>Stylizing...</> : 'Apply Art Style'}
              </button>
              <button onClick={() => setShowStyleControl(false)} className="text-slate-400 font-bold uppercase text-[10px] mt-2">Done</button>
            </div>
          )}

          {isPortraitActive && resultImage && !showColorControl && !showStyleControl && (
            <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center space-x-4 z-10">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Blur</span>
              <input type="range" min="0" max="20" value={blurAmount} onChange={(e) => handleBlurChange(parseInt(e.target.value))} onMouseUp={commitBlur} className="w-full h-1.5 bg-slate-200 rounded-lg accent-indigo-600" />
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
                  <div className="relative h-full"><img src={ensureDataUrl(personImage)!} className="w-full h-full object-cover" alt="Before" /><div className="absolute top-4 left-4 bg-black/50 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase">Before</div></div>
                )}
                <div className="relative h-full overflow-hidden">
                  <img src={resultImage} className="w-full h-full object-cover" style={{ filter: `${FILTERS.find(f => f.id === activeFilter)?.filterStr || 'none'} ${(isPortraitActive && blurAmount > 0 && foregroundCache[resultImage]) ? `blur(${blurAmount}px)` : ''}`.trim() }} alt="After" />
                  
                  {isPortraitActive && blurAmount > 0 && foregroundCache[resultImage] && (
                    <img src={foregroundCache[resultImage]} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ filter: FILTERS.find(f => f.id === activeFilter)?.filterStr || 'none' }} alt="Foreground" />
                  )}

                  {colorIntensity > 0 && <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: customColor, opacity: colorIntensity / 100, mixBlendMode: 'color' }} />}
                  
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
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 ">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center">
              <i className="fas fa-layer-group text-indigo-600 mr-2"></i>
              Style Variations
            </h3>
            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
              {variations.map((v, idx) => (
                <div key={idx} onClick={() => selectVariation(v)} className={`flex-shrink-0 w-24 aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border-2 ${resultImage === v ? 'border-indigo-600 scale-105' : 'border-transparent opacity-70'}`}><img src={v} className="w-full h-full object-cover" alt={`Variation ${idx + 1}`} /></div>
              ))}
            </div>
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
              <img src={trend.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={trend.title} />
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
              <img src={item.url} className="w-full h-full object-cover" alt="History item" />
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

      {showCropper && renderCropper()}

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