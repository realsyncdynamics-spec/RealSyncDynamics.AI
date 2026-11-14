import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type Konva from 'konva';
import { Ellipse, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva';
import { resolveToken, type BrandKit } from './brandKit';
import { dataUrlToExactPng } from './exportPng';
import { fitStage, formatById, pngExportSize } from './formats';
import { applyTransformedBox, type DesignLayer, type SocialDesignDocument } from './model';

export interface EditorCanvasHandle {
  exportPng: () => Promise<string>;
}

interface EditorCanvasProps {
  ref?: Ref<EditorCanvasHandle>;
  document: SocialDesignDocument;
  kit: BrandKit;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChangeLayer: (id: string, next: DesignLayer) => void;
}

function useHtmlImage(src: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const element = new Image();
    element.crossOrigin = 'anonymous';
    element.onload = () => setImage(element);
    element.onerror = () => setImage(null);
    element.src = src;
    return () => {
      element.onload = null;
      element.onerror = null;
    };
  }, [src]);
  return image;
}

function ImageNode({
  src,
  fallback,
  common,
}: {
  src: string | null;
  fallback: string;
  common: CommonProps;
}) {
  const image = useHtmlImage(src);
  if (!image) {
    return <Rect {...common} fill={fallback} />;
  }
  return <KonvaImage {...common} image={image} />;
}

interface CommonProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  draggable: boolean;
  scaleX: number;
  scaleY: number;
  onMouseDown: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (event: Konva.KonvaEventObject<Event>) => void;
  ref: (node: Konva.Node | null) => void;
}

export function EditorCanvas({
  ref,
  document: design,
  kit,
  selectedId,
  onSelect,
  onChangeLayer,
}: EditorCanvasProps) {
  const format = formatById(design.formatId);
  const boxRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const contentRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Node>());
  const [viewport, setViewport] = useState({ width: 640, height: 640 });

  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setViewport({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);
    setViewport({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  const fitted = fitStage(viewport, format);
  const anchor = Math.max(14, 18 / Math.max(fitted.scale, 0.05));

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node = selectedId ? nodes.current.get(selectedId) : undefined;
    const layer = design.layers.find((entry) => entry.id === selectedId);
    transformer.nodes(node && layer && !layer.locked && layer.visible ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, design.layers]);

  useImperativeHandle(ref, () => ({
    exportPng: async () => {
      const layer = contentRef.current;
      if (!layer) throw new Error('Bühne fehlt');
      const size = pngExportSize(format);
      let url: string;
      try {
        url = layer.toDataURL({ mimeType: 'image/png', pixelRatio: 1 });
      } catch {
        throw new Error('Export blockiert. Ein Bild erlaubt das Auslesen der Bühne nicht (CORS).');
      }
      return dataUrlToExactPng(url, size.width, size.height);
    },
  }), [format]);

  function bind(id: string) {
    return (node: Konva.Node | null) => {
      if (node) nodes.current.set(id, node);
      else nodes.current.delete(id);
    };
  }

  function commitFromNode(layer: DesignLayer, node: Konva.Node) {
    const scaleX = node.scaleX() || 1;
    const scaleY = node.scaleY() || 1;
    node.scaleX(1);
    node.scaleY(1);
    if (layer.kind === 'shape' && layer.shape === 'ellipse') {
      const width = Math.max(8, layer.width * scaleX);
      const height = Math.max(8, layer.height * scaleY);
      onChangeLayer(layer.id, applyTransformedBox(layer, {
        x: node.x() - width / 2,
        y: node.y() - height / 2,
        rotation: node.rotation(),
        scaleX: 1,
        scaleY: 1,
        width,
        height,
      }));
      return;
    }
    onChangeLayer(layer.id, applyTransformedBox(layer, {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      scaleX,
      scaleY,
      width: node.width(),
      height: node.height(),
    }));
  }

  function common(layer: DesignLayer): CommonProps {
    return {
      id: layer.id,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      rotation: layer.rotation,
      visible: layer.visible,
      draggable: !layer.locked && layer.visible,
      scaleX: 1,
      scaleY: 1,
      ref: bind(layer.id),
      onMouseDown: (event) => {
        event.cancelBubble = true;
        if (!layer.locked) onSelect(layer.id);
      },
      onDragEnd: (event) => commitFromNode(layer, event.target),
      onTransformEnd: (event) => commitFromNode(layer, event.target),
    };
  }

  const safe = Math.round(Math.min(format.width, format.height) * 0.06);

  return (
    <div
      ref={boxRef}
      className="flex h-full min-h-[420px] w-full items-center justify-center overflow-hidden bg-[var(--brand-paper-2)]"
      data-testid="editor-viewport"
    >
      <div
        style={{
          width: fitted.displayWidth,
          height: fitted.displayHeight,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: format.width,
            height: format.height,
            transform: `scale(${fitted.scale})`,
            transformOrigin: 'top left',
          }}
        >
          <Stage
            ref={stageRef}
            width={format.width}
            height={format.height}
            pixelRatio={1}
            onMouseDown={(event) => {
              if (event.target === event.target.getStage()) onSelect(null);
            }}
          >
            <Layer ref={contentRef}>
              <Rect
                x={0}
                y={0}
                width={format.width}
                height={format.height}
                fill={resolveToken(kit, design.backgroundToken)}
                onMouseDown={() => onSelect(null)}
              />
              {design.layers.map((layer) => {
                const props = common(layer);
                if (layer.kind === 'text') {
                  return (
                    <Text
                      key={layer.id}
                      {...props}
                      text={layer.text}
                      fontSize={layer.fontSize}
                      fontFamily={resolveToken(kit, layer.fontToken)}
                      fill={resolveToken(kit, layer.fillToken)}
                      align={layer.align}
                      fontStyle={layer.fontStyle === 'bold' ? 'bold' : 'normal'}
                      wrap="word"
                    />
                  );
                }
                if (layer.kind === 'shape' && layer.shape === 'ellipse') {
                  return (
                    <Ellipse
                      key={layer.id}
                      {...props}
                      x={layer.x + layer.width / 2}
                      y={layer.y + layer.height / 2}
                      radiusX={layer.width / 2}
                      radiusY={layer.height / 2}
                      fill={resolveToken(kit, layer.fillToken)}
                    />
                  );
                }
                if (layer.kind === 'shape') {
                  return <Rect key={layer.id} {...props} fill={resolveToken(kit, layer.fillToken)} />;
                }
                const fallback = resolveToken(kit, 'color.muted');
                if (layer.kind === 'logo') {
                  return <ImageNode key={layer.id} src={kit.logoUrl} fallback={fallback} common={props} />;
                }
                return <ImageNode key={layer.id} src={layer.src} fallback={fallback} common={props} />;
              })}
            </Layer>
            <Layer listening={false}>
              <Rect
                x={safe}
                y={safe}
                width={format.width - safe * 2}
                height={format.height - safe * 2}
                stroke={resolveToken(kit, 'color.muted')}
                strokeWidth={Math.max(1, 2 / Math.max(fitted.scale, 0.05))}
                dash={[12, 8]}
                listening={false}
              />
            </Layer>
            <Layer>
              <Transformer
                ref={transformerRef}
                rotateEnabled
                anchorSize={anchor}
                borderStrokeWidth={Math.max(1, 2 / Math.max(fitted.scale, 0.05))}
                rotateAnchorOffset={anchor * 1.6}
                ignoreStroke
              />
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
}
