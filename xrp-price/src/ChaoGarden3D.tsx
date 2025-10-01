//react 3D fiber library - 
import { Canvas, useFrame, useThree } from "@react-three/fiber";

import {
  useGLTF, //load in 3D map
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

  useFrame((_, dt) => {
    const { up, down } = get();
    const dir = (up ? 1 : 0) - (down ? 1 : 0);

    if (dir !== 0) {
      let newY = camera.position.y + dir * speed * dt;
      // clamp to min/max
      newY = Math.min(max, Math.max(min, newY));
      camera.position.y = newY;
    }
  });

  return null;
}

// teleport player back if out of bounds
function BoundaryControl() {
  const { camera } = useThree();
  const p = camera.position;

  //use new data
  useFrame(() => {
  
  //if on higher part of grass
  if (p.z > 2 && p.z < 7){
    if (p.y < 0.5) {
      p.y = 2
    }
  }

  //if on lower part of grass
  else {
    if (p.y < 0) {
      p.y = 1
    }
  }
  
  if (p.x > 7 || p.x < -13) {
    p.x = 1
  }
  if (p.z > 15 || p.z < -8) {
    p.z = 1
  }
  });

  return null;
}

function ChaoModel() {
  const { scene } = useGLTF("/chaoGarden.glb");
  return <primitive object={scene} scale={2} />;
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

function WASDMover({ speed = 4 }: { speed?: number }) {
  //grab le camera
  const { camera } = useThree();

  //get keyboard state
  const [, get] = useKeyboardControls();

  //y of camera, null by default
  const baseY = useRef<number | null>(null);

  useFrame((_, dt) => {
    if (baseY.current === null) baseY.current = camera.position.y;

    const { forward, backward, left, right, sprint } = get();
    const s = (sprint ? 1.8 : 1) * speed * dt;

    // forward/right vectors from camera orientation (flattened)
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const rightV = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    fwd.y = 0; 
    rightV.y = 0; 
    fwd.normalize(); 
    rightV.normalize();

    const move = new THREE.Vector3();
    if (forward) move.add(fwd);
    if (backward) move.sub(fwd);
    if (right) move.add(rightV);
    if (left) move.sub(rightV);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(s);

    camera.position.add(move);

    // lock vertical unless you add jump
  });

  return null;
}

function CameraHUD({ enabled }: { enabled: boolean }) {
  const { camera } = useThree(); 
  const [text, setText] = useState("");

  useFrame(() => {
    if (!enabled) return; // ✅ do nothing if disabled
    const p = camera.position;
    setText(`x: ${p.x.toFixed(2)}  y: ${p.y.toFixed(2)}  z: ${p.z.toFixed(2)}`);
  });

  return enabled ? (
    <Html
      // ✅ render into overlay instead of scene
      portal={{ current: document.body }}
      zIndexRange={[100, 0]}
    >
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10, // 👈 pinned top-right of canvas
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontFamily: "monospace",
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        {text}
      </div>
    </Html>
  ) : null;
}


export default function ChaoGarden3D({ onBack }: { onBack?: () => void }) {
  
const [devMode, setDevMode] = useState(true); //useState false for normally off

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

      {/* Dev Mode checkbox */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#ddd" }}>
        <input
          type="checkbox"
          checked={devMode}
          onChange={(e) => setDevMode(e.target.checked)}
        />
        Show camera position
      </label>
      </div>

     {/* the canvas is the root container that sets up the WebGL rending context*/}
     {/* without Canvas, nothing 2D will appear */}
      <Canvas style={{ width: "100%", height: "calc(70vh - 48px)" }} camera={{ position: [3, 1.7, 5], fov: 75 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />

        {/*actual map GLTF file*/}
        <ChaoModel />

        {/*youtube player in map*/}
        <YouTubeBillboard
          videoId="bTqVqk7FSmY"
          position={[0, 1.0, -2.0]}
          rotation={[0, Math.PI * 0.1, 0]}
          size={[1.6, 0.9]}
        />

        {/* controls */}
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
          <WASDMover speed={4.5} />
          <VerticalMover speed={3} />   
          <PointerLockControls />
          <BoundaryControl/>
        </KeyboardControls>
        
        {/* must be in canvas to access camera position in 3D rendering*/}
        <CameraHUD enabled={devMode} />

      </Canvas>
    </div>
  );
}
