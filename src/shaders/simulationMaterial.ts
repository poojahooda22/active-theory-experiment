import * as THREE from 'three'

const simulationVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const simulationFragmentShader = `
uniform sampler2D uPositions;
uniform float uTime;
uniform float uSpeed;
uniform float uCurlFreq;
uniform vec3 uMouse;
uniform float uMouseForce;
varying vec2 vUv;

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
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
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

  const float divisor = 1.0 / (2.0 * e);
  return normalize(vec3(x, y, z) * divisor);
}

void main() {
  vec3 pos = texture2D(uPositions, vUv).xyz;
  
  vec3 curl = curlNoise(pos * uCurlFreq + uTime * 0.1);
  vec3 target = pos + curl * uSpeed * 0.01;
  
  vec3 dir = pos - uMouse;
  float dist = length(dir);
  if (dist < 8.0) {
    vec3 dirNorm = normalize(dir);
    
    // Swirl effect by crossing the direction vector with the Z axis (pointing out of screen)
    vec3 swirl = cross(dirNorm, vec3(0.0, 0.0, 1.0));
    
    float force = (8.0 - dist) * uMouseForce * 0.01;
    
    // Combine outward push/pull with the swirl rotation
    target += (dirNorm * 0.4 + swirl * 0.8) * force;
  }
  
  // Soft boundary to keep them across the entire wide canvas
  vec3 boxMin = vec3(-20.0, -10.0, -5.0);
  vec3 boxMax = vec3(20.0, 10.0, 5.0);
  
  if (target.x < boxMin.x) target.x += (boxMax.x - boxMin.x);
  if (target.x > boxMax.x) target.x -= (boxMax.x - boxMin.x);
  if (target.y < boxMin.y) target.y += (boxMax.y - boxMin.y);
  if (target.y > boxMax.y) target.y -= (boxMax.y - boxMin.y);
  if (target.z < boxMin.z) target.z += (boxMax.z - boxMin.z);
  if (target.z > boxMax.z) target.z -= (boxMax.z - boxMin.z);
  
  gl_FragColor = vec4(target, 1.0);
}
`

export function getSimulationMaterial(_size: number) {
  const simulationMaterial = new THREE.ShaderMaterial({
    vertexShader: simulationVertexShader,
    fragmentShader: simulationFragmentShader,
    uniforms: {
      uPositions: { value: null }, // Initialized on GPU
      uTime: { value: 0 },
      uSpeed: { value: 1.5 },
      uCurlFreq: { value: 0.25 },
      uMouse: { value: new THREE.Vector3(9999, 9999, 9999) },
      uMouseForce: { value: 2.0 }
    }
  })
  return simulationMaterial
}

export function getInitMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: simulationVertexShader,
    fragmentShader: `
      varying vec2 vUv;
      float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }
      void main() {
          float x = (random(vUv) - 0.5) * 40.0;
          float y = (random(vUv * 1.5) - 0.5) * 20.0;
          float z = (random(vUv * 2.5) - 0.5) * 5.0;
          gl_FragColor = vec4(x, y, z, 1.0);
      }
    `
  })
}
