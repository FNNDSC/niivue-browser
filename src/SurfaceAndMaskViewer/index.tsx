import { Niivue } from "@niivue/niivue";
import { useEffect, useRef, useState } from "preact/hooks";
import { Mesh, MeshOverlaySettings, VisualState } from "../lib/visualstate";
import { NVMeshFromUrlOptions } from "@niivue/niivue";

/**
 * A wrapper around two NiiVue canvases: one which shows meshes, and a smaller one which shows the volumes.
 *
 * The Niivue instance and canvas are not reactive in the way React.js works, so its state is mutated
 * manually within `useEffect`.
 *
 * When the prop `nvState` changes: if `nvState.counter` is changed, then the NiiVues are rerendered.
 * Otherwise, the NiiVue instances are mutated to reflect the updates to `nvState`.
 */
const SubplateSurfaces = ({ visualState }: { visualState: VisualState }) => {
  const [prevState, setPrevState] = useState<VisualState>(visualState);

  const meshCanvas = useRef();
  const volumeCanvas = useRef();

  const meshNvRef = useRef<Niivue>(new Niivue());
  const volumeNvRef = useRef<Niivue>(new Niivue());

  const [lowerCanvasHeight, setLowerCanvasHeight] = useState(300);

  /**
   * (Re-)Initialize the Niivue instance and load meshes and volumes.
   */
  const init = async () => {
    await Promise.all([initMeshCanvas(), initVolumeCanvas()]);
    syncNiivueSettings();
    volumeNvRef.current.syncWith(meshNvRef.current, {
      "3d": true,
      "2d": true,
    });
    meshNvRef.current.syncWith(volumeNvRef.current, {
      "3d": true,
      "2d": true,
    });
  };

  const initVolumeCanvas = async () => {
    // Note: need to create new Niivue object when switching subjects, otherwise WebGL freezes.
    volumeNvRef.current = new Niivue();
    const nv = volumeNvRef.current;
    nv.attachToCanvas(volumeCanvas.current);
    nv.setHighResolutionCapable(visualState.highResolutionCapable);

    await nv.loadVolumes(visualState.volumes);
    nv.setSliceType(3);
    nv.setSliceMM(true);
    nv.opts.multiplanarForceRender = true;
  };

  const initMeshCanvas = async () => {
    // Note: need to create new Niivue object when switching subjects, otherwise WebGL freezes.
    meshNvRef.current = new Niivue({ isColorbar: true });
    const nv = meshNvRef.current;
    nv.attachToCanvas(meshCanvas.current);
    nv.setHighResolutionCapable(visualState.highResolutionCapable);
    await loadMeshes();

    // Niivue settings
    nv.setMeshThicknessOn2D(0);
  };

  /**
   * Unload all meshes, then load only the visible ones.
   */
  const loadMeshes = async () => {
    const nv = meshNvRef.current;

    for (const loadedMesh of nv.meshes) {
      nv.removeMesh(loadedMesh);
    }

    const meshOptions = visualState.meshes
      .filter((mesh) => mesh.visible)
      .map((mesh) =>
        addMeshOverlaySettings(mesh, visualState.globalMeshOverlaySettings),
      );
    await nv.loadMeshes(meshOptions);
    hideAllButOneMeshLayerColorbar(nv);
  };

  /**
   * Sync the Niivue instance's meshes state with `visualState.meshes`.
   */
  const syncMeshes = () => {
    const visibleUrls = (meshes: Mesh[]) =>
      meshes.filter((mesh) => mesh.visible).map((mesh) => mesh.url);
    if (
      JSON.stringify(visibleUrls(prevState.meshes)) ===
      JSON.stringify(visibleUrls(visualState.meshes))
    ) {
      syncMeshLayerProperties();
    } else {
      loadMeshes();
    }
  };

  /**
   * Sync the mesh layer opacities with the prop:
   *
   * - the active layer of each mesh should have opacity=1.0,
   *   every other layer should have opacity=0.0.
   * - update value of `cal_min` and `cal_max`
   */
  const syncMeshLayerProperties = () => {
    const nv = meshNvRef.current;

    const desiredMeshes = visualState.meshes.filter((mesh) => mesh.visible);

    for (const loadedMesh of nv.meshes) {
      const desiredMesh = desiredMeshes.find(
        (mesh) => mesh.name === loadedMesh.name,
      );
      if (desiredMesh === undefined) {
        continue;
      }
      for (let i = 0; i < loadedMesh.layers.length; i++) {
        const opacity =
          desiredMesh.activeLayerIndex !== null &&
          desiredMesh.activeLayerIndex === i
            ? 1.0
            : 0.0;
        const properties = {
          opacity,
          ...visualState.globalMeshOverlaySettings,
        };
        Object.entries(properties).forEach(([key, value]) => {
          nv.setMeshLayerProperty(loadedMesh.id, i, key, value);
        });
      }
    }
  };

  /**
   * Change Niivue settings (which are unrelated to any specific data file).
   */
  const syncNiivueSettings = () => {
    [meshNvRef, volumeNvRef]
      .map((ref) => ref.current)
      .forEach((nv) => {
        nv.setHighResolutionCapable(visualState.highResolutionCapable);
      });
    meshNvRef.current.opts.isOrientCube = visualState.isOrientCube;
  };

  /**
   * Sync the Niivue instance's volume opacities with the prop.
   */
  const syncVolumeOpacities = () => {
    const nv = volumeNvRef.current;
    zipNvState(nv.volumes, visualState.volumes, "url").forEach(
      ([i, _vol, desiredState]) => {
        nv.setOpacity(i, desiredState.opacity);
      },
    );
  };

  useEffect(() => {

    /**
     * Mutate the current Niivue instance's loaded mesh and volume properties.
     */
    const sync = () => {
      syncNiivueSettings();
      syncVolumeOpacities();
      syncMeshes();
    };

    if (prevState.counter !== visualState.counter) {
      init();
    } else if (meshNvRef.current.gl && volumeNvRef.current.gl) {
      // update only when OpenGL is ready, which is not true during first render
      sync();
    }
    setPrevState(visualState);
  }, [visualState]);

  return (
    <div style={{ height: "100%" }}>
      <div style={{ height: `calc(100% - ${lowerCanvasHeight}px)` }}>
        <canvas ref={meshCanvas} />
      </div>
      <div style={{ height: `${lowerCanvasHeight}px` }}>
        <canvas ref={volumeCanvas} />
      </div>
    </div>
  );
};

