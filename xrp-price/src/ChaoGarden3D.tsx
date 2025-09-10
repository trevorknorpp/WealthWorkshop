// src/ChaoGarden3D.tsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls, FirstPersonControls, useGLTF } from "@react-three/drei";
import { Sky } from "@react-three/drei";

function ChaoModel() {
  const { scene } = useGLTF("/chaoGarden.glb");
  return <primitive object={scene} scale={1} />;
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
        </div>

      <Canvas
        style={{ width: "100%", height: "calc(70vh - 48px)" }}
        camera={{ position: [3, 3, 3], fov: 90 }}
      >
        <Sky sunPosition={[100, 20, 100]} turbidity={8} rayleigh={6} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />

        <ChaoModel />

        <FirstPersonControls
            lookSpeed={0.1}
            movementSpeed={5}
            lookVertical={true}
        />

        <OrbitControls enableDamping />
      </Canvas>
    </div>
  );
}


