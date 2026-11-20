import * as THREE from 'three';
import { TimeOfDay } from '../types/game';

interface LightingPreset {
  sunDirection: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  ambientSky: THREE.Color;
  ambientGround: THREE.Color;
  ambientIntensity: number;
  fogColor: THREE.Color;
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  waterDeep: THREE.Color;
  waterShallow: THREE.Color;
  specColor: THREE.Color;
}

const PRESETS: Record<TimeOfDay, LightingPreset> = {
  sunset: {
    sunDirection: new THREE.Vector3(-0.62, 0.24, -0.75).normalize(),
    sunColor: new THREE.Color(0xffa45b),
    sunIntensity: 2.8,
    ambientSky: new THREE.Color(0x526b96),
    ambientGround: new THREE.Color(0x1e293b),
    ambientIntensity: 0.95,
    fogColor: new THREE.Color(0x2d3348),
    skyTop: new THREE.Color(0x0b1530),
    skyHorizon: new THREE.Color(0xd96b38),
    waterDeep: new THREE.Color(0x051b2c),
    waterShallow: new THREE.Color(0x0d4058),
    specColor: new THREE.Color(0xffc07a),
  },
  day: {
    sunDirection: new THREE.Vector3(-0.45, 0.72, -0.52).normalize(),
    sunColor: new THREE.Color(0xfff5e4),
    sunIntensity: 2.9,
    ambientSky: new THREE.Color(0x88c4f4),
    ambientGround: new THREE.Color(0x1f495e),
    ambientIntensity: 1.15,
    fogColor: new THREE.Color(0x8cb8d9),
    skyTop: new THREE.Color(0x1b66b3),
    skyHorizon: new THREE.Color(0xbce0f7),
    waterDeep: new THREE.Color(0x042b47),
    waterShallow: new THREE.Color(0x0e6b85),
    specColor: new THREE.Color(0xffffff),
  },
  night: {
    sunDirection: new THREE.Vector3(0.45, 0.42, -0.78).normalize(),
    sunColor: new THREE.Color(0x7ca7e8),
    sunIntensity: 1.25,
    ambientSky: new THREE.Color(0x1c2e4a),
    ambientGround: new THREE.Color(0x060d18),
    ambientIntensity: 0.65,
    fogColor: new THREE.Color(0x060e1f),
    skyTop: new THREE.Color(0x020612),
    skyHorizon: new THREE.Color(0x10213d),
    waterDeep: new THREE.Color(0x020914),
    waterShallow: new THREE.Color(0x071d32),
    specColor: new THREE.Color(0x9ec5ff),
  },
};

export class OceanEnvironment {
  public oceanMesh: THREE.Mesh;
  public skyMesh: THREE.Mesh;
  public sunLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public rimLight: THREE.DirectionalLight;
  private oceanUniforms: Record<string, THREE.IUniform>;
  private skyUniforms: Record<string, THREE.IUniform>;
  private cloudsGroup: THREE.Group;

