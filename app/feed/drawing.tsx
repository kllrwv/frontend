"use client";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Brush, Circle, Eraser, Minus, Redo2, Square, Trash2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog } from "../ui/dialog";
import { copy, type Lang } from "../lib/locale";
const SIZE = { width: 1000, height: 625 };
const TOOLS = { brush: Brush, eraser: Eraser, line: Minus, rectangle: Square, ellipse: Circle };
const COLORS = ["#131313", "#ffffff", "#f34944", "#ff8521", "#e6b833", "#28a874", "#327dff", "#9350dd", "#eb5594"];
type Tool = keyof typeof TOOLS;
type Point = { x: number; y: number };
type Mark = { tool: Tool; color: string; width: number; points: Point[] };
function renderMark(context: CanvasRenderingContext2D, mark: Mark) {
  const start = mark.points[0];
  const end = mark.points[mark.points.length - 1];
  context.strokeStyle = context.fillStyle = mark.tool === "eraser" ? "#ffffff" : mark.color;
  context.lineWidth = mark.width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  if (mark.tool === "rectangle") context.rect(start.x, start.y, end.x - start.x, end.y - start.y);
  else if (mark.tool === "ellipse") {
    context.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2,
      Math.abs(start.x - end.x) / 2, Math.abs(start.y - end.y) / 2, 0, 0, Math.PI * 2);
  } else if (mark.points.length === 1) {
    context.arc(start.x, start.y, mark.width / 2, 0, Math.PI * 2);
    context.fill();
    return;
  } else {
    context.moveTo(start.x, start.y);
    for (const point of mark.points.slice(1)) context.lineTo(point.x, point.y);
  }
  context.stroke();
}
export function Drawing({ lang, close, attach, banner = false }: { lang: Lang; close: () => void; attach: (file: File) => void; banner?: boolean }) {
  const t = copy[lang].social;
  const profile = copy[lang].profiles;
  const height = banner ? 320 : SIZE.height;
  const canvas = useRef<HTMLCanvasElement>(null);
  const buffer = useRef<HTMLCanvasElement | null>(null);
  const current = useRef<Mark | null>(null);
  const activePointer = useRef<number | null>(null);
  const [history, setHistory] = useState<Mark[][]>([[]]);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(6);
  const [zoom, setZoom] = useState(100);
  function paint() {
    const target = canvas.current?.getContext("2d");
    if (!target || !buffer.current) return;
    target.drawImage(buffer.current, 0, 0);
    if (current.current) renderMark(target, current.current);
  }
  useEffect(() => {
    if (!buffer.current) {
      buffer.current = document.createElement("canvas");
      buffer.current.width = SIZE.width;
      buffer.current.height = height;
    }
    const context = buffer.current.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, SIZE.width, height);
    for (const mark of history[index]) renderMark(context, mark);
    paint();
  }, [history, index, height]);
  function commit(marks: Mark[]) {
    setHistory([...history.slice(Math.max(0, index - 40), index + 1), marks]);
    setIndex(Math.min(index + 1, 41));
  }
  function point(event: PointerEvent<HTMLCanvasElement>): Point {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) / box.width * SIZE.width,
      y: (event.clientY - box.top) / box.height * height,
    };
  }
  function begin(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || activePointer.current !== null || history[index].length >= 400) return;
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    current.current = { tool, color, width, points: [point(event)] };
    paint();
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    const mark = current.current;
    if (activePointer.current !== event.pointerId || !mark) return;
    if (mark.tool === "brush" || mark.tool === "eraser") {
      if (mark.points.length < 4096) mark.points.push(point(event));
    } else {
      mark.points[1] = point(event);
    }
    paint();
  }
  function end(event: PointerEvent<HTMLCanvasElement>, commitMark: boolean) {
    if (activePointer.current !== event.pointerId || !current.current) return;
    if (commitMark) {
      const mark = current.current;
      const finish = point(event);
      const last = mark.points[mark.points.length - 1];
      if (finish.x !== last.x || finish.y !== last.y) {
        if (mark.tool === "brush" || mark.tool === "eraser") mark.points.push(finish);
        else mark.points[1] = finish;
      }
      commit([...history[index], mark]);
    }
    current.current = null;
    activePointer.current = null;
    if (!commitMark) paint();
  }
  return <Dialog title={banner ? profile.drawBanner : t.draw} close={close} closeLabel={t.close} wide>
    <div className="drawing-tools">
      <div className="drawing-group">{Object.entries(TOOLS).map(([key, Icon]) => {
        const value = key as Tool;
        return <button key={key} type="button" className="icon-action" title={t[value]} aria-label={t[value]}
          aria-pressed={tool === key} onClick={() => setTool(value)}><Icon size={19} /></button>;
      })}</div>
      <label className="drawing-width"><span>{t.width}</span>
        <input type="range" min="1" max="42" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
      </label>
      <div className="drawing-group drawing-colors">{COLORS.map((value) => <button key={value} type="button"
        aria-label={`${t.color} ${value}`} aria-pressed={color === value} style={{ "--swatch": value } as CSSProperties} onClick={() => setColor(value)} />)}
        <input aria-label={t.color} type="color" value={color} onChange={(event) => setColor(event.target.value)} />
      </div>
      <div className="drawing-group">
        <button type="button" className="icon-action" aria-label={t.undo} disabled={index === 0} onClick={() => setIndex(index - 1)}><Undo2 size={19} /></button>
        <button type="button" className="icon-action" aria-label={t.redo} disabled={index === history.length - 1} onClick={() => setIndex(index + 1)}><Redo2 size={19} /></button>
        <button type="button" className="icon-action" aria-label={t.clear} disabled={!history[index].length} onClick={() => commit([])}><Trash2 size={17} /></button>
      </div>
      <div className="drawing-group drawing-zoom">
        <button type="button" className="icon-action" aria-label={t.zoomOut} disabled={zoom <= 50} onClick={() => setZoom(zoom - 25)}><ZoomOut size={18} /></button>
        <output>{zoom}%</output>
        <button type="button" className="icon-action" aria-label={t.zoomIn} disabled={zoom >= 175} onClick={() => setZoom(zoom + 25)}><ZoomIn size={18} /></button>
      </div>
    </div>
    <div className="drawing-stage">
      <canvas aria-label={t.canvas} ref={canvas} width={SIZE.width} height={height} style={{ width: `${zoom}%`, aspectRatio: `${SIZE.width} / ${height}` }}
        onPointerDown={begin} onPointerMove={move} onPointerUp={(event) => end(event, true)}
        onPointerCancel={(event) => end(event, false)} onLostPointerCapture={(event) => end(event, false)} />
    </div>
    <div className="dialog-actions">
      <button type="button" className="social-secondary" onClick={close}>{t.cancel}</button>
      <button type="button" className="social-primary" disabled={!history[index].length} onClick={() => {
        canvas.current?.toBlob((blob) => { if (blob) attach(new File([blob], t.drawingFileName, { type: "image/png" })); });
      }}>{banner ? profile.saveBanner : t.addDrawing}</button>
    </div>
  </Dialog>;
}
