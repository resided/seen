// ============================================
// REACT THREE FIBER EXAMPLE
// Reference for adding 3D graphics to The Board
// ============================================

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Sphere, Text } from '@react-three/drei';

// ============================================
// INSTALLATION:
// npm install @react-three/fiber @react-three/drei three
// ============================================

// Simple rotating cube component
function RotatingCube() {
  const meshRef = useRef();
  
  // Rotate the cube every frame
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta;
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <Box ref={meshRef} args={[1, 1, 1]}>
      <meshStandardMaterial color="white" />
    </Box>
  );
}

// Floating particles background
function Particle({ position }) {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + position[0]) * 0.2;
    }
  });

  return (
    <Sphere ref={meshRef} position={position} args={[0.05, 16, 16]}>
      <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
    </Sphere>
  );
}

// 3D Background Scene
export function Scene3D() {
  const particles = Array.from({ length: 50 }, (_, i) => [
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10,
  ]);

  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 75 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      {/* 3D Objects */}
      <RotatingCube />
      
      {/* Particle field */}
      {particles.map((pos, i) => (
        <Particle key={i} position={pos} />
      ))}
      
      {/* Controls - allows mouse interaction */}
      <OrbitControls enableZoom={false} />
    </Canvas>
  );
}

// ============================================
// USAGE IN YOUR COMPONENT:
// ============================================
/*
import { Scene3D } from './3DExample';

// In your TheBoard component, add as background:
<div className="relative min-h-screen bg-black text-white">
  <Scene3D />
  <div className="relative z-10">
    {/* Your existing content */}
  </div>
</div>
*/

// ============================================
// LEARNING RESOURCES:
// ============================================
/*
1. React Three Fiber Docs: https://docs.pmnd.rs/react-three-fiber
2. Drei (helpers): https://github.com/pmndrs/drei
3. Three.js Fundamentals: https://threejs.org/manual/
4. Interactive Tutorial: https://threejs-journey.com/

Key Concepts:
- Canvas: The 3D scene container
- useFrame: Hook for animations (runs every frame)
- useRef: Access to 3D object instances
- Geometry: Shapes (Box, Sphere, Plane, etc.)
- Materials: How objects look (meshStandardMaterial, etc.)
- Lights: ambientLight, pointLight, directionalLight
- Controls: OrbitControls (mouse drag/rotate), etc.
*/

// ============================================
// EXAMPLE: 3D Featured App Card
// ============================================
export function FeaturedApp3D({ appName }) {
  return (
    <div className="relative h-64 border border-white">
      <Canvas camera={{ position: [0, 0, 3] }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} />
        
        {/* 3D text */}
        <Text
          position={[0, 0, 0]}
          fontSize={0.5}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {appName}
        </Text>
        
        <OrbitControls enableZoom={false} />
      </Canvas>
    </div>
  );
}

