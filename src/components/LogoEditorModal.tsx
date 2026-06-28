import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Crop, Sliders, Sun, Contrast, Eraser, Check, 
  RotateCcw, Maximize, Palette, Eye, ArrowLeftRight, Type
} from 'lucide-react';

interface LogoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (editedBase64: string) => void;
}

export default function LogoEditorModal({ isOpen, onClose, imageSrc, onSave }: LogoEditorModalProps) {
  const [zoom, setZoom] = useState<number>(1.0);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<'original' | '1:1' | '16:9' | '3:1' | 'free'>('original');
  const [logoHeight, setLogoHeight] = useState<number>(40); // Target display height in px
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [customWidth, setCustomWidth] = useState<number>(300);
  const [customHeight, setCustomHeight] = useState<number>(150);
  
  // Advanced rotation and flipping
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);

  // Background adjustment
  const [bgMode, setBgMode] = useState<'transparent' | 'solid' | 'original'>('transparent');
  const [solidBgColor, setSolidBgColor] = useState<string>('#ffffff');
  
  // Background removal options
  const [removeBg, setRemoveBg] = useState<boolean>(false);
  const [removeBgColor, setRemoveBgColor] = useState<'white' | 'black'>('white');
  const [removeBgThreshold, setRemoveBgThreshold] = useState<number>(40); // tolerance

  // Color filters
  const [brightness, setBrightness] = useState<number>(100); // 50 to 150
  const [contrast, setContrast] = useState<number>(100); // 50 to 200
  const [grayscale, setGrayscale] = useState<number>(0); // 0 to 100
  const [invert, setInvert] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Re-load image when imageSrc changes
  useEffect(() => {
    if (!imageSrc) return;
    setLoading(true);
    setErrorMsg('');
    const img = new Image();
    img.crossOrigin = 'anonymous'; // support outer URLs if allowed
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      setLoading(false);
      resetControls();
    };
    img.onerror = () => {
      // Try again without anonymous if it failed due to CORS
      const imgFallback = new Image();
      imgFallback.src = imageSrc;
      imgFallback.onload = () => {
        imageRef.current = imgFallback;
        setLoading(false);
        resetControls();
      };
      imgFallback.onerror = () => {
        setErrorMsg('Failed to load logo image. Ensure it is a valid image or local file.');
        setLoading(false);
      };
    };
  }, [imageSrc]);

  const resetControls = () => {
    setZoom(1.0);
    setOffsetX(0);
    setOffsetY(0);
    setAspectRatio('original');
    setLockAspectRatio(true);
    setCustomWidth(300);
    setCustomHeight(150);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setBgMode('transparent');
    setRemoveBg(false);
    setRemoveBgColor('white');
    setRemoveBgThreshold(40);
    setBrightness(100);
    setContrast(100);
    setGrayscale(0);
    setInvert(false);
  };

  // Perform canvas drawing
  useEffect(() => {
    if (loading || !imageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;

    // 1. Determine output canvas dimensions based on chosen aspect ratio
    let canvasWidth = 400;
    let canvasHeight = 150;

    if (aspectRatio === 'original') {
      const imgRatio = img.width / img.height;
      if (imgRatio > 3) {
        canvasWidth = 400;
        canvasHeight = 400 / imgRatio;
      } else if (imgRatio < 0.5) {
        canvasHeight = 250;
        canvasWidth = 250 * imgRatio;
      } else {
        canvasWidth = 300;
        canvasHeight = 300 / imgRatio;
      }
    } else if (aspectRatio === '1:1') {
      canvasWidth = 200;
      canvasHeight = 200;
    } else if (aspectRatio === '16:9') {
      canvasWidth = 320;
      canvasHeight = 180;
    } else if (aspectRatio === '3:1') {
      canvasWidth = 360;
      canvasHeight = 120;
    } else if (aspectRatio === 'free') {
      canvasWidth = customWidth;
      canvasHeight = customHeight;
    }

    // Set canvas dimensions
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 2. Clear & Fill Background
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    if (bgMode === 'solid') {
      ctx.fillStyle = solidBgColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else if (bgMode === 'original') {
      // Original backdrop (usually white if JPG, transparent if PNG)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // 3. Draw image with scale/translation (cropping & zoom, rotation & flip)
    const imgRatio = img.width / img.height;
    const canvasRatio = canvasWidth / canvasHeight;

    let drawWidth = canvasWidth;
    let drawHeight = canvasHeight;

    // Fit image inside canvas first (letterbox style), then scale with zoom
    if (imgRatio > canvasRatio) {
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / imgRatio;
    } else {
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * imgRatio;
    }

    // Apply zoom
    drawWidth *= zoom;
    drawHeight *= zoom;

    // Coordinates to center the image plus custom panning offset
    const x = (canvasWidth - drawWidth) / 2 + offsetX;
    const y = (canvasHeight - drawHeight) / 2 + offsetY;

    const drawToCtx = (targetCtx: CanvasRenderingContext2D) => {
      targetCtx.save();
      // Translate to center of drawing area to rotate/flip
      targetCtx.translate(x + drawWidth / 2, y + drawHeight / 2);
      targetCtx.rotate((rotation * Math.PI) / 180);
      targetCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      targetCtx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      targetCtx.restore();
    };

    // Draw to temp canvas first if we need background removal
    if (removeBg) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasWidth;
      tempCanvas.height = canvasHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        // Draw image to temp canvas
        drawToCtx(tempCtx);
        const imgData = tempCtx.getImageData(0, 0, canvasWidth, canvasHeight);
        const data = imgData.data;

        // Background removal algorithm
        // Threshold match for white or black
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a === 0) continue;

          let isMatch = false;
          if (removeBgColor === 'white') {
            // White/light colors (R, G, B are high)
            const minColor = 255 - removeBgThreshold;
            if (r >= minColor && g >= minColor && b >= minColor) {
              isMatch = true;
            }
          } else {
            // Black/dark colors (R, G, B are low)
            const maxColor = removeBgThreshold;
            if (r <= maxColor && g <= maxColor && b <= maxColor) {
              isMatch = true;
            }
          }

          if (isMatch) {
            // Set alpha to 0
            data[i + 3] = 0;
          }
        }
        tempCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0);
      }
    } else {
      drawToCtx(ctx);
    }

    // 4. Apply CSS/Filters on the main canvas image data if needed
    // Filters: brightness, contrast, grayscale, invert
    if (brightness !== 100 || contrast !== 100 || grayscale > 0 || invert) {
      const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        const a = data[i + 3];

        if (a === 0) continue;

        // Invert
        if (invert) {
          r = 255 - r;
          g = 255 - g;
          b = 255 - b;
        }

        // Grayscale
        if (grayscale > 0) {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          const factor = grayscale / 100;
          r = r * (1 - factor) + gray * factor;
          g = g * (1 - factor) + gray * factor;
          b = b * (1 - factor) + gray * factor;
        }

        // Brightness
        if (brightness !== 100) {
          const factor = brightness / 100;
          r = Math.min(255, Math.max(0, r * factor));
          g = Math.min(255, Math.max(0, g * factor));
          b = Math.min(255, Math.max(0, b * factor));
        }

        // Contrast
        if (contrast !== 100) {
          const factor = contrast / 100;
          r = Math.min(255, Math.max(0, (r - 128) * factor + 128));
          g = Math.min(255, Math.max(0, (g - 128) * factor + 128));
          b = Math.min(255, Math.max(0, (b - 128) * factor + 128));
        }

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
      ctx.putImageData(imgData, 0, 0);
    }

  }, [
    loading, aspectRatio, zoom, offsetX, offsetY, bgMode, solidBgColor, 
    removeBg, removeBgColor, removeBgThreshold, brightness, contrast, grayscale, invert,
    customWidth, customHeight, rotation, flipH, flipV
  ]);

  const handleDrag = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1) return; // Only drag with left click
    setOffsetX(prev => prev + e.movementX);
    setOffsetY(prev => prev + e.movementY);
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    try {
      // Export at high resolution PNG
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onSave(dataUrl);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Security error exporting canvas logo (CORS). Please try uploading a local image instead.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 font-sans select-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/65 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Editor Modal Window */}
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-150 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden z-10 transition-all">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-650 rounded-2xl">
              <Crop size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Interactive Logo Designer</h3>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Crop, remove background, invert colors & set brand layout</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-150 text-slate-400 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Workspace Splitted Layout */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50/20">
          
          {/* LEFT: Live Preview Canvas (Col 7) */}
          <div className="md:col-span-7 flex flex-col items-center justify-center bg-slate-100/70 rounded-2xl border border-slate-200/60 p-4 relative min-h-[250px] md:min-h-[380px]">
            <div className="absolute top-3 left-3 flex gap-2">
              <span className="text-[8px] font-black uppercase text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5 select-none tracking-widest shadow-2xs">
                Live Interactive Canvas
              </span>
              <span className="text-[8px] font-mono font-bold text-slate-500 bg-indigo-50/50 border border-indigo-100 rounded px-1.5 py-0.5 select-none">
                Drag to position image
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
                <p className="text-[10px] text-slate-500 font-bold">Loading logo source...</p>
              </div>
            ) : errorMsg ? (
              <div className="text-center p-4">
                <p className="text-xs font-bold text-rose-600">{errorMsg}</p>
                <button 
                  onClick={resetControls}
                  className="mt-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                >
                  Reset Settings
                </button>
              </div>
            ) : (
              <div 
                ref={containerRef}
                className="relative border-2 border-dashed border-slate-300 rounded-xl bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] max-w-full p-4 flex items-center justify-center bg-white shadow-sm"
              >
                <canvas 
                  ref={canvasRef}
                  onMouseMove={handleDrag}
                  className="cursor-move max-w-full rounded border border-slate-200 shadow-sm"
                  title="Drag mouse to re-position logo inside bounding area"
                />
              </div>
            )}

            {/* Quick Helper Button Row */}
            {!loading && !errorMsg && (
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={resetControls}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 transition-all active:scale-97 cursor-pointer shadow-2xs"
                >
                  <RotateCcw size={10} /> Reset Canvas
                </button>
                <button
                  type="button"
                  onClick={() => { setOffsetX(0); setOffsetY(0); setZoom(1.0); }}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 transition-all active:scale-97 cursor-pointer shadow-2xs"
                >
                  <Maximize size={10} /> Recenter
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Controls (Col 5) */}
          <div className="md:col-span-5 space-y-4 text-left overflow-y-auto max-h-[460px] pr-1">
            
            {/* Tab Section: Layout & Aspect Ratio */}
            <div className="bg-white rounded-2xl border border-slate-150 p-4 space-y-3.5 shadow-2xs">
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5 text-indigo-600">
                <Crop size={11} className="stroke-[2.5px]" />
                1. Frame & Dimensions
              </h4>

              {/* Lock Aspect Ratio Toggle */}
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                <div>
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">Lock Selection Frame Ratio</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Use predefined aspect ratios or unlock for custom free size</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={lockAspectRatio}
                  onChange={(e) => {
                    setLockAspectRatio(e.target.checked);
                    if (e.target.checked) {
                      setAspectRatio('original');
                    } else {
                      setAspectRatio('free');
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer accent-indigo-600 focus:ring-0"
                />
              </div>

              {/* Aspect Ratio Picker (If Locked) */}
              {lockAspectRatio ? (
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Bounding Aspect Ratio</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['original', '1:1', '16:9', '3:1'] as const).map(ratio => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`py-1.5 px-1 border rounded-xl font-bold text-[9px] text-center transition-all cursor-pointer capitalize ${
                          aspectRatio === ratio
                            ? "bg-indigo-600 text-white border-transparent shadow-xs"
                            : "bg-white text-slate-650 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {ratio === 'original' ? 'Source' : ratio}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Custom Width/Height Sliders (If Unlocked) */
                <div className="space-y-2.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-150/60">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Free-Size Dimension Controls</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                        <span>Width</span>
                        <span className="text-indigo-605 font-mono font-bold">{customWidth}px</span>
                      </div>
                      <input 
                        type="range"
                        min="100"
                        max="500"
                        step="10"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                        <span>Height</span>
                        <span className="text-indigo-605 font-mono font-bold">{customHeight}px</span>
                      </div>
                      <input 
                        type="range"
                        min="50"
                        max="300"
                        step="10"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Graphic Manipulation Rotation & Flip Tool Box */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 space-y-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Rotate & Flip Graphic</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                    className="flex-1 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-[9.5px] font-bold text-slate-600 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                  >
                    <RotateCcw size={10} className="transform rotate-90" /> Rotate 90°
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipH(prev => !prev)}
                    className={`flex-1 py-1.5 text-[9.5px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      flipH 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-750 font-black" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowLeftRight size={10} /> Flip H
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipV(prev => !prev)}
                    className={`flex-1 py-1.5 text-[9.5px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      flipV 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-750 font-black" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowLeftRight size={10} className="transform rotate-90" /> Flip V
                  </button>
                </div>
              </div>

              {/* Zoom Slider */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Image Scale / Zoom</label>
                  <span className="text-[9px] font-mono font-bold text-indigo-600">{(zoom * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.05"
                  value={zoom}
                  onChange={e => setZoom(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            {/* Tab Section: Background & Magic Remove */}
            <div className="bg-white rounded-2xl border border-slate-150 p-4 space-y-3.5 shadow-2xs">
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5 text-indigo-600">
                <Eraser size={11} className="stroke-[2.5px]" />
                2. Canvas Background & Magic Erase
              </h4>

              {/* Background fill mode */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Canvas Backdrop Fill</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['transparent', 'solid', 'original'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBgMode(mode)}
                      className={`py-1.5 px-1.5 border rounded-xl font-bold text-[9px] text-center transition-all cursor-pointer capitalize ${
                        bgMode === mode
                          ? "bg-indigo-600 text-white border-transparent shadow-xs"
                          : "bg-white text-slate-650 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Solid fill color picker */}
              {bgMode === 'solid' && (
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Fill Color:</span>
                  <input 
                    type="color" 
                    value={solidBgColor}
                    onChange={e => setSolidBgColor(e.target.value)}
                    className="w-8 h-6 rounded border border-slate-200 cursor-pointer"
                  />
                  <input 
                    type="text" 
                    value={solidBgColor}
                    onChange={e => setSolidBgColor(e.target.value)}
                    className="text-[10px] font-mono font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded w-16"
                  />
                </div>
              )}

              {/* Magic Background Remover */}
              <div className="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="checkbox" 
                      id="magic-remove-checkbox"
                      checked={removeBg}
                      onChange={e => setRemoveBg(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                    />
                    <label htmlFor="magic-remove-checkbox" className="text-[10px] font-black text-slate-750 uppercase tracking-wider cursor-pointer">
                      Magic Background Eraser
                    </label>
                  </div>
                  <span className="bg-indigo-600 text-white font-black text-[7px] tracking-wider px-1.5 py-0.5 rounded uppercase">AI-Lite</span>
                </div>

                {removeBg && (
                  <div className="space-y-2 pt-1 border-t border-indigo-100/50">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRemoveBgColor('white')}
                        className={`px-2 py-1 border rounded-lg text-[8px] font-black uppercase tracking-wider w-full ${
                          removeBgColor === 'white'
                            ? "bg-white border-indigo-300 text-indigo-700 shadow-3xs"
                            : "bg-slate-100 border-slate-200 text-slate-500"
                        }`}
                      >
                        White Background
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveBgColor('black')}
                        className={`px-2 py-1 border rounded-lg text-[8px] font-black uppercase tracking-wider w-full ${
                          removeBgColor === 'black'
                            ? "bg-zinc-900 border-transparent text-white shadow-3xs"
                            : "bg-slate-100 border-slate-200 text-slate-500"
                        }`}
                      >
                        Black Background
                      </button>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Color Sensitivity Tolerance</span>
                        <span className="text-[9px] font-mono font-bold text-slate-600">{removeBgThreshold}</span>
                      </div>
                      <input 
                        type="range"
                        min="5"
                        max="120"
                        step="1"
                        value={removeBgThreshold}
                        onChange={e => setRemoveBgThreshold(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tab Section: Color Filters & Sliders */}
            <div className="bg-white rounded-2xl border border-slate-150 p-4 space-y-3.5 shadow-2xs">
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5 text-indigo-600">
                <Sliders size={11} className="stroke-[2.5px]" />
                3. Graphic Filters & Color Tune
              </h4>

              <div className="grid grid-cols-2 gap-3.5">
                {/* Brightness */}
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Brightness</span>
                    <span className="text-[9px] font-mono font-bold text-slate-600">{brightness}%</span>
                  </div>
                  <input 
                    type="range"
                    min="50"
                    max="150"
                    step="5"
                    value={brightness}
                    onChange={e => setBrightness(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Contrast */}
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Contrast</span>
                    <span className="text-[9px] font-mono font-bold text-slate-600">{contrast}%</span>
                  </div>
                  <input 
                    type="range"
                    min="50"
                    max="200"
                    step="5"
                    value={contrast}
                    onChange={e => setContrast(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Grayscale */}
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Grayscale</span>
                    <span className="text-[9px] font-mono font-bold text-slate-600">{grayscale}%</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={grayscale}
                    onChange={e => setGrayscale(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Invert Color Toggle */}
                <div className="flex items-center justify-between border border-slate-150 p-2 rounded-xl bg-slate-50">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Invert Colors</span>
                  <button
                    type="button"
                    onClick={() => setInvert(p => !p)}
                    className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${
                      invert 
                        ? "bg-rose-500 text-white border-transparent" 
                        : "bg-white border border-slate-250 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {invert ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Area with final triggers */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center sm:text-left">
            Base64 compressed auto-output size on apply
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button 
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto text-center px-4.5 py-2.5 text-slate-500 hover:text-slate-800 font-bold text-xs transition-colors font-semibold cursor-pointer border border-slate-200 bg-white hover:bg-slate-50 rounded-xl"
            >
              Cancel & Discard
            </button>
            <button 
              type="button"
              onClick={handleSave}
              className="w-full sm:w-auto justify-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:translate-y-px cursor-pointer"
            >
              <Check size={14} className="stroke-[2.5px]" /> 
              <span>Apply Edited Logo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