/**
 * Produce pairs from the two given lists which have the same URL.
 */
function zipNvState<N, D>(
  nvList: N[],
  desiredState: D[],
  key: string,
): [number, N, D][] {
  return nvList
    .map((nvData, i): [number, N, D] | null => {
      if (nvData[key] === undefined) {
        console.warn(`Element at index ${i} does not have the key ${key}`);
        return null;
      }
      const desiredDataState = desiredState.find(
        (other) => other[key] === nvData[key],
      );
      if (desiredDataState) {
        return [i, nvData, desiredDataState];
      }
      console.warn(
        `No desired state found for object where ${key}=${nvData[key]}`,
      );
      return null;
    })
    .filter((t) => t !== null);
}

function addMeshOverlaySettings(
  mesh: Mesh,
  meshOverlaySettings: MeshOverlaySettings,
): NVMeshFromUrlOptions {
  const layers = mesh.layerUrls.map((url) => {
    return { url, opacity: 0.0, ...meshOverlaySettings };
  });
  if (mesh.activeLayerIndex !== null) {
    layers[mesh.activeLayerIndex].opacity = 1.0;
  }
  return {
    url: mesh.url,
    name: mesh.name,
    opacity: mesh.opacity,
    visible: mesh.visible,
    layers,
  };
}

function hideAllButOneMeshLayerColorbar(nv: Niivue) {
  if (!nv.meshes) {
    return;
  }

  for (let v = 1; v < nv.meshes[0].layers.length; v++) {
    nv.setMeshLayerProperty(nv.meshes[0].id, v, "colorbarVisible", false);
  }

  for (let i = 1; i < nv.meshes.length; i++) {
    nv.setMeshProperty(nv.meshes[i].id, "colorbarVisible", false);

    for (let v = 0; v < nv.meshes[i].layers.length; v++) {
      nv.setMeshLayerProperty(nv.meshes[i].id, v, "colorbarVisible", false);
    }
  }
}

export default SubplateSurfaces;
