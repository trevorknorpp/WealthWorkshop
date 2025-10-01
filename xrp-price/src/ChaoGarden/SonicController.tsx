//react 3D fiber library - 
import {useFrame, useThree } from "@react-three/fiber";

import {useKeyboardControls} from "@react-three/drei";

import {useRef} from "react";
import * as THREE from "three";

export function WASDMover({ speed = 4 }: { speed?: number }) {
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

export function VerticalMover({ speed = 3, min = -Infinity, max = Infinity }) {
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
export function BoundaryControl() {
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

// while Q is held: unlock cursor; on release: re-lock
export function CursorHoldUnlock({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  const [, get] = useKeyboardControls();
  const wasDown = useRef(false);

  useFrame(() => {
    const down = !!get().cursor; // "cursor" comes from KeyboardControls map
    if (down && !wasDown.current) {
      // Q pressed → show cursor
      controlsRef.current?.unlock?.();
    } else if (!down && wasDown.current) {
      // Q released → try to relock
      // Note: some browsers require a user gesture; if lock() is ignored,
      // clicking the canvas will lock again (PointerLockControls default).
      controlsRef.current?.lock?.();
    }
    wasDown.current = down;
  });

  return null;
}