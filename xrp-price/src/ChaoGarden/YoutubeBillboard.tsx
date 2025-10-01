//react 3D fiber library - 

import {
  Html,
} from "@react-three/drei";

import { useCallback, useState } from "react";

export function YouTubeBillboard({
  videoId = "dQw4w9WgXcQ",
  size = [1.6, 0.9] as [number, number],
  position = [0, 1.1, -2] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
}) {
  const [hover, setHover] = useState(false);
  const stop = useCallback((e: any) => e.stopPropagation(), []);

  const [w, h] = size;
  const pxWidth = 800;
  const pxHeight = Math.round((pxWidth * h) / w);

  return (
    <group position={position} rotation={rotation}>
      <mesh
        onPointerDown={stop}
        onPointerMove={stop}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={hover ? "#222" : "#111"} roughness={0.9} metalness={0.1} />
      </mesh>

      <Html
        transform
        occlude
        distanceFactor={w / (pxWidth / 100)}
        pointerEvents="auto"
        zIndexRange={[10, 0]}
        onPointerDown={stop}
        onWheel={stop}
      >
        <div
          style={{
            width: pxWidth,
            height: pxHeight,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          onMouseDown={stop}
          onMouseUp={stop}
          onPointerDown={stop}
        >
          <iframe
            width={pxWidth}
            height={pxHeight}
            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
            title="YouTube video player"
            frameBorder={0}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ display: "block" }}
          />
        </div>
      </Html>
    </group>
  );
}