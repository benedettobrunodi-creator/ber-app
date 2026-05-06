'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Image as KImage, Circle, Text, Group } from 'react-konva';

interface Ambiente {
  id: string;
  nome: string;
  posX: number; // 0-100 %
  posY: number; // 0-100 %
  cor: string;
  _count: { fotos: number };
}

interface PlantaCanvasProps {
  /** Image URL (regular image) or base64 data URL (from PdfImage) */
  imageSrc: string;
  ambientes: Ambiente[];
  selectedId: string | null;
  addMode: boolean;
  onSelect: (amb: Ambiente | null) => void;
  onAddPin: (posX: number, posY: number) => void;
  getPinColor: (amb: Ambiente) => string;
}

export default function PlantaCanvas({
  imageSrc,
  ambientes,
  selectedId,
  addMode,
  onSelect,
  onAddPin,
  getPinColor,
}: PlantaCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  // Load image
  useEffect(() => {
    if (!imageSrc) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.onerror = () => console.error('PlantaCanvas: failed to load image');
    img.src = imageSrc;
  }, [imageSrc]);

  // Resize stage to fit container while preserving aspect ratio
  const updateSize = useCallback(() => {
    if (!containerRef.current || !image) return;
    const containerWidth = containerRef.current.offsetWidth;
    if (containerWidth <= 0) return;
    const ratio = image.height / image.width;
    setStageSize({
      width: containerWidth,
      height: Math.round(containerWidth * ratio),
    });
  }, [image]);

  useEffect(() => {
    if (!containerRef.current) return;
    updateSize();
    const ro = new ResizeObserver(() => updateSize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateSize]);

  // Handle click on empty area (add pin mode)
  const handleStageClick = (e: any) => {
    if (!addMode) return;
    // Only trigger on background click, not on pins
    if (e.target !== e.target.getStage() && e.target.name() !== 'planta-bg') return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer || stageSize.width === 0 || stageSize.height === 0) return;

    const posX = Math.round((pointer.x / stageSize.width) * 1000) / 10;
    const posY = Math.round((pointer.y / stageSize.height) * 1000) / 10;
    onAddPin(posX, posY);
  };

  const PIN_RADIUS = 14;

  return (
    <div ref={containerRef} style={{ cursor: addMode ? 'crosshair' : 'default' }}>
      {stageSize.width > 0 && image && (
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
          {/* Background image layer */}
          <Layer>
            <KImage
              image={image}
              width={stageSize.width}
              height={stageSize.height}
              name="planta-bg"
              listening={true}
            />
          </Layer>

          {/* Pins layer */}
          <Layer>
            {ambientes.map((amb, idx) => {
              const x = (amb.posX / 100) * stageSize.width;
              const y = (amb.posY / 100) * stageSize.height;
              const isSelected = amb.id === selectedId;
              const color = getPinColor(amb);
              const seqNumber = idx + 1;

              return (
                <Group
                  key={amb.id}
                  x={x}
                  y={y}
                  listening={!addMode}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelect(isSelected ? null : amb);
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true;
                    onSelect(isSelected ? null : amb);
                  }}
                >
                  {/* Selection ring */}
                  {isSelected && (
                    <Circle
                      radius={PIN_RADIUS + 3}
                      fill="transparent"
                      stroke="white"
                      strokeWidth={2}
                    />
                  )}
                  {/* Pin circle */}
                  <Circle
                    radius={PIN_RADIUS}
                    fill={color}
                    shadowColor="rgba(0,0,0,0.3)"
                    shadowBlur={4}
                    shadowOffsetY={2}
                  />
                  {/* Number text */}
                  <Text
                    text={String(seqNumber)}
                    fontSize={10}
                    fontStyle="bold"
                    fill="white"
                    align="center"
                    verticalAlign="middle"
                    width={PIN_RADIUS * 2}
                    height={PIN_RADIUS * 2}
                    offsetX={PIN_RADIUS}
                    offsetY={PIN_RADIUS}
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      )}

      {/* Loading state */}
      {(!image || stageSize.width === 0) && (
        <div className="flex items-center justify-center bg-gray-50 rounded-lg" style={{ minHeight: 400 }}>
          <div className="text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            <p className="mt-2 text-xs text-gray-500">Carregando planta...</p>
          </div>
        </div>
      )}
    </div>
  );
}
