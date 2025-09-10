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
    <div style={{ height: "70vh", border: "1px solid #000000ff", borderRadius: 12 }}>
      <div style={{ padding: 8, display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={onBack}>← Back</button>
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


