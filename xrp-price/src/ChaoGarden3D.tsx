// src/ChaoGarden3D.tsx
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useGLTF,
  Html,
  PointerLockControls,
  KeyboardControls,
  useKeyboardControls,
} from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";


function VerticalMover({ speed = 3, min = -Infinity, max = Infinity }) {
  const { camera } = useThree();
  const [, get] = useKeyboardControls();
  const yRef = useRef<number | null>(null);

  useEffect(() => {
    yRef.current = camera.position.y; // start from current height
  }, [camera]);

  useFrame((_, dt) => {
    if (yRef.current == null) yRef.current = camera.position.y;

    const { up, down } = get();
    const dir = (up ? 1 : 0) - (down ? 1 : 0);
    if (dir !== 0) {
      yRef.current = Math.min(max, Math.max(min, yRef.current + dir * speed * dt));
    }
    // Reapply our authoritative Y every frame so other systems can't reset it
    camera.position.y = yRef.current;
  });

  return null;
}

function ChaoModel() {
  const { scene } = useGLTF("/chaoGarden.glb");
  return <primitive object={scene} scale={1} />;
}

/** A 3D "screen" with a live YouTube player (iframe projected into 3D). */
function YouTubeBillboard({
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

/** Minimal FPS mover: WASD on XZ plane; mouse only looks (via PointerLockControls). */
function FpsMover({ speed = 4 }: { speed?: number }) {
  const { camera } = useThree();
  const [, get] = useKeyboardControls();

  // keep y constant so you don't fly; tweak if you want jump later
  const baseY = useRef(camera.position.y);

  useFrame((_, dt) => {
    const { forward, backward, left, right, sprint } = get();
    const s = (sprint ? 1.8 : 1) * speed * dt;

    // forward/right vectors from camera orientation (flattened)
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const rightV = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    fwd.y = 0; rightV.y = 0; fwd.normalize(); rightV.normalize();

    const move = new THREE.Vector3();
    if (forward) move.add(fwd);
    if (backward) move.sub(fwd);
    if (right) move.add(rightV);
    if (left) move.sub(rightV);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(s);

    camera.position.add(move);
    // lock vertical unless you add jump
    camera.position.y = baseY.current;
  });

  return null;
}

export default function ChaoGarden3D({ onBack }: { onBack?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "70vh" }}>
      <div style={{ padding: 8, display: "flex", gap: 12, alignItems: "center" }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(111, 91, 91, 0.4)",
              color: "#eee",
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
        )}
        <span style={{ color: "#bbb", fontSize: 12 }}>
          Click canvas to lock cursor · WASD to move · Shift to sprint · Esc to unlock
        </span>
      </div>

      <Canvas style={{ width: "100%", height: "calc(70vh - 48px)" }} camera={{ position: [3, 1.7, 5], fov: 75 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />

        <ChaoModel />

        <YouTubeBillboard
          videoId="bTqVqk7FSmY"
          position={[0, 1.0, -2.0]}
          rotation={[0, Math.PI * 0.1, 0]}
          size={[1.6, 0.9]}
        />

        {/* ✅ Keyboard + pointer-lock FPS controls; no Orbit/FirstPerson */}
        <KeyboardControls
          map={[
            { name: "forward", keys: ["KeyW", "ArrowUp"] },
            { name: "backward", keys: ["KeyS", "ArrowDown"] },
            { name: "left", keys: ["KeyA", "ArrowLeft"] },
            { name: "right", keys: ["KeyD", "ArrowRight"] },
            { name: "sprint", keys: ["ShiftLeft", "ShiftRight"] },   // keep if you want sprint
            { name: "up", keys: ["Space"] },                          // NEW
            { name: "down", keys: ["ShiftLeft", "ShiftRight"] },  // NEW (or use KeyE/KeyQ)
          ]}
        >
          <FpsMover speed={4.5} />
          <VerticalMover speed={3} />   {/* NEW */}
          <PointerLockControls />
        </KeyboardControls>
            </Canvas>
          </div>
        );
      }