  constructor(scene: THREE.Scene, initialTime: TimeOfDay = 'sunset') {
    const preset = PRESETS[initialTime];

    // Lights
    this.sunLight = new THREE.DirectionalLight(preset.sunColor, preset.sunIntensity);
    this.sunLight.position.copy(preset.sunDirection).multiplyScalar(900);
    this.sunLight.castShadow = false;
    scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(
      preset.ambientSky,
      preset.ambientGround,
      preset.ambientIntensity
    );
    scene.add(this.hemiLight);

    this.rimLight = new THREE.DirectionalLight(0x5da9e9, 0.6);
    this.rimLight.position.set(450, 260, 500);
    scene.add(this.rimLight);

    // Fog
    scene.fog = new THREE.FogExp2(preset.fogColor.getHex(), 0.00032);

    // Animated GLSL Ocean
    this.oceanUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: preset.sunDirection.clone() },
      uWaterDeep: { value: preset.waterDeep.clone() },
      uWaterShallow: { value: preset.waterShallow.clone() },
      uSkyHorizon: { value: preset.skyHorizon.clone() },
      uSpecColor: { value: preset.specColor.clone() },
      uFogColor: { value: preset.fogColor.clone() },
      uFogDensity: { value: 0.00032 },
    };

    const oceanGeo = new THREE.PlaneGeometry(5200, 5200, 180, 180);
    oceanGeo.rotateX(-Math.PI / 2);

    const oceanMat = new THREE.ShaderMaterial({
      uniforms: this.oceanUniforms,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldPos;
        varying float vWaveH;

        float wave(vec2 p, float t) {
          float w = 0.0;
          w += sin(p.x * 0.032 + t * 1.15 + p.y * 0.012) * 0.65;
          w += sin(p.y * 0.045 - t * 0.92 + p.x * 0.018) * 0.45;
          w += sin((p.x - p.y) * 0.075 + t * 1.65) * 0.22;
          return w;
        }

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          float h = wave(worldPos.xz, uTime);
          worldPos.y += h;
          vWaveH = h;
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uWaterDeep;
        uniform vec3 uWaterShallow;
        uniform vec3 uSkyHorizon;
        uniform vec3 uSpecColor;
        uniform vec3 uFogColor;
        uniform float uFogDensity;

        varying vec3 vWorldPos;
        varying float vWaveH;

        vec3 getNormal(vec2 p, float t) {
          float e = 0.45;
          float h0 = sin(p.x * 0.032 + t * 1.15 + p.y * 0.012) * 0.65
                   + sin(p.y * 0.045 - t * 0.92 + p.x * 0.018) * 0.45
                   + sin((p.x - p.y) * 0.075 + t * 1.65) * 0.22
                   + sin(p.x * 0.19 + t * 2.4) * 0.08
                   + cos(p.y * 0.24 - t * 2.1) * 0.07;
          float hx = sin((p.x + e) * 0.032 + t * 1.15 + p.y * 0.012) * 0.65
                   + sin(p.y * 0.045 - t * 0.92 + (p.x + e) * 0.018) * 0.45
                   + sin(((p.x + e) - p.y) * 0.075 + t * 1.65) * 0.22
                   + sin((p.x + e) * 0.19 + t * 2.4) * 0.08
                   + cos(p.y * 0.24 - t * 2.1) * 0.07;
          float hz = sin(p.x * 0.032 + t * 1.15 + (p.y + e) * 0.012) * 0.65
                   + sin((p.y + e) * 0.045 - t * 0.92 + p.x * 0.018) * 0.45
                   + sin((p.x - (p.y + e)) * 0.075 + t * 1.65) * 0.22
                   + sin(p.x * 0.19 + t * 2.4) * 0.08
                   + cos((p.y + e) * 0.24 - t * 2.1) * 0.07;
          return normalize(vec3(h0 - hx, e * 1.15, h0 - hz));
        }

        void main() {
          vec3 N = getNormal(vWorldPos.xz, uTime);
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 L = normalize(uSunDir);

          // Fresnel sky reflection
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
          fresnel = clamp(fresnel * 0.85 + 0.08, 0.0, 0.92);

          // Base ocean gradient
          float crest = smoothstep(-0.6, 1.1, vWaveH);
          vec3 baseCol = mix(uWaterDeep, uWaterShallow, crest * 0.65);

          // Subtle foam glints on wave crests
          float foamNoise = sin(vWorldPos.x * 0.25 + uTime) * cos(vWorldPos.z * 0.22 - uTime * 1.2);
          float foam = smoothstep(0.88, 1.28, vWaveH + foamNoise * 0.25) * 0.16;

          // Sun specular highlight
          vec3 H = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.0), 160.0) * 1.9;
          float broadSpec = pow(max(dot(N, H), 0.0), 22.0) * 0.25;

          vec3 col = mix(baseCol, uSkyHorizon * 0.88, fresnel * 0.72);
          col += uSpecColor * (spec + broadSpec);
          col += vec3(0.85, 0.93, 0.98) * foam;

          // Exponential distance fog matching scene
          float dist = length(cameraPosition - vWorldPos);
          float fogFactor = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
          col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    this.oceanMesh.position.y = 0;
    scene.add(this.oceanMesh);

    // Sky Dome Shader
    this.skyUniforms = {
      uTopColor: { value: preset.skyTop.clone() },
      uHorizonColor: { value: preset.skyHorizon.clone() },
      uSunDir: { value: preset.sunDirection.clone() },
      uSunColor: { value: preset.sunColor.clone() },
    };

    const skyGeo = new THREE.SphereGeometry(2600, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        varying vec3 vDir;

        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 sky = mix(uHorizonColor, uTopColor, pow(h, 0.55));

          // Sun/Moon halo & disc
          float sunDot = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
          float halo = pow(sunDot, 16.0) * 0.45;
          float disc = smoothstep(0.9965, 0.9988, sunDot) * 1.4;
          sky += uSunColor * (halo + disc);

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });

    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(this.skyMesh);

    // High-altitude atmospheric clouds
    this.cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    for (let i = 0; i < 28; i++) {
      const puff = new THREE.Group();
      const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.25;
      const dist = 420 + Math.random() * 1250;
      const y = 260 + Math.random() * 140;
      for (let j = 0; j < 3; j++) {
        const geo = new THREE.SphereGeometry(32 + Math.random() * 44, 8, 6);
        geo.scale(2.1, 0.42, 1.3);
        const mesh = new THREE.Mesh(geo, cloudMat);
        mesh.position.set((j - 1) * 38, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 24);
        puff.add(mesh);
      }
      puff.position.set(Math.cos(angle) * dist, y, Math.sin(angle) * dist);
      this.cloudsGroup.add(puff);
    }
    scene.add(this.cloudsGroup);
  }

  public setTimeOfDay(time: TimeOfDay, scene: THREE.Scene) {
    const preset = PRESETS[time];
    this.sunLight.color.copy(preset.sunColor);
    this.sunLight.intensity = preset.sunIntensity;
    this.sunLight.position.copy(preset.sunDirection).multiplyScalar(900);

    this.hemiLight.color.copy(preset.ambientSky);
    this.hemiLight.groundColor.copy(preset.ambientGround);
    this.hemiLight.intensity = preset.ambientIntensity;

    scene.fog = new THREE.FogExp2(preset.fogColor.getHex(), time === 'night' ? 0.00038 : 0.0003);

    this.oceanUniforms.uSunDir.value.copy(preset.sunDirection);
    this.oceanUniforms.uWaterDeep.value.copy(preset.waterDeep);
    this.oceanUniforms.uWaterShallow.value.copy(preset.waterShallow);
    this.oceanUniforms.uSkyHorizon.value.copy(preset.skyHorizon);
    this.oceanUniforms.uSpecColor.value.copy(preset.specColor);
    this.oceanUniforms.uFogColor.value.copy(preset.fogColor);
    this.oceanUniforms.uFogDensity.value = time === 'night' ? 0.00038 : 0.0003;

    this.skyUniforms.uTopColor.value.copy(preset.skyTop);
    this.skyUniforms.uHorizonColor.value.copy(preset.skyHorizon);
    this.skyUniforms.uSunDir.value.copy(preset.sunDirection);
    this.skyUniforms.uSunColor.value.copy(preset.sunColor);

    this.cloudsGroup.children.forEach((g) => {
      g.children.forEach((m) => {
        const mat = (m as THREE.Mesh).material as THREE.MeshLambertMaterial;
        mat.color.set(time === 'sunset' ? 0xffcaa6 : time === 'night' ? 0x2a3b5c : 0xffffff);
        mat.opacity = time === 'night' ? 0.14 : 0.25;
      });
    });
  }

  public update(dt: number, elapsed: number) {
    this.oceanUniforms.uTime.value = elapsed;
    this.cloudsGroup.rotation.y += dt * 0.003;
  }
}
