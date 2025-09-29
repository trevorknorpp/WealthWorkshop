// ChillVideoIn3D.tsx
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function YouTubeBillboard({
  videoId = "bTqVqk7FSmY",     // change to your video id
  size = [1.6, 0.9] as [number, number],
  position = [0, 1.2, -2] as [number, number, number],
  rotation = [0, 0.15 * Math.PI, 0] as [number, number, number],
}) {
  const [w, h] = size;
  const pxW = 800;                                // DOM pixel width (crispness)
  const pxH = Math.round((pxW * h) / w);

  const stop = (e: any) => e.stopPropagation();   // don’t rotate when clicking iframe

  return (
    <group position={position} rotation={rotation}>
      {/* physical “screen” mesh */}
      <mesh onPointerDown={stop}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#111" roughness={0.9} />
      </mesh>

      {/* real DOM iframe projected into 3D space */}
      <Html
        transform
        pointerEvents="auto"
        distanceFactor={w / (pxW / 100)}  // scale DOM to world size
        onPointerDown={stop}
        onWheel={stop}
      >
        <div
          style={{
            width: pxW,
            height: pxH,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          }}
        >
          <iframe
            width={pxW}
            height={pxH}
            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
            title="YouTube"
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

export default function ChillVideoIn3D() {
  return (
    <Canvas
      camera={{ position: [0, 1.6, 3.5], fov: 65 }}
      style={{ width: "100%", height: "70vh", background: "#0a0a0a" }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        // ensure consistent color space
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      {/* basic lights */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />

      {/* a simple floor so you have context */}
      <mesh position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* the in-scene video “TV” */}
      <YouTubeBillboard videoId="dQw4w9WgXcQ" />

      {/* move around to prove it’s 3D */}
      <OrbitControls enableDamping />
    </Canvas>
  );
}
