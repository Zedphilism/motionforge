import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Scene3DConfig } from '../types/studio';

let cachedSoftwareGl: boolean | null = null;

export function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  if (typeof document === 'undefined') return true;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = true;
    return true;
  }
}

interface ExplodablePart {
  mesh: THREE.Object3D;
  basePosition: THREE.Vector3;
  explodeVector: THREE.Vector3;
}

function buildCompositeArchetype(
  archetype: Scene3DConfig['proceduralArchetype'],
  primaryMat: THREE.MeshStandardMaterial,
  accentMat: THREE.MeshStandardMaterial,
  darkMat: THREE.MeshStandardMaterial,
  glassMat: THREE.MeshStandardMaterial
): { group: THREE.Group; parts: ExplodablePart[] } {
  const group = new THREE.Group();
  const parts: ExplodablePart[] = [];

  const registerPart = (obj: THREE.Object3D, explodeDir: [number, number, number]) => {
    group.add(obj);
    parts.push({
      mesh: obj,
      basePosition: obj.position.clone(),
      explodeVector: new THREE.Vector3(...explodeDir),
    });
  };

  // Grounded circular pedestal base (shared across archetypes, bottom at y=0)
  const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.16, 36), darkMat);
  basePlate.position.set(0, 0.08, 0);
  registerPart(basePlate, [0, -0.35, 0]);

  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.035, 12, 48), accentMat);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.set(0, 0.17, 0);
  registerPart(baseRing, [0, -0.2, 0]);

  if (archetype === 'turbine-rotor') {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 1.35, 24), primaryMat);
    hub.position.set(0, 1.15, 0);
    registerPart(hub, [0, 0.25, 0]);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.48, 24), accentMat);
    cap.position.set(0, 2.06, 0);
    registerPart(cap, [0, 0.85, 0]);

    const bladeGeo = new THREE.BoxGeometry(1.25, 0.14, 0.28);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const bladePivot = new THREE.Group();
      bladePivot.position.set(Math.cos(angle) * 0.72, 1.25, Math.sin(angle) * 0.72);
      bladePivot.rotation.y = -angle;
      const blade = new THREE.Mesh(bladeGeo, i % 2 === 0 ? primaryMat : darkMat);
      blade.rotation.x = 0.32;
      bladePivot.add(blade);
      registerPart(bladePivot, [Math.cos(angle) * 0.7, 0.25, Math.sin(angle) * 0.7]);
    }

    const shroud = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.07, 16, 48), glassMat);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(0, 1.25, 0);
    registerPart(shroud, [0, 0.55, 0]);
  } else if (archetype === 'orbital-array') {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 1), accentMat);
    core.position.set(0, 1.25, 0);
    registerPart(core, [0, 0.35, 0]);

    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.045, 16, 48), primaryMat);
    innerRing.position.set(0, 1.25, 0);
    innerRing.rotation.set(Math.PI / 3, 0.4, 0);
    registerPart(innerRing, [0, 0.15, 0.4]);

    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.04, 16, 56), darkMat);
    outerRing.position.set(0, 1.25, 0);
    outerRing.rotation.set(-Math.PI / 4, -0.3, 0.2);
    registerPart(outerRing, [0, 0.45, -0.4]);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const node = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), i % 2 === 0 ? primaryMat : accentMat);
      node.position.set(Math.cos(angle) * 1.15, 1.25 + (i % 2 === 0 ? 0.28 : -0.28), Math.sin(angle) * 1.15);
      registerPart(node, [Math.cos(angle) * 0.75, 0.4, Math.sin(angle) * 0.75]);
    }

    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.76, 24, 24), glassMat);
    shell.position.set(0, 1.25, 0);
    registerPart(shell, [0, 0.85, 0]);
  } else if (archetype === 'layered-chassis') {
    for (let i = 0; i < 4; i++) {
      const w = 1.8 - i * 0.24;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, w * 0.75), i % 2 === 0 ? primaryMat : darkMat);
      plate.position.set(0, 0.45 + i * 0.42, 0);
      registerPart(plate, [0, 0.25 + i * 0.35, 0]);
    }
    for (const sx of [-0.65, 0.65]) {
      for (const sz of [-0.45, 0.45]) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.65, 12), accentMat);
        strut.position.set(sx, 1.05, sz);
        registerPart(strut, [sx * 0.6, 0.1, sz * 0.6]);
      }
    }
    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.26, 0.85), glassMat);
    visor.position.set(0, 2.02, 0);
    registerPart(visor, [0, 1.15, 0]);
  } else {
    // Default: modular-core (8-part industrial cutaway assembly)
    const lowerCore = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.86, 0.45, 28), darkMat);
    lowerCore.position.set(0, 0.42, 0);
    registerPart(lowerCore, [0, -0.1, 0]);

    const centralCapsule = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 1.28, 28), primaryMat);
    centralCapsule.position.set(0, 1.24, 0);
    registerPart(centralCapsule, [0, 0.2, 0]);

    const glassSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 1.05, 28, 1, true), glassMat);
    glassSleeve.position.set(0, 1.24, 0);
    registerPart(glassSleeve, [0, 0.55, 0]);

    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.82, 0.32, 28), darkMat);
    topCap.position.set(0, 2.02, 0);
    registerPart(topCap, [0, 0.95, 0]);

    const accentCrown = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 16, 36), accentMat);
    accentCrown.rotation.x = Math.PI / 2;
    accentCrown.position.set(0, 2.22, 0);
    registerPart(accentCrown, [0, 1.25, 0]);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.12, 0.34), i % 2 === 0 ? accentMat : primaryMat);
      fin.position.set(Math.cos(angle) * 0.92, 1.22, Math.sin(angle) * 0.92);
      fin.rotation.y = -angle;
      registerPart(fin, [Math.cos(angle) * 0.72, 0.25, Math.sin(angle) * 0.72]);
    }
  }

  return { group, parts };
}

