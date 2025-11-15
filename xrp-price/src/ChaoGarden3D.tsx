import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Html, PointerLockControls, KeyboardControls, Sky, Environment, ContactShadows} from "@react-three/drei";
import { useRef, useState, useLayoutEffect, useEffect} from "react";
import { BoundaryControl, WASDMover, VerticalMover, CursorHoldUnlock} from "./ChaoGarden/SonicController"
import * as THREE from "three";

// Import components for the home page instances
import XrpPrice from "./XrpPrice";
import WallpaperPicker from "./WallpaperPicker";
import VideoPlayer from "./VideoPlayer";
import PhotoEditor from "./PhotoEditor";
import HomePortal from "./HomePortal";

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

function YouTubeBillboard({
  videoId = "lcxNwdZlQT8",
  // desired size in meters (keep 16:9 ratio)
  size = [1.6, 0.9] as [number, number],
  position = [0, 1.1, -2] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
}) {
  // Base “design size” the pixels were authored against
  const BASE: [number, number] = [1.6, 0.9]; // meters that correspond to 1280×720
  const scaleX = size[0] / BASE[0];
  const scaleY = size[1] / BASE[1];

  // Keep the iframe at a nice crisp pixel size;
  // this does NOT control world-space size anymore — the group’s scale does.
  const pxWidth = 1280;
  const pxHeight = 720;

  return (
    <group position={position} rotation={rotation} scale={[scaleX, scaleY, 1]}>
      {/* No mesh behind it; the Html is the visible surface */}
      <Html
        transform
        // distanceFactor can be 1 or omitted when you're scaling via the parent
        distanceFactor={1}
        position={[0, 0, 0.001]}    // a hair off the surface to avoid z-fighting
        pointerEvents="auto"
        occlude={false}
        zIndexRange={[200, 100]}
      >
        <div
          style={{
            width: pxWidth,
            height: pxHeight,
            borderRadius: 12,
            overflow: "hidden",
            background: "transparent",
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


function SetCameraLookAt() {
  const { camera } = useThree();

  useEffect(() => {
    camera.lookAt(-10,4,8); // 👈 look at world position (x,y,z)
  }, [camera]);

  return null;
}

function CameraReporter({ onUpdate }: { onUpdate: (p: [number, number, number]) => void }) {
  const { camera } = useThree();
  useFrame(() => {
    onUpdate([camera.position.x, camera.position.y, camera.position.z]);
  });
  return null; // nothing visual in the scene
}

export default function ChaoGarden3D({ onBack }: { onBack?: () => void }) {

 const [devMode, setDevMode] = useState(false); //useState false for normally off
 const [cam, setCam] = useState<[number, number, number]>([0, 0, 0]); // 👈 add this
 const plcRef = useRef<any>(null); // 👈 pointer-lock controls ref
 const [portals, setPortals] = useState<{ id: string; position: [number, number, number] }[]>([]); // Portal instances
 const [portalCount, setPortalCount] = useState(0); // Counter for unique portal IDs

 // Function to add a new portal at a random position
 const addPortal = () => {
   const newId = `portal-${portalCount}`;
   const angle = Math.random() * Math.PI * 2;
   const distance = 4 + Math.random() * 6;
   const x = Math.cos(angle) * distance;
   const z = Math.sin(angle) * distance;
   const position: [number, number, number] = [x, 1.5, z];

   setPortals(prev => [...prev, { id: newId, position }]);
   setPortalCount(prev => prev + 1);
 };

 // Function to close a portal
 const closePortal = (id: string) => {
   setPortals(prev => prev.filter(p => p.id !== id));
 };


  return (
    <div style={{ display: "flex", flexDirection: "column", height: "70vh" }}>
      <div style={{ padding: 15, display: "flex", gap: 12, alignItems: "center" }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(58, 54, 54, 1)",
              background: "rgba(0, 0, 0, 0)",
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

      {/* Portal controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={addPortal}
          onMouseUp={(e) => e.currentTarget.blur()}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(255,255,255,0.3)",
            background: "rgba(0,128,255,0.2)",
            color: "white",
            cursor: "pointer",
            fontSize: "12px",
            outline: "none"
          }}
        >
          + Add Portal ({portals.length})
        </button>
      </div>

        {/* 👇 static text in normal DOM */}
        {devMode && (
          <code style={{ marginLeft: "auto", color: "#ddd", fontFamily: "monospace" }}>
            x: {cam[0].toFixed(2)}&nbsp; y: {cam[1].toFixed(2)}&nbsp; z: {cam[2].toFixed(2)}
          </code>
        )}
      </div>

      {/* the canvas is the root container that sets up the WebGL rending context*/}
      {/* without Canvas, nothing 2D will appear */}
      
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [3.5, 1.5, -6], fov: 50 }}
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
          position={[-10,4,8]}
          rotation={[0, 15, 0]}
          size={[3.2, 1.8]}
        />

        {/*youtube player in map*/}
        <YouTubeSphere
          videoId="lcxNwdZlQT8"
          position={[0,6,8]}
          radius={3}
        />

        <SetCameraLookAt />
        <CameraReporter onUpdate={setCam} />

        {/* Portal objects in the scene */}
        {portals.map((portal) => (
          <PortalObject
            key={portal.id}
            position={portal.position}
            onClick={() => {}} // Portal is just visual, the HomePortal handles interaction
          />
        ))}

        {/* Home Portal instances */}
        {portals.map((portal) => (
          <HomePortal
            key={`home-${portal.id}`}
            position={portal.position}
            onClose={() => closePortal(portal.id)}
          />
        ))}

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

function PortalObject({
  position = [0, 1.5, 0] as [number, number, number],
  onClick
}: {
  position?: [number, number, number];
  onClick: () => void;
}) {
  return (
    <group position={position}>
      {/* Glowing portal ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 2, 32]} />
        <meshBasicMaterial
          color="#4a90ff"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner portal effect */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.4, 32]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Portal label */}
      <Html
        position={[0, 0.5, 0]}
        center
        distanceFactor={3}
        occlude={false}
        zIndexRange={[50, 0]}
      >
        <div style={{
          color: "white",
          fontSize: "14px",
          fontWeight: "bold",
          textShadow: "0 0 8px rgba(74, 144, 255, 0.8)",
          textAlign: "center",
          pointerEvents: "none"
        }}>
          🌀 Portal
        </div>
      </Html>
    </group>
  );
}
