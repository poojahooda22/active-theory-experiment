import { useRef, useMemo} from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useControls } from 'leva'

const vertexShader = `
uniform float uTime;
uniform float uParticleSize;
uniform float uScroll;
uniform float uLifeTime;
uniform float uDispersion;
uniform float uMomentum;

attribute float aBirthTime;
attribute vec3 aVelocity;

varying float vAge;
varying vec3 vPos;

// Simplex 3D Noise 
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 1.4142135623730950488016887242097;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

vec3 curlNoise(vec3 p) {
  float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  vec3 p_x0 = vec3(snoise(p - dx), snoise(p - dx + vec3(12.3)), snoise(p - dx + vec3(45.6)));
  vec3 p_x1 = vec3(snoise(p + dx), snoise(p + dx + vec3(12.3)), snoise(p + dx + vec3(45.6)));
  vec3 p_y0 = vec3(snoise(p - dy), snoise(p - dy + vec3(12.3)), snoise(p - dy + vec3(45.6)));
  vec3 p_y1 = vec3(snoise(p + dy), snoise(p + dy + vec3(12.3)), snoise(p + dy + vec3(45.6)));
  vec3 p_z0 = vec3(snoise(p - dz), snoise(p - dz + vec3(12.3)), snoise(p - dz + vec3(45.6)));
  vec3 p_z1 = vec3(snoise(p + dz), snoise(p + dz + vec3(12.3)), snoise(p + dz + vec3(45.6)));
  float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
  float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
  float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;
  return normalize(vec3(x, y, z) * (1.0 / (2.0 * e)));
}

void main() {
  float age = uTime - aBirthTime;
  
  // Hide unborn or dead particles
  if (aBirthTime == 0.0 || age > uLifeTime) {
    gl_Position = vec4(0.0);
    gl_PointSize = 0.0;
    vAge = 999.0;
    return;
  }
  
  vAge = age;
  
  // Base position
  vec3 target = position;
  
  // Add momentum from mouse movement
  target += aVelocity * age * uMomentum;
  
  // Add curl noise turbulence as they age
  vec3 curl = curlNoise(target * 0.2 + uTime * 0.5);
  target += curl * age * uDispersion; // Dispersion expands over time
  
  // Apply infinite scroll mechanism (they drift backwards and wrap)
  target.z -= uScroll * 0.05;
  
  vec4 mvPosition = modelViewMatrix * vec4(target, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // Particles shrink as they die
  float sizeFade = max(0.0, 1.0 - (age / uLifeTime));
  gl_PointSize = uParticleSize * sizeFade * (100.0 / -mvPosition.z);
  vPos = target;
}
`

const fragmentShader = `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uLifeTime;
varying float vAge;
varying vec3 vPos;

void main() {
  if (vAge > uLifeTime) discard;
  
  vec2 coord = gl_PointCoord - vec2(0.5);
  if(length(coord) > 0.5) discard;
  
  // Mix color based on X position to match the galaxy
  vec3 color = mix(uColorA, uColorB, (vPos.x + 20.0) / 40.0);
  
  // Sharper edge so it doesn't look blurry
  float edgeAlpha = smoothstep(0.5, 0.2, length(coord));
  float ageAlpha = max(0.0, 1.0 - (vAge / uLifeTime));
  
  gl_FragColor = vec4(color, edgeAlpha * ageAlpha);
}
`

const COUNT = 2000;