export class ThreeSceneController {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  perspCamera: THREE.PerspectiveCamera;
  orthoCamera: THREE.OrthographicCamera;
  activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  controls: OrbitControls | null = null;
  isSoftwareGl: boolean;

  private rootGroup: THREE.Group;
  private modelGroup: THREE.Group | null = null;
  private explodableParts: ExplodablePart[] = [];
  private gridHelper: THREE.GridHelper;
  private contactShadow: THREE.Mesh;
  private primaryMat: THREE.MeshStandardMaterial;
  private accentMat: THREE.MeshStandardMaterial;
  private darkMat: THREE.MeshStandardMaterial;
  private glassMat: THREE.MeshStandardMaterial;
  private mixer: THREE.AnimationMixer | null = null;
  private currentArchetype: string = '';
  private currentModelKey: string = '';
  private gltfLoader = new GLTFLoader();
  private renderBusy = false;
  private renderDirty = false;
  private frameId = 0;
  private disposed = false;

  constructor(options: { width: number; height: number; interactive?: boolean; container?: HTMLElement }) {
    this.isSoftwareGl = detectSoftwareWebGL();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(options.width, options.height, false);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    if (options.container) {
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.display = 'block';
      options.container.appendChild(this.renderer.domElement);
    }

    this.scene = new THREE.Scene();

    // Studio PBR Reflections via RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const aspect = options.width / Math.max(1, options.height);
    this.perspCamera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    this.perspCamera.position.set(4.1, 2.55, 4.7);

    const frustum = 4.9;
    this.orthoCamera = new THREE.OrthographicCamera(
      (-frustum * aspect) / 2,
      (frustum * aspect) / 2,
      frustum / 2,
      -frustum / 2,
      0.1,
      100
    );
    this.orthoCamera.position.set(4.1, 2.55, 4.7);
    this.activeCamera = this.perspCamera;

    // Warm/cool 3-point studio rig
    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x1b2434, 0.85);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.9);
    keyLight.position.set(5.5, 7.5, 4.5);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x56b4ff, 1.15);
    rimLight.position.set(-5.0, 4.0, -4.5);
    this.scene.add(rimLight);

    // Subtle studio floor grid & soft radial contact shadow
    this.gridHelper = new THREE.GridHelper(10, 20, 0x38bdf8, 0x1e293b);
    this.gridHelper.position.y = 0;
    this.scene.add(this.gridHelper);

    const shadowTex = this.createContactShadowTexture();
    this.contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(2.1, 32),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.45,
      })
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.015;
    this.scene.add(this.contactShadow);

    this.primaryMat = new THREE.MeshStandardMaterial({ color: '#38BDF8', metalness: 0.65, roughness: 0.28 });
    this.accentMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', metalness: 0.8, roughness: 0.2 });
    this.darkMat = new THREE.MeshStandardMaterial({ color: '#1E293B', metalness: 0.35, roughness: 0.68 });
    this.glassMat = new THREE.MeshStandardMaterial({
      color: '#BAE6FD',
      metalness: 0.15,
      roughness: 0.12,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    if (options.interactive) {
      this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
      this.controls.target.set(0, 0.65, 0);
      this.controls.enableDamping = !this.isSoftwareGl;
      this.controls.autoRotate = false;
      this.controls.addEventListener('change', () => this.requestRender());
      this.controls.update();
    }
  }

  private createContactShadowTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      grad.addColorStop(0, 'rgba(0,0,0,0.85)');
      grad.addColorStop(0.55, 'rgba(0,0,0,0.35)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  resize(width: number, height: number) {
    if (this.disposed || width <= 0 || height <= 0) return;
    const aspect = width / height;
    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();

    const frustum = 4.6;
    this.orthoCamera.left = (-frustum * aspect) / 2;
    this.orthoCamera.right = (frustum * aspect) / 2;
    this.orthoCamera.top = frustum / 2;
    this.orthoCamera.bottom = -frustum / 2;
    this.orthoCamera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
    this.requestRender();
  }

  private clearCurrentModel() {
    if (this.modelGroup) {
      this.rootGroup.remove(this.modelGroup);
      this.modelGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        }
      });
      this.modelGroup = null;
    }
    this.explodableParts = [];
    this.mixer = null;
  }

  async loadGltfFromBlob(blob: Blob, key: string): Promise<void> {
    if (this.currentModelKey === key || this.disposed) return;
    this.currentModelKey = key;
    const buffer = await blob.arrayBuffer();
    await new Promise<void>((resolve, reject) => {
      this.gltfLoader.parse(
        buffer,
        '',
        (gltf) => {
          if (this.disposed) {
            resolve();
            return;
          }
          this.clearCurrentModel();
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z, 0.001);
          const normScale = 2.2 / maxDim;
          model.scale.setScalar(normScale);
          model.position.set(-center.x * normScale, -box.min.y * normScale, -center.z * normScale);

          const group = new THREE.Group();
          group.add(model);
          this.modelGroup = group;
          this.rootGroup.add(group);
          this.currentArchetype = 'custom-glb';

          if (gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach((clip) => this.mixer?.clipAction(clip).play());
          }
          this.requestRender();
          resolve();
        },
        (err) => reject(err)
      );
    });
  }

  applyConfig(config: Scene3DConfig, timeSec = 0, useOrbitCamera = false) {
    if (this.disposed) return;

    // Rebuild procedural model if archetype changed and no custom GLB is active
    if (!config.modelAssetId && this.currentArchetype !== config.proceduralArchetype) {
      this.clearCurrentModel();
      const built = buildCompositeArchetype(
        config.proceduralArchetype,
        this.primaryMat,
        this.accentMat,
        this.darkMat,
        this.glassMat
      );
      this.modelGroup = built.group;
      this.explodableParts = built.parts;
      this.rootGroup.add(built.group);
      this.currentArchetype = config.proceduralArchetype;
      this.currentModelKey = '';
    }

    // Update materials & wireframe
    this.primaryMat.color.set(config.materialColor || '#38BDF8');
    this.primaryMat.metalness = config.metalness;
    this.primaryMat.roughness = config.roughness;
    this.primaryMat.wireframe = config.wireframe;

    this.accentMat.color.set(config.accentColor || '#F59E0B');
    this.accentMat.wireframe = config.wireframe;
    this.darkMat.wireframe = config.wireframe;
    this.glassMat.wireframe = config.wireframe;

    if (this.currentArchetype === 'custom-glb' && this.modelGroup) {
      this.modelGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mat = (obj as THREE.Mesh).material;
          if (mat && !Array.isArray(mat) && 'wireframe' in mat) {
            (mat as THREE.MeshStandardMaterial).wireframe = config.wireframe;
          }
        }
      });
    }

    // Exploded view displacement
    const explode = Math.max(0, Math.min(1.5, config.explodedFactor || 0));
    for (const part of this.explodableParts) {
      part.mesh.position.copy(part.basePosition).addScaledVector(part.explodeVector, explode);
    }

    // Root transforms
    this.rootGroup.scale.setScalar(Math.max(0.2, config.scale || 1));
    this.rootGroup.rotation.x = config.rotationX || 0;
    this.rootGroup.rotation.y = (config.rotationY || 0) + timeSec * (config.orbitSpeed || 0);

    // Background & grid
    this.gridHelper.visible = config.showGrid;
    if (config.transparentBg) {
      this.scene.background = null;
      this.renderer.setClearColor(0x000000, 0);
    } else {
      const bg = new THREE.Color(config.backgroundColor || '#0A1220');
      this.scene.background = bg;
      this.renderer.setClearColor(bg, 1);
    }

    // Switch perspective/orthographic camera
    const nextCamera = config.cameraType === 'orthographic' ? this.orthoCamera : this.perspCamera;
    if (this.activeCamera !== nextCamera) {
      nextCamera.position.copy(this.activeCamera.position);
      this.activeCamera = nextCamera;
      if (this.controls) {
        this.controls.object = this.activeCamera;
        this.controls.update();
      }
    }

    if (!useOrbitCamera) {
      const dist = Math.max(2, config.cameraDistance || 5.2);
      const elev = config.cameraElevation ?? 1.8;
      this.activeCamera.position.set(dist * 0.72, elev, dist * 0.72);
      this.activeCamera.lookAt(0, 1.1, 0);
    }

    if (this.mixer) {
      this.mixer.setTime(timeSec);
    }
  }

  renderNow() {
    if (this.disposed) return;
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.activeCamera);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  requestRender() {
    if (this.disposed) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.frameId = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.renderDirty = false;
      if (this.controls) this.controls.update();
      this.renderer.render(this.scene, this.activeCamera);
      const done = () => {
        this.renderBusy = false;
        if (this.renderDirty && !this.disposed) this.requestRender();
      };
      if (this.isSoftwareGl) {
        this.afterDraw(done);
      } else {
        done();
      }
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.controls?.dispose();
    this.clearCurrentModel();
    this.primaryMat.dispose();
    this.accentMat.dispose();
    this.darkMat.dispose();
    this.glassMat.dispose();
    this.contactShadow.geometry.dispose();
    (this.contactShadow.material as THREE.Material).dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

// Shared offscreen controller for deterministic 2D+3D video frame compositing
let offscreenController: ThreeSceneController | null = null;

export function render3DSnapshot(
  config: Scene3DConfig,
  timeSec: number,
  width: number,
  height: number,
  glbBlob?: Blob | null
): HTMLCanvasElement | null {
  try {
    const safeW = Math.max(240, Math.min(960, Math.round(width)));
    const safeH = Math.max(180, Math.min(720, Math.round(height)));
    if (!offscreenController) {
      offscreenController = new ThreeSceneController({ width: safeW, height: safeH, interactive: false });
    } else {
      const dom = offscreenController.renderer.domElement;
      if (dom.width !== safeW || dom.height !== safeH) {
        offscreenController.resize(safeW, safeH);
      }
    }
    if (glbBlob && config.modelAssetId) {
      void offscreenController.loadGltfFromBlob(glbBlob, config.modelAssetId);
    }
    offscreenController.applyConfig(config, timeSec, false);
    offscreenController.renderNow();
    return offscreenController.renderer.domElement;
  } catch {
    return null;
  }
}
