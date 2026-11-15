import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const PADS = [
  { id: "green", name: "Green", color: 0x24c87a, emissive: 0x0d7142 },
  { id: "red", name: "Red", color: 0xff6376, emissive: 0x8e193b },
  { id: "yellow", name: "Yellow", color: 0xffd45e, emissive: 0x98620e },
  { id: "blue", name: "Blue", color: 0x54a7ff, emissive: 0x1d4b99 },
];

const PAD_POSITIONS = [
  { x: -0.98, z: -0.98 },
  { x: 0.98, z: -0.98 },
  { x: -0.98, z: 0.98 },
  { x: 0.98, z: 0.98 },
];

export default function Board3D({ activePad, acceptingInput, onPadClick }) {
  const mountRef = useRef(null);
  const latestGameRef = useRef({ acceptingInput, activePad, onPadClick });
  const updateAppearanceRef = useRef(() => {});
  const [webglError, setWebglError] = useState(false);

  latestGameRef.current = { acceptingInput, activePad, onPadClick };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglError(true);
      return undefined;
    }

    setWebglError(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = "srgb";
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = "simon-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(39, 1, 0.1, 100);
    camera.position.set(5.9, 7.5, 8);
    camera.lookAt(0, 0.15, 0);
    scene.add(new AmbientLight(0xc8d7ff, 1.35));

    const keyLight = new DirectionalLight(0xffffff, 3.4);
    keyLight.position.set(-4, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const rimLight = new PointLight(0x668dff, 24, 11);
    rimLight.position.set(3.5, 3.2, -3.2);
    scene.add(rimLight);

    const base = new Mesh(
      new RoundedBoxGeometry(4.62, 0.48, 4.62, 5, 0.2),
      new MeshStandardMaterial({
        color: 0x121c32,
        roughness: 0.34,
        metalness: 0.34,
      }),
    );
    base.position.y = -0.31;
    base.receiveShadow = true;
    scene.add(base);

    const padGeometry = new RoundedBoxGeometry(1.94, 0.35, 1.94, 6, 0.14);
    const pads = PADS.map((pad, index) => {
      const material = new MeshStandardMaterial({
        color: pad.color,
        emissive: pad.emissive,
        emissiveIntensity: 0.2,
        roughness: 0.32,
        metalness: 0.14,
      });
      const mesh = new Mesh(padGeometry, material);
      mesh.position.set(PAD_POSITIONS[index].x, 0.1, PAD_POSITIONS[index].z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.padId = pad.id;
      scene.add(mesh);

      const glow = new PointLight(pad.color, 0, 3.3);
      glow.position.set(mesh.position.x, 0.8, mesh.position.z);
      scene.add(glow);

      return { mesh, glow, baseColor: new Color(pad.color), emissive: pad.emissive };
    });

    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const canvas = renderer.domElement;
    let hoveredPad = null;
    let frameId;

    function updatePads() {
      const { activePad: currentActivePad, acceptingInput: canInteract } =
        latestGameRef.current;
      pads.forEach(({ mesh, glow, baseColor, emissive }, index) => {
        const isActive = PADS[index].id === currentActivePad;
        const isHovered = PADS[index].id === hoveredPad && canInteract;
        const intensity = isActive ? 1.25 : isHovered ? 0.58 : 0.2;
        mesh.material.emissive.setHex(
          isActive || isHovered ? PADS[index].color : emissive,
        );
        mesh.material.emissiveIntensity = intensity;
        mesh.material.color.copy(baseColor).multiplyScalar(isActive ? 1.14 : 1);
        mesh.scale.setScalar(isActive ? 1.035 : isHovered ? 1.018 : 1);
        glow.intensity = isActive ? 3.8 : isHovered ? 1.1 : 0;
      });
    }
    updateAppearanceRef.current = updatePads;

    function getPadAt(event) {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(
        pads.map(({ mesh }) => mesh),
        false,
      )[0];
      return hit?.object.userData.padId ?? null;
    }

    function handlePointerMove(event) {
      hoveredPad = getPadAt(event);
      canvas.style.cursor =
        hoveredPad && latestGameRef.current.acceptingInput ? "pointer" : "default";
      updatePads();
    }

    function handlePointerLeave() {
      hoveredPad = null;
      canvas.style.cursor = "default";
      updatePads();
    }

    function handlePointerDown(event) {
      const padId = getPadAt(event);
      if (padId && latestGameRef.current.acceptingInput) {
        latestGameRef.current.onPadClick(padId);
      }
    }

    function resize() {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("pointerdown", handlePointerDown);

    function render() {
      frameId = requestAnimationFrame(render);
      renderer.render(scene, camera);
    }
    render();
    updatePads();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      canvas.remove();
      updateAppearanceRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    updateAppearanceRef.current();
  }, [activePad, acceptingInput]);

  return (
    <div className="scene-wrap">
      <div className="simon-scene" ref={mountRef} />
      {webglError && (
        <p className="webgl-error" role="alert">
          This browser could not start WebGL. Try enabling hardware acceleration
          or using a WebGL-capable browser.
        </p>
      )}
    </div>
  );
}
