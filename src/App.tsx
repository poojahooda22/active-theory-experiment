import { Canvas } from '@react-three/fiber'
import { Suspense, useRef, useEffect } from 'react'
import InteractiveParticles from './components/InteractiveParticles'
import MouseTrail from './components/MouseTrail'

export default function App() {
  const scrollY = useRef(0)

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Accumulate scroll (infinite)
      scrollY.current += e.deltaY * 0.05
    }
    
    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505', overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 0, 25], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        <Suspense fallback={null}>
          <InteractiveParticles scrollY={scrollY} />
          <MouseTrail scrollY={scrollY} />
        </Suspense>
      </Canvas>
    </div>
  )
}
