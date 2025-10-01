import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Html, PointerLockControls, KeyboardControls, Sky, Environment, ContactShadows} from "@react-three/drei";
import { useCallback, useRef, useState, useLayoutEffect} from "react";
import { BoundaryControl, WASDMover, VerticalMover, CursorHoldUnlock} from "./ChaoGarden/SonicController"
import * as THREE from "three";
import { EffectComposer, Bloom, SSAO, Vignette } from "@react-three/postprocessing";

function LoadChaoGarden() {
  const { scene } = useGLTF("/chaoGarden.glb");

  // Runs before the first paint — prevents "flash" of wrong materials
  useLayoutEffect(() => {
    scene.traverse((o: any) => {
      if (!o.isMesh) return;

      o.castShadow = true;
      o.receiveShadow = true;

      const m = o.material;
      if (m?.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.anisotropy = 8;
        m.map.generateMipmaps = true;
        m.map.minFilter = THREE.LinearMipmapLinearFilter;
        m.map.magFilter = THREE.LinearFilter;

        // Optional: improve big grassy areas
        if (/grass|ground|terrain/i.test(o.name)) {
          m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
          m.map.repeat.set(2, 2);
        }
      }

      // Optional: make ponds read as water
      if (/water|pond|lake/i.test(o.name)) {
        m.roughness = 0.15;
        m.metalness = 0.0;
        m.transparent = true;
        m.opacity = 0.95;
        m.color = new THREE.Color("#6db9ff");
      }
    });
  }, [scene]);

  return <primitive object={scene} scale={2} />;
}
/** A 3D "screen" with a live YouTube player (iframe projected into 3D). */
function YouTubeBillboard({
  videoId = "lcxNwdZlQT8",
  size = [1.6, 0.9] as [number, number],          // meters (16:9)
  position = [0, 1.1, -2] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
}) {
  const [w, h] = size;

  // pick any 16:9 pixel size; 1280x720 keeps YouTube happy
  const pxWidth = 1280;
  const pxHeight = 720;

  // This makes the DOM element appear exactly w meters wide in world space
  const distanceFactor = w / (pxWidth / 100);

  return (
    <group position={position} rotation={rotation}>
      {/* 🔴 NO MESH HERE — remove the black plane completely */}

      <Html
        transform
        position={[0, 0, 0.001]}       // a hair in front of any geometry
        distanceFactor={distanceFactor}
        pointerEvents="auto"
        zIndexRange={[200, 100]}
        occlude={false}                 // don’t let geometry hide it
      >
        <div
          style={{
            width: pxWidth,
            height: pxHeight,
            borderRadius: 12,
            overflow: "hidden",
            background: "transparent",  // transparent container
            border: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          <iframe
            width={pxWidth}
            height={pxHeight}
            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&controls=1&playsinline=1`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ display: "block", border: 0, background: "transparent" }}
          />
        </div>
      </Html>
    </group>
  );
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
const plcRef = useRef<any>(null); // 👈 pointer-lock controls ref

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
      
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 1.35, 6], fov: 50 }}
        gl={{
          antialias: true,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        style={{ width: "100%", height: "calc(70vh - 48px)" }}
      >

        {/* bright sky + soft distance fade */}
        <color attach="background" args={["#aee1ff"]} />
        <fog attach="fog" args={["#aee1ff", 12, 80]} />
        <hemisphereLight intensity={0.5} color="#ffffff" groundColor="#7ec850" />
        <directionalLight
          position={[8, 12, 4]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0005}
          shadow-camera-near={1}
          shadow-camera-far={60}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />

        <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={80} blur={2.5} far={50} />

        <Sky distance={450000} sunPosition={[8, 12, 4]} turbidity={2} mieCoefficient={0.01} mieDirectionalG={0.9} />
        <Environment preset="sunset" />


        {/*actual map GLTF file*/}
        <LoadChaoGarden />


        {/*youtube player in map*/}
        <YouTubeBillboard
          videoId="lcxNwdZlQT8"
          position={[-3,5,8]}
          rotation={[0, Math.PI * 0.1, 0]}
          size={[3.2, 1.8]}
        />

        {/*youtube player in map*/}
        <YouTubeSphere
          videoId="lcxNwdZlQT8"
          position={[-5,8,8]}
          radius={3.2}
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
            { name: "cursor", keys: ["KeyQ"] },                       // 👈 HOLD Q to show cursor

          ]}
        >
          <WASDMover speed={4.5} />
          <VerticalMover speed={3} />   
          <PointerLockControls ref={plcRef}/>
          <CursorHoldUnlock controlsRef={plcRef} />
          <BoundaryControl/>
        </KeyboardControls>
        
        {/* must be in canvas to access camera position in 3D rendering*/}
        <CameraHUD enabled={devMode} />

      </Canvas>
    </div>
  );
}

function YouTubeSphere({
  videoId = "lcxNwdZlQT8",
  radius = 1,
  position = [0, 1.5, -3] as [number, number, number],
}) {
  const pxWidth = 1280;
  const pxHeight = 720;

  return (
    <group position={position}>
      {/* Sphere shell (invisible, just for placement) */}
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial transparent opacity={0} /> {/* invisible shell */}
      </mesh>

      {/* Html iframe anchored to front of sphere */}
      <Html
        transform
        position={[0, 0, radius + 0.01]}  // offset just outside sphere surface
        distanceFactor={radius / 2}       // scale iframe to fit sphere
        occlude={false}
        pointerEvents="auto"
        zIndexRange={[200, 100]}
      >
        <div
          style={{
            width: pxWidth,
            height: pxHeight,
            borderRadius: "50%",        // circular mask
            overflow: "hidden",
            background: "transparent",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          <iframe
            width={pxWidth}
            height={pxHeight}
            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
            title="YouTube video player"
            frameBorder={0}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ display: "block", border: 0, background: "transparent" }}
          />
        </div>
      </Html>
    </group>
  );
}
