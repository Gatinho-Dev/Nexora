"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Check, RotateCcw, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BannerCropperProps {
  file: File;
  onComplete: (croppedFile: File) => void;
  onCancel: () => void;
  aspectRatio?: number;
  minWidth?: number;
  minHeight?: number;
}

export function BannerCropper({
  file,
  onComplete,
  onCancel,
  aspectRatio = 16 / 9,
  minWidth = 1280,
  minHeight = 720,
}: BannerCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [imageUrl, setImageUrl] = useState("");
  const [crop, setCrop] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [dragState, setDragState] = useState<{
    active: boolean;
    type: "move" | "resize-n" | "resize-s" | "resize-w" | "resize-e" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se" | null;
    startX: number;
    startY: number;
    startCrop: typeof crop;
  }>({ active: false, type: null, startX: 0, startY: 0, startCrop: crop });
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleImageLoad = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return;
    const img = imgRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = containerRect.width / containerRect.height;

    let displayWidth, displayHeight;
    if (imgAspect > containerAspect) {
      displayWidth = containerRect.width;
      displayHeight = containerRect.width / imgAspect;
    } else {
      displayHeight = containerRect.height;
      displayWidth = containerRect.height * imgAspect;
    }

    const cropWidth = displayWidth;
    const cropHeight = displayWidth / aspectRatio;

    if (cropHeight > displayHeight) {
      setCrop({
        x: 0,
        y: 0,
        width: displayHeight * aspectRatio,
        height: displayHeight,
      });
    } else {
      setCrop({
        x: (displayWidth - cropWidth) / 2,
        y: (displayHeight - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight,
      });
    }
    setScale(1);
    setLoaded(true);
  }, [aspectRatio]);

  const getContainerPoint = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent, type: typeof dragState.type) => {
    if (!loaded) return;
    e.preventDefault();
    e.stopPropagation();
    const point = getContainerPoint(e.clientX, e.clientY);
    setDragState({
      active: true,
      type,
      startX: point.x,
      startY: point.y,
      startCrop: { ...crop },
    });
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragState.active || !containerRef.current) return;
      const point = getContainerPoint(e.clientX, e.clientY);
      const dx = point.x - dragState.startX;
      const dy = point.y - dragState.startY;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const img = imgRef.current;
      if (!img) return;

      const imgAspect = img.naturalWidth / img.naturalHeight;
      const containerAspect = containerRect.width / containerRect.height;
      let displayWidth, displayHeight;
      if (imgAspect > containerAspect) {
        displayWidth = containerRect.width;
        displayHeight = containerRect.width / imgAspect;
      } else {
        displayHeight = containerRect.height;
        displayWidth = containerRect.height * imgAspect;
      }
      const scaleX = img.naturalWidth / displayWidth;
      const scaleY = img.naturalHeight / displayHeight;

      const newCrop = { ...dragState.startCrop };
      const minCropWidth = Math.min(minWidth / scaleX, displayWidth);
      const minCropHeight = Math.min(minHeight / scaleY, displayHeight);

      switch (dragState.type) {
        case "move":
          newCrop.x = Math.max(0, Math.min(displayWidth - newCrop.width, dragState.startCrop.x + dx));
          newCrop.y = Math.max(0, Math.min(displayHeight - newCrop.height, dragState.startCrop.y + dy));
          break;
        case "resize-n":
          newCrop.y = Math.max(0, Math.min(dragState.startCrop.y + dragState.startCrop.height - minCropHeight, dragState.startCrop.y + dy));
          newCrop.height = Math.max(minCropHeight, dragState.startCrop.height - dy);
          break;
        case "resize-s":
          newCrop.height = Math.max(minCropHeight, Math.min(displayHeight - newCrop.y, dragState.startCrop.height + dy));
          break;
        case "resize-w":
          newCrop.x = Math.max(0, Math.min(dragState.startCrop.x + dragState.startCrop.width - minCropWidth, dragState.startCrop.x + dx));
          newCrop.width = Math.max(minCropWidth, dragState.startCrop.width - dx);
          break;
        case "resize-e":
          newCrop.width = Math.max(minCropWidth, Math.min(displayWidth - newCrop.x, dragState.startCrop.width + dx));
          break;
        case "resize-nw":
          newCrop.x = Math.max(0, Math.min(dragState.startCrop.x + dragState.startCrop.width - minCropWidth, dragState.startCrop.x + dx));
          newCrop.width = Math.max(minCropWidth, dragState.startCrop.width - dx);
          newCrop.y = Math.max(0, Math.min(dragState.startCrop.y + dragState.startCrop.height - minCropHeight, dragState.startCrop.y + dy));
          newCrop.height = Math.max(minCropHeight, dragState.startCrop.height - dy);
          break;
        case "resize-ne":
          newCrop.width = Math.max(minCropWidth, Math.min(displayWidth - newCrop.x, dragState.startCrop.width + dx));
          newCrop.y = Math.max(0, Math.min(dragState.startCrop.y + dragState.startCrop.height - minCropHeight, dragState.startCrop.y + dy));
          newCrop.height = Math.max(minCropHeight, dragState.startCrop.height - dy);
          break;
        case "resize-sw":
          newCrop.x = Math.max(0, Math.min(dragState.startCrop.x + dragState.startCrop.width - minCropWidth, dragState.startCrop.x + dx));
          newCrop.width = Math.max(minCropWidth, dragState.startCrop.width - dx);
          newCrop.height = Math.max(minCropHeight, Math.min(displayHeight - newCrop.y, dragState.startCrop.height + dy));
          break;
        case "resize-se":
          newCrop.width = Math.max(minCropWidth, Math.min(displayWidth - newCrop.x, dragState.startCrop.width + dx));
          newCrop.height = Math.max(minCropHeight, Math.min(displayHeight - newCrop.y, dragState.startCrop.height + dy));
          break;
      }
      setCrop(newCrop);
    };

    const handleUp = () => {
      setDragState(s => ({ ...s, active: false, type: null }));
    };

    if (dragState.active) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragState, crop, loaded, minWidth, minHeight]);

  const handleZoom = (delta: number) => {
    setScale(s => Math.max(0.5, Math.min(3, s + delta)));
  };

  const handleRotate = () => {
    setRotation(r => (r + 90) % 360);
  };

  const handleReset = () => {
    handleImageLoad();
  };

  const handleApply = async () => {
    if (!imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgAspect = img.naturalWidth / img.naturalHeight;
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const containerAspect = containerRect.width / containerRect.height;
    let displayWidth, displayHeight;
    if (imgAspect > containerAspect) {
      displayWidth = containerRect.width;
      displayHeight = containerRect.width / imgAspect;
    } else {
      displayHeight = containerRect.height;
      displayWidth = containerRect.height * imgAspect;
    }
    const scaleX = img.naturalWidth / displayWidth;
    const scaleY = img.naturalHeight / displayHeight;

    const sourceX = crop.x * scaleX;
    const sourceY = crop.y * scaleY;
    const sourceWidth = crop.width * scaleX;
    const sourceHeight = crop.height * scaleY;

    const outputWidth = Math.max(minWidth, Math.round(sourceWidth));
    const outputHeight = Math.max(minHeight, Math.round(sourceHeight));

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    ctx.save();
    ctx.translate(outputWidth / 2, outputHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -outputWidth / 2,
      -outputHeight / 2,
      outputWidth,
      outputHeight
    );
    ctx.restore();

    canvas.toBlob(blob => {
      if (blob) {
        const croppedFile = new File([blob], file.name, { type: file.type });
        onComplete(croppedFile);
      }
    }, file.type, 0.95);
  };

  if (!loaded || !imageUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">Recortar Banner</h2>
          <span className="text-xs text-muted2 px-2 py-0.5 rounded bg-white/10">
            Proporção 16:9 • Mín. {minWidth}×{minHeight}px
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} title="Redefinir">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleRotate} title="Rotacionar">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleZoom(0.1)} title="Zoom +">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleZoom(-0.1)} title="Zoom -">
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleApply} className="bg-primary">
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Aplicar
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        style={{ touchAction: "none" }}
      >
        <div
          className={cn(
            "relative",
            dragState.active && "cursor-grabbing",
            !dragState.active && "cursor-grab"
          )}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Banner preview"
            onLoad={handleImageLoad}
            className="max-w-full max-h-[calc(100vh-200px)] object-contain"
          />

          <canvas ref={canvasRef} className="hidden" />

          <div
            className="absolute border-2 border-primary/80 bg-primary/10"
            style={{
              left: crop.x,
              top: crop.y,
              width: crop.width,
              height: crop.height,
              borderRadius: "8px",
              pointerEvents: "none",
            }}
          >
            <div
              className="absolute -top-2 -left-2 h-4 w-4 rounded-full bg-primary border-2 border-black cursor-nwse-resize"
              onMouseDown={e => handleMouseDown(e, "resize-nw")}
            />
            <div
              className="absolute -top-2 right-[-2px] h-4 w-4 rounded-full bg-primary border-2 border-black cursor-nesw-resize"
              onMouseDown={e => handleMouseDown(e, "resize-ne")}
            />
            <div
              className="absolute bottom-[-2px] -left-2 h-4 w-4 rounded-full bg-primary border-2 border-black cursor-nesw-resize"
              onMouseDown={e => handleMouseDown(e, "resize-sw")}
            />
            <div
              className="absolute bottom-[-2px] right-[-2px] h-4 w-4 rounded-full bg-primary border-2 border-black cursor-nwse-resize"
              onMouseDown={e => handleMouseDown(e, "resize-se")}
            />
            <div
              className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-primary border-2 border-black cursor-ns-resize"
              onMouseDown={e => handleMouseDown(e, "resize-n")}
            />
            <div
              className="absolute bottom-[-2px] left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-primary border-2 border-black cursor-ns-resize"
              onMouseDown={e => handleMouseDown(e, "resize-s")}
            />
            <div
              className="absolute top-1/2 -left-2 h-4 w-4 -translate-y-1/2 rounded-full bg-primary border-2 border-black cursor-ew-resize"
              onMouseDown={e => handleMouseDown(e, "resize-w")}
            />
            <div
              className="absolute top-1/2 right-[-2px] h-4 w-4 -translate-y-1/2 rounded-full bg-primary border-2 border-black cursor-ew-resize"
              onMouseDown={e => handleMouseDown(e, "resize-e")}
            />
          </div>

          <div
            className="absolute inset-0 bg-black/30 pointer-events-none"
            style={{
              clipPath: `polygon(
                0 0, 100% 0, 100% 100%, 0 100%,
                0 0,
                ${crop.x}px ${crop.y}px,
                ${crop.x + crop.width}px ${crop.y}px,
                ${crop.x + crop.width}px ${crop.y + crop.height}px,
                ${crop.x}px ${crop.y + crop.height}px
              )`,
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 border-t border-white/10 p-4 text-xs text-muted2">
        <span>Arraste a área selecionada ou as bordas para recortar</span>
        <span>Scroll para zoom</span>
      </div>
    </div>
  );
}

BannerCropper.displayName = "BannerCropper";