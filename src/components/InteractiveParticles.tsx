import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useControls } from 'leva'

const vertexShader = `
uniform float uTime;
uniform float uParticleSize;
uniform float uSpeed;
uniform float uCurlFreq;
uniform vec3 uMouse;
uniform float uMouseForce;
uniform float uMouseRadius;
uniform float uScroll;

attribute vec3 aRandomPos;

varying vec3 vPos;
varying float vZ;

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
  vec3 initialPos = aRandomPos;

  // Animate the base position using curl noise
  vec3 curl = curlNoise(initialPos * uCurlFreq + uTime * uSpeed * 0.1);
  
  // Base animated position
  vec3 target = initialPos + curl * 1.5; 
  
  // Swirling mouse interaction
  vec3 dir = target - uMouse;
  float dist = length(dir);
  if (dist < uMouseRadius) {
    vec3 dirNorm = normalize(dir);
    // Swirl vector (cross product with Z)
    vec3 swirl = cross(dirNorm, vec3(0.0, 0.0, 1.0));
    
    // Smooth falloff based on distance
    float force = (uMouseRadius - dist) * uMouseForce * 0.1;
    
    // Apply swirl and slight repulsion dynamically
    target += (dirNorm * 0.3 + swirl * 0.7) * force;
  }
  
  // Apply infinite scroll mechanism with wrap-around (-25 to +25)
  target.z -= uScroll * 0.05;
  target.z = mod(target.z + 25.0, 50.0) - 25.0;
  
  vec4 mvPosition = modelViewMatrix * vec4(target, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  gl_PointSize = uParticleSize * (100.0 / -mvPosition.z);
  vPos = target;
  vZ = target.z;
}
`

const fragmentShader = `
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec3 vPos;
varying float vZ;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  if(length(coord) > 0.5) discard;
  
  // Fade based on Z position to hide popping at boundaries
  // IMPORTANT: smoothstep(edge0, edge1) is undefined if edge0 > edge1 in WebGL. 
  // We must use 1.0 - smoothstep(15.0, 25.0) instead.
  float zAlpha = 1.0 - smoothstep(15.0, 25.0, abs(vZ));
  
  vec3 color = mix(uColorA, uColorB, (vPos.x + 20.0) / 40.0);
  gl_FragColor = vec4(color, 0.8 * zAlpha);
}
`

export default function InteractiveParticles({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const size = 128
  
  const controls = useControls({
    speed: { value: 1.0, min: 0.0, max: 5.0 },
    curlFreq: { value: 0.15, min: 0.0, max: 1.0 },
    mouseForce: { value: 8.0, min: -20.0, max: 20.0 }, 
    mouseRadius: { value: 8.0, min: 1.0, max: 30.0, step: 0.5 },
    particleSize: { value: 4.0, min: 0.1, max: 20.0 },
    colorA: '#00ffff', // Cyan
    colorB: '#ff00ff', // Magenta
  })

  const { camera } = useThree()
  const mousePos = useRef(new THREE.Vector3(9999, 9999, 9999))
  
  const particlesGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(size * size * 3)
    const randoms = new Float32Array(size * size * 3)
    
    for (let i = 0; i < size * size; i++) {
      // Dummy positions, real data is in aRandomPos
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0
      
      // Random starting grid within canvas
      randoms[i * 3] = (Math.random() - 0.5) * 40.0
      randoms[i * 3 + 1] = (Math.random() - 0.5) * 20.0
      randoms[i * 3 + 2] = (Math.random() - 0.5) * 5.0
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aRandomPos', new THREE.BufferAttribute(randoms, 3))
    return geometry
  }, [size])

  const renderMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: controls.speed },
      uCurlFreq: { value: controls.curlFreq },
      uMouseForce: { value: controls.mouseForce },
      uMouseRadius: { value: controls.mouseRadius },
      uMouse: { value: new THREE.Vector3(9999, 9999, 9999) },
      uParticleSize: { value: controls.particleSize },
      uColorA: { value: new THREE.Color(controls.colorA) },
      uColorB: { value: new THREE.Color(controls.colorB) },
      uScroll: { value: 0 }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }), [])

  useFrame((state) => {
    const { clock, pointer } = state
    
    // Smooth mouse tracking on a 2D plane (Z=0)
    const vec = new THREE.Vector3(pointer.x, pointer.y, 0.5)
    vec.unproject(camera)
    const dir = vec.sub(camera.position).normalize()
    const distance = -camera.position.z / dir.z
    
    if (distance > 0) {
      const pos = camera.position.clone().add(dir.multiplyScalar(distance))
      mousePos.current.lerp(pos, 0.15) // Smooth trailing lerp
    } else {
      mousePos.current.set(9999,9999,9999)
    }
    
    renderMaterial.uniforms.uTime.value = clock.elapsedTime
    renderMaterial.uniforms.uSpeed.value = controls.speed
    renderMaterial.uniforms.uCurlFreq.value = controls.curlFreq
    renderMaterial.uniforms.uMouseForce.value = controls.mouseForce
    renderMaterial.uniforms.uMouseRadius.value = controls.mouseRadius
    renderMaterial.uniforms.uScroll.value = scrollY ? scrollY.current : 0
    renderMaterial.uniforms.uMouse.value.copy(mousePos.current)
    renderMaterial.uniforms.uParticleSize.value = controls.particleSize
    renderMaterial.uniforms.uColorA.value.set(controls.colorA)
    renderMaterial.uniforms.uColorB.value.set(controls.colorB)
  })

  return (
    <points geometry={particlesGeometry} material={renderMaterial} frustumCulled={false} />
  )
}