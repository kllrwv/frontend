"use client";
import { useEffect, useRef, type RefObject } from "react";
export type Mode = "login" | "register";
const timeConstant = 74;
const hoverSplit = .08;
const frameInterval = 1000 / 60 - 1;
const maxPixels = 1_250_000;
type Motion = { value: number; target: number; velocity: number };
function glide(motion: Motion, elapsed: number, decay: number, snap: boolean) {
  const offset = motion.value - motion.target;
  const slope = motion.velocity + offset / timeConstant;
  motion.value = motion.target + (offset + slope * elapsed) * decay;
  motion.velocity = (motion.velocity - slope * elapsed / timeConstant) * decay;
  if (snap || (Math.abs(motion.value - motion.target) < .0003 && Math.abs(motion.velocity) < .000004)) {
    motion.value = motion.target;
    motion.velocity = 0;
    return false;
  }
  return true;
}
export function Wave({ shell, mode }: { shell: RefObject<HTMLElement | null>; mode: Mode | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const selection = useRef(mode);
  useEffect(() => {
    selection.current = mode;
    shell.current?.dispatchEvent(new Event("wavechange"));
  }, [mode, shell]);
  useEffect(() => {
    const root = shell.current;
    const element = canvas.current;
    const context = element?.getContext("2d", { alpha: false });
    if (!root || !element || !context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 680px)");
    let width = 0;
    let height = 0;
    let ratio = 1;
    let frame = 0;
    let lastFrame: number | undefined;
    let artworkSize = "";
    const split = { value: .5, target: .5, velocity: 0 };
    const pointerX = { value: .5, target: .5, velocity: 0 };
    const pointerY = { value: .5, target: .5, velocity: 0 };
    const focus = { value: 0, target: 0, velocity: 0 };
    const attention = { value: 0, target: 0, velocity: 0 };
    const motions = [split, pointerX, pointerY, focus, attention];
    const darkLayer = document.createElement("canvas");
    const lightLayer = document.createElement("canvas");
    const darkSheen = cacheSheen(false);
    const lightSheen = cacheSheen(true);
    function paint() {
      if (!context || !root) return;
      const vertical = narrow.matches;
      const w = vertical ? height : width;
      const h = vertical ? width : height;
      if (w < 1 || h < 1) return;
      const artWidth = vertical ? Math.max(w, 785) : w;
      const size = `${artWidth}/${h}/${ratio}`;
      if (size !== artworkSize) {
        drawLayer(darkLayer, artWidth, h, ratio, false);
        drawLayer(lightLayer, artWidth, h, ratio, true);
        artworkSize = size;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (vertical) context.transform(0, 1, -1, 0, width, 0);
      const divider = w * split.value;
      const amplitude = Math.min(w * .042, 52) * (1 - .67 * focus.value);
      const flex = Math.min(1, Math.abs(split.velocity) * 1060 + Math.abs(pointerY.velocity) * 150);
      const phase = (pointerX.value - .5) * 3 + (pointerY.value - .5) * 2.2;
      const edge = (y: number) => {
        const distance = y - pointerY.value;
        const fold = Math.exp(-15 * distance ** 2);
        const ripple = .20 * Math.sin(y * 8 - phase * 1.4) +
          .15 * Math.sin(y * 16 + phase * 1.8) +
          .07 * Math.sin(y * 27 - phase * 1.2);
        const pull = fold * (.32 * attention.value + .56 * flex * Math.sin(distance * 13 - phase * 2));
        return divider + amplitude * (ripple + pull);
      };
      const path = new Path2D();
      path.moveTo(edge(0), 0);
      for (let index = 1; index <= 60; index++) {
        const t = index / 60;
        path.lineTo(edge(t), t * h);
      }
      context.drawImage(darkLayer, 0, 0, w, h);
      sheen(context, darkSheen, w, h, divider * .50, pointerX.value, pointerY.value, phase, focus.value);
      const lightSide = new Path2D(path);
      lightSide.lineTo(w, h);
      lightSide.lineTo(w, 0);
      lightSide.closePath();
      context.save();
      context.clip(lightSide);
      context.drawImage(lightLayer, 0, 0, w, h);
      sheen(context, lightSheen, w, h, divider + (w - divider) * .47, pointerX.value, pointerY.value, phase, focus.value);
      context.restore();
      context.strokeStyle = "#fafafa20";
      context.lineWidth = 6;
      context.stroke(path);
      context.strokeStyle = "#fafafaad";
      context.lineWidth = 1.45;
      context.stroke(path);
    }
    function tick(now: number) {
      frame = 0;
      const snap = reduced.matches;
      const elapsed = lastFrame === undefined ? 16 : Math.min(now - lastFrame, 50);
      if (!snap && elapsed < frameInterval) {
        schedule();
        return;
      }
      const decay = Math.exp(-elapsed / timeConstant);
      let moving = false;
      let artworkChanged = false;
      let layoutChanged = false;
      for (const motion of motions) {
        const previous = motion.value;
        const previousVelocity = motion.velocity;
        if (glide(motion, elapsed, decay, snap)) moving = true;
        if (motion.value !== previous || motion.velocity !== previousVelocity) artworkChanged = true;
        if (motion.value !== previous && motion !== pointerX && motion !== pointerY) layoutChanged = true;
      }
      if (layoutChanged && root) {
        root.style.setProperty("--split", `${split.value * 100}%`);
        root.style.setProperty("--wave-focus", String(focus.value));
        root.style.setProperty("--wave-attention", String(attention.value));
      }
      if (artworkChanged) paint();
      if (moving) {
        lastFrame = now;
        schedule();
      } else {
        lastFrame = undefined;
      }
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(tick);
    }
    function center() {
      const compact = narrow.matches;
      split.target = selection.current === "login" ? (compact ? .86 : .79)
        : selection.current === "register" ? (compact ? .14 : .21) : .5;
      pointerX.target = .5;
      pointerY.target = .5;
      focus.target = selection.current ? 1 : 0;
      attention.target = 0;
      schedule();
    }
    function move(event: PointerEvent) {
      if (selection.current || reduced.matches || event.pointerType === "touch" || narrow.matches || !width || !height) return;
      const x = Math.max(0, Math.min(1, event.pageX / width));
      const y = Math.max(0, Math.min(1, event.pageY / height));
      if (x === pointerX.target && y === pointerY.target) return;
      pointerX.target = x;
      pointerY.target = y;
      if (pointerX.target < .485) attention.target = 1;
      if (pointerX.target > .515) attention.target = -1;
      split.target = .5 + attention.target * hoverSplit;
      schedule();
    }
    function resize() {
      if (!element || !root) return;
      const nextWidth = root.clientWidth;
      const nextHeight = root.clientHeight;
      if (!nextWidth || !nextHeight) return;
      const nextRatio = Math.min(window.devicePixelRatio || 1, 1, Math.sqrt(maxPixels / (nextWidth * nextHeight)));
      if (width === nextWidth && height === nextHeight && ratio === nextRatio) return;
      width = nextWidth;
      height = nextHeight;
      ratio = nextRatio;
      const pixelWidth = Math.ceil(width * ratio);
      const pixelHeight = Math.ceil(height * ratio);
      if (element.width !== pixelWidth) element.width = pixelWidth;
      if (element.height !== pixelHeight) element.height = pixelHeight;
      paint();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerleave", center);
    root.addEventListener("wavechange", center);
    reduced.addEventListener("change", center);
    narrow.addEventListener("change", center);
    resize();
    center();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      root.style.removeProperty("--split");
      root.style.removeProperty("--wave-focus");
      root.style.removeProperty("--wave-attention");
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", center);
      root.removeEventListener("wavechange", center);
      reduced.removeEventListener("change", center);
      narrow.removeEventListener("change", center);
    };
  }, [shell]);
  return <canvas className="wave" ref={canvas} aria-hidden="true" />;
}
type SheenTextures = { reflection: HTMLCanvasElement; streak: HTMLCanvasElement };
function cacheSheen(light: boolean): SheenTextures {
  function texture(stops: [number, string][], x: number, y: number, radius: number) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return canvas;
    context.setTransform(64, 0, 0, 64, 64, 64);
    const fill = context.createRadialGradient(x, y, radius, 0, 0, 1);
    for (const [offset, color] of stops) fill.addColorStop(offset, color);
    context.fillStyle = fill;
    context.fillRect(-1, -1, 2, 2);
    return canvas;
  }
  return {
    reflection: texture([
      [0, light ? "#ffffffdc" : "#c6c6c63a"],
      [.27, light ? "#ffffff77" : "#9e9e9e2e"],
      [.57, light ? "#9e9e9e30" : "#62626223"],
      [.77, light ? "#ffffff33" : "#8b8b8b18"],
      [1, "#ffffff00"],
    ], -.09, -.13, .04),
    streak: texture([
      [0, light ? "#ffffffbd" : "#dcdcdc40"],
      [.42, light ? "#ffffff67" : "#aeaeae26"],
      [1, "#ffffff00"],
    ], 0, 0, 0),
  };
}
function sheen(
  context: CanvasRenderingContext2D, textures: SheenTextures, w: number, h: number,
  centerX: number, x: number, y: number, phase: number, focus: number,
) {
  const travel = x - .5;
  const centerY = h * (.49 + (y - .5) * .48);
  const angle = -.51 + .38 * travel + .16 * Math.sin(phase * .73);
  context.save();
  context.globalAlpha = 1 - .72 * focus;
  context.translate(centerX + w * travel * .16, centerY);
  context.rotate(angle);
  context.scale(w * .31, h * .30);
  context.drawImage(textures.reflection, -1, -1, 2, 2);
  context.translate(.36 * Math.cos(phase * .8), .64 * Math.sin(phase * .63 + x * 2));
  context.rotate(.47 + y * .44);
  context.scale(.76, .24);
  context.drawImage(textures.streak, -1, -1, 2, 2);
  context.restore();
}
function drawLayer(canvas: HTMLCanvasElement, w: number, h: number, ratio: number, light: boolean) {
  canvas.width = Math.ceil(w * ratio);
  canvas.height = Math.ceil(h * ratio);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const base = light ? context.createLinearGradient(w * .24, h, w, 0)
    : context.createLinearGradient(0, 0, w * .64, h);
  base.addColorStop(0, light ? "#d2d2d2" : "#090909");
  base.addColorStop(light ? .48 : .63, light ? "#ffffff" : "#161616");
  base.addColorStop(1, light ? "#e8e8e8" : "#101010");
  context.fillStyle = base;
  context.fillRect(0, 0, w + 1, h + 1);
  if (!light) {
    const glow = context.createRadialGradient(w * .22, h * .88, 0, w * .22, h * .88, Math.max(w * .46, h * .72));
    glow.addColorStop(0, "#3b3b3b");
    glow.addColorStop(.53, "#26262680");
    glow.addColorStop(1, "#11111100");
    context.fillStyle = glow;
    context.fillRect(0, 0, w + 1, h + 1);
  }
  const tint = context.createLinearGradient(0, h * .9, w, h * .22);
  if (light) {
    tint.addColorStop(0, "#44444400");
    tint.addColorStop(.53, "#5757571a");
    tint.addColorStop(1, "#60606020");
  } else {
    tint.addColorStop(0, "#aaaaaa2c");
    tint.addColorStop(.4, "#97979726");
    tint.addColorStop(.71, "#97979700");
  }
  context.strokeStyle = tint;
  context.lineWidth = .8;
  const bands = light ? 35 : 41;
  for (let band = 0; band < bands; band++) {
    const level = band / bands;
    context.beginPath();
    for (let sample = 0; sample <= 72; sample++) {
      const x = sample / 72;
      const y = light
        ? .06 + level * .71 + .29 * Math.sin(x * 6.2 + level * 2.2) +
          .12 * Math.sin(x * 13.6 - level * 4.2)
        : .82 + (level - .45) * .48 - .43 * Math.exp(-((x - .29 - level * .16) ** 2) * 17) +
          .21 * Math.sin(x * 7.3 + level * 2);
      if (sample === 0) context.moveTo(x * w, y * h);
      else context.lineTo(x * w, y * h);
    }
    context.stroke();
  }
}
