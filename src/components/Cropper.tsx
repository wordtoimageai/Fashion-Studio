import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CropperProps {
  imageSrc: string;
  aspectRatio: 'original' | '1:1' | '3:4' | '4:3' | '16:9';
  onCrop: (croppedImage: string) => void;
  onClose: () => void;
}

const Cropper: React.FC<CropperProps> = ({
  imageSrc,
  aspectRatio,
  onCrop,
  onClose,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cropRect, setCropRect] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeHandle, setActiveHandle] = useState<string | null>(null);

  const [currentAspectRatio, setCurrentAspectRatio] = useState(aspectRatio);

  const calculateCropRect = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    let newCropWidth = imgWidth;
    let newCropHeight = imgHeight;

    if (currentAspectRatio !== 'original') {
      const [ratioX, ratioY] = currentAspectRatio.split(':').map(Number);
      const targetRatio = ratioX / ratioY;
      const imgRatio = imgWidth / imgHeight;

      if (imgRatio > targetRatio) {
        newCropWidth = imgHeight * targetRatio;
        newCropHeight = imgHeight;
      } else {
        newCropWidth = imgWidth;
        newCropHeight = imgWidth / targetRatio;
      }
    }

    setCropRect({
      x: (imgWidth - newCropWidth) / 2,
      y: (imgHeight - newCropHeight) / 2,
      width: newCropWidth,
      height: newCropHeight,
    });
  }, [imageSrc, currentAspectRatio]);

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      if (imgRef.current) imgRef.current.src = imageSrc;
      calculateCropRect();
    };
  }, [imageSrc, calculateCropRect]);

  const getMousePos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;

    const mousePos = getMousePos(e, canvas);
    const img = imgRef.current;

    // Scale mouse position to natural image dimensions
    const scaleX = img.naturalWidth / canvas.width;
    const scaleY = img.naturalHeight / canvas.height;
    const naturalMouseX = mousePos.x * scaleX;
    const naturalMouseY = mousePos.y * scaleY;

    const handleSize = 20 * scaleX; // Approximate handle size in natural image pixels

    // Check if a handle is being dragged
    if (naturalMouseX >= cropRect.x - handleSize && naturalMouseX <= cropRect.x + handleSize &&
        naturalMouseY >= cropRect.y - handleSize && naturalMouseY <= cropRect.y + handleSize) {
      setActiveHandle('nw');
    } else if (naturalMouseX >= cropRect.x + cropRect.width - handleSize && naturalMouseX <= cropRect.x + cropRect.width + handleSize &&
               naturalMouseY >= cropRect.y - handleSize && naturalMouseY <= cropRect.y + handleSize) {
      setActiveHandle('ne');
    } else if (naturalMouseX >= cropRect.x - handleSize && naturalMouseX <= cropRect.x + handleSize &&
               naturalMouseY >= cropRect.y + cropRect.height - handleSize && naturalMouseY <= cropRect.y + cropRect.height + handleSize) {
      setActiveHandle('sw');
    } else if (naturalMouseX >= cropRect.x + cropRect.width - handleSize && naturalMouseX <= cropRect.x + cropRect.width + handleSize &&
               naturalMouseY >= cropRect.y + cropRect.height - handleSize && naturalMouseY <= cropRect.y + cropRect.height + handleSize) {
      setActiveHandle('se');
    } else if (naturalMouseX > cropRect.x && naturalMouseX < cropRect.x + cropRect.width &&
               naturalMouseY > cropRect.y && naturalMouseY < cropRect.y + cropRect.height) {
      // If inside crop area, start dragging the crop rect
      setIsDragging(true);
      setDragStart({
        x: naturalMouseX - cropRect.x,
        y: naturalMouseY - cropRect.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging && !activeHandle) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;

    const mousePos = getMousePos(e, canvas);
    const img = imgRef.current;

    // Scale mouse position to natural image dimensions
    const scaleX = img.naturalWidth / canvas.width;
    const scaleY = img.naturalHeight / canvas.height;
    const naturalMouseX = mousePos.x * scaleX;
    const naturalMouseY = mousePos.y * scaleY;

    setCropRect((prevRect) => {
      let { x, y, width, height } = prevRect;
      const minSize = 50; // Minimum crop size in natural image pixels

      if (activeHandle) {
        switch (activeHandle) {
          case 'nw':
            width += x - naturalMouseX;
            height += y - naturalMouseY;
            x = naturalMouseX;
            y = naturalMouseY;
            break;
          case 'ne':
            width = naturalMouseX - x;
            height += y - naturalMouseY;
            y = naturalMouseY;
            break;
          case 'sw':
            width += x - naturalMouseX;
            height = naturalMouseY - y;
            x = naturalMouseX;
            break;
          case 'se':
            width = naturalMouseX - x;
            height = naturalMouseY - y;
            break;
        }

        // Enforce minimum size
        if (width < minSize) { width = minSize; if (activeHandle.includes('w')) x = prevRect.x + prevRect.width - minSize; }
        if (height < minSize) { height = minSize; if (activeHandle.includes('n')) y = prevRect.y + prevRect.height - minSize; }

        // Maintain aspect ratio if set
        if (currentAspectRatio !== 'original') {
          const [ratioX, ratioY] = currentAspectRatio.split(':').map(Number);
          const targetRatio = ratioX / ratioY;
          const currentRatio = width / height;

          if (activeHandle.includes('n') || activeHandle.includes('s')) { // Vertical resize
            width = height * targetRatio;
          } else { // Horizontal resize
            height = width / targetRatio;
          }
        }

      } else if (isDragging) {
        x = naturalMouseX - dragStart.x;
        y = naturalMouseY - dragStart.y;
      }

      // Keep crop rect within image bounds
      x = Math.max(0, Math.min(x, img.naturalWidth - width));
      y = Math.max(0, Math.min(y, img.naturalHeight - height));
      width = Math.max(minSize, Math.min(width, img.naturalWidth - x));
      height = Math.max(minSize, Math.min(height, img.naturalHeight - y));

      return { x, y, width, height };
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setActiveHandle(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchend', handleMouseUp);

    return () => {
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseUp]);

  const drawCropper = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image scaled to fit canvas
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = canvas.width / canvas.height;

    let drawWidth = canvas.width;
    let drawHeight = canvas.height;
    let offsetX = 0;
    let offsetY = 0;

    if (imgRatio > canvasRatio) {
      drawHeight = canvas.width / imgRatio;
      offsetY = (canvas.height - drawHeight) / 2;
    } else {
      drawWidth = canvas.height * imgRatio;
      offsetX = (canvas.width - drawWidth) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    // Calculate crop rect in canvas coordinates
    const scaleX = drawWidth / img.naturalWidth;
    const scaleY = drawHeight / img.naturalHeight;

    const displayCropX = cropRect.x * scaleX + offsetX;
    const displayCropY = cropRect.y * scaleY + offsetY;
    const displayCropWidth = cropRect.width * scaleX;
    const displayCropHeight = cropRect.height * scaleY;

    // Draw darkened overlay outside crop area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(displayCropX, displayCropY, displayCropWidth, displayCropHeight);

    // Draw crop rectangle border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(displayCropX, displayCropY, displayCropWidth, displayCropHeight);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(displayCropX + displayCropWidth / 3, displayCropY);
    ctx.lineTo(displayCropX + displayCropWidth / 3, displayCropY + displayCropHeight);
    ctx.moveTo(displayCropX + displayCropWidth * 2 / 3, displayCropY);
    ctx.lineTo(displayCropX + displayCropWidth * 2 / 3, displayCropY + displayCropHeight);
    ctx.stroke();
    // Horizontal lines
    ctx.beginPath();
    ctx.moveTo(displayCropX, displayCropY + displayCropHeight / 3);
    ctx.lineTo(displayCropX + displayCropWidth, displayCropY + displayCropHeight / 3);
    ctx.moveTo(displayCropX, displayCropY + displayCropHeight * 2 / 3);
    ctx.lineTo(displayCropX + displayCropWidth, displayCropY + displayCropHeight * 2 / 3);
    ctx.stroke();

    // Draw handles
    const handleSize = 10; // Size of handles in canvas pixels
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    const handles = [
      { x: displayCropX, y: displayCropY, cursor: 'nwse-resize' },
      { x: displayCropX + displayCropWidth, y: displayCropY, cursor: 'nesw-resize' },
      { x: displayCropX, y: displayCropY + displayCropHeight, cursor: 'nesw-resize' },
      { x: displayCropX + displayCropWidth, y: displayCropY + displayCropHeight, cursor: 'nwse-resize' },
    ];

    handles.forEach(handle => {
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    });

  }, [cropRect]);

  useEffect(() => {
    drawCropper();
  }, [cropRect, drawCropper]);

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = cropRect.width;
    canvas.height = cropRect.height;

    ctx.drawImage(
      img,
      cropRect.x,
      cropRect.y,
      cropRect.width,
      cropRect.height,
      0,
      0,
      cropRect.width,
      cropRect.height
    );

    onCrop(canvas.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">Crop Image</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><i className="fas fa-times text-lg"></i></button>
        </div>

        <div className="flex-1 relative bg-gray-100 rounded-xl overflow-hidden mb-4 flex items-center justify-center">
          <img ref={imgRef} src={imageSrc} alt="Crop" className="max-w-full max-h-full object-contain" style={{ display: 'none' }} />
          <canvas
            ref={canvasRef}
            width={imgRef.current?.naturalWidth || 800}
            height={imgRef.current?.naturalHeight || 600}
            className="max-w-full max-h-full object-contain cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-2xl space-x-1 overflow-x-auto max-w-full">
            {(['original', '1:1', '3:4', '4:3', '16:9'] as const).map((ratio) => (
              <button
                key={ratio}
                onClick={() => setCurrentAspectRatio(ratio)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                  currentAspectRatio === ratio
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
          <div className="flex space-x-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-3 rounded-full bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCrop}
              className="flex-1 sm:flex-none px-6 py-3 rounded-full bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cropper;