export default function MouseTrail({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const controls = useControls('Mouse Trail', {
    particleSize: { value: 2.0, min: 0.1, max: 20.0 },
    spawnRate: { value: 20, min: 1, max: 100 },
    lifeTime: { value: 3.0, min: 0.5, max: 10.0, step: 0.1 },
    dispersion: { value: 1.5, min: 0.0, max: 10.0, step: 0.1 },
    momentum: { value: 0.5, min: 0.0, max: 3.0, step: 0.1 },
    colorA: '#00ffff', // Cyan
    colorB: '#00ff23', // green
  })

  const { camera } = useThree()
  
  const geometryRef = useRef<THREE.BufferGeometry>(null)
  const prevMouse = useRef(new THREE.Vector3(9999, 9999, 9999))
  const currentIndex = useRef(0)
  
  const positions = useMemo(() => new Float32Array(COUNT * 3), [])
  const velocities = useMemo(() => new Float32Array(COUNT * 3), [])
  const birthTimes = useMemo(() => new Float32Array(COUNT), [])

  const renderMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uParticleSize: { value: controls.particleSize },
      uColorA: { value: new THREE.Color(controls.colorA) },
      uColorB: { value: new THREE.Color(controls.colorB) },
      uScroll: { value: 0 },
      uLifeTime: { value: controls.lifeTime },
      uDispersion: { value: controls.dispersion },
      uMomentum: { value: controls.momentum }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }), [])

  useFrame((state) => {
    const { clock, pointer } = state
    const time = clock.elapsedTime
    
    // Smooth mouse tracking on a 2D plane (Z=0)
    const vec = new THREE.Vector3(pointer.x, pointer.y, 0.5)
    vec.unproject(camera)
    const dir = vec.sub(camera.position).normalize()
    const distance = -camera.position.z / dir.z
    
    if (distance > 0) {
      const pos = camera.position.clone().add(dir.multiplyScalar(distance))
      
      // If we have a previous position, spawn particles along the segment
      if (prevMouse.current.x !== 9999) {
        const distToPrev = pos.distanceTo(prevMouse.current)
        
        // Only spawn if mouse moved a bit, preventing stacking in one spot
        if (distToPrev > 0.1) {
          const velocity = pos.clone().sub(prevMouse.current).multiplyScalar(5.0) // Momentum
          
          // Interpolate spawns to create a continuous dense cloud
          const spawnCount = Math.min(Math.floor(distToPrev * controls.spawnRate) + controls.spawnRate, 200)
          
          for (let i = 0; i < spawnCount; i++) {
            const lerpFactor = i / spawnCount
            const spawnPos = prevMouse.current.clone().lerp(pos, lerpFactor)
            
            // Random scatter in a circle around the spawn point
            const radius = Math.random() * 2.0; // Wide radius
            const angle = Math.random() * Math.PI * 2;
            spawnPos.x += Math.cos(angle) * radius;
            spawnPos.y += Math.sin(angle) * radius;
            spawnPos.z += (Math.random() - 0.5) * 2.0;
            
            const idx = currentIndex.current
            positions[idx * 3] = spawnPos.x
            positions[idx * 3 + 1] = spawnPos.y
            positions[idx * 3 + 2] = spawnPos.z
            
            velocities[idx * 3] = velocity.x + (Math.random() - 0.5) * 4.0
            velocities[idx * 3 + 1] = velocity.y + (Math.random() - 0.5) * 4.0
            velocities[idx * 3 + 2] = velocity.z + (Math.random() - 0.5) * 4.0
            
            birthTimes[idx] = time
            
            currentIndex.current = (currentIndex.current + 1) % COUNT
          }
          
          if (geometryRef.current && spawnCount > 0) {
            geometryRef.current.attributes.position.needsUpdate = true
            geometryRef.current.attributes.aVelocity.needsUpdate = true
            geometryRef.current.attributes.aBirthTime.needsUpdate = true
          }
        }
      }
      prevMouse.current.copy(pos)
    } else {
      prevMouse.current.set(9999,9999,9999)
    }
    
    renderMaterial.uniforms.uTime.value = time
    renderMaterial.uniforms.uParticleSize.value = controls.particleSize
    renderMaterial.uniforms.uColorA.value.set(controls.colorA)
    renderMaterial.uniforms.uColorB.value.set(controls.colorB)
    renderMaterial.uniforms.uScroll.value = scrollY.current
    renderMaterial.uniforms.uLifeTime.value = controls.lifeTime
    renderMaterial.uniforms.uDispersion.value = controls.dispersion
    renderMaterial.uniforms.uMomentum.value = controls.momentum
  })

  return (
    <points material={renderMaterial} frustumCulled={false}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aVelocity" args={[velocities, 3]} count={COUNT} array={velocities} itemSize={3} />
        <bufferAttribute attach="attributes-aBirthTime" args={[birthTimes, 1]} count={COUNT} array={birthTimes} itemSize={1} />
      </bufferGeometry>
    </points>
  )
}
