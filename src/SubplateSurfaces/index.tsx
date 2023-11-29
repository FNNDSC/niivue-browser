import { Niivue } from "@niivue/niivue";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  HasUrl,
  Mesh,
  MeshOverlaySettings,
  VisualState,
} from "../lib/visualstate";
import { NVMeshFromUrlOptions } from "@niivue/niivue";

/**
 * A wrapper around two NiiVue canvases: one which shows meshes, and a smaller one which shows the volumes.
 *
 * The Niivue instance and canvas are not reactive in the way React.js works, so its state is mutated
 * manually within `useEffect`.
 *
 * When the prop `nvState` changes: if `nvState.counter` is changed, then the NiiVues are rerendered.
 * Otherwise, the NiiVue instances are mutated to reflect the updates to `nvState`.
 *
 * Niivue bugs to be aware of:
 *
 * - mesh visible and opacity don't do anything, so we need to load/unload them. https://github.com/niivue/niivue/issues/762
 * - mesh center of rotation isn't always right. https://github.com/niivue/niivue/issues/759
 */
const SubplateSurfaces = ({ visualState }: { visualState: VisualState }) => {
  const [prevState, setPrevState] = useState<VisualState>(visualState);

  const meshCanvas = useRef();
  const volumeCanvas = useRef();

  const meshNvRef = useRef<Niivue>();
  const volumeNvRef = useRef<Niivue>();

  const [lowerCanvasHeight, setLowerCanvasHeight] = useState(300);

  /**
   * Compare the prop with Niivue's internal state. Unload any meshes which are changed or removed,
   * then load all visible meshes.
   */
  const changeMeshes = async () => {
    const nv = meshNvRef.current;
    if (!nv) {
      return;
    }

    const desiredMeshes = visualState.meshes
      .filter((mesh) => mesh.visible)
      .map((mesh) =>
        addMeshOverlaySettings(mesh, visualState.globalMeshOverlaySettings),
      );

    for (const loadedMesh of nv.meshes) {
      const desiredMesh = desiredMeshes.find(
        (mesh) => mesh.name === loadedMesh.name,
      );
      // mesh is loaded, but it is changed thus should be removed.
      if (
        desiredMesh === undefined ||
        meshesAreDifferent(desiredMesh, loadedMesh)
      ) {
        nv.removeMesh(loadedMesh);
      }
    }

    await nv.loadMeshes(desiredMeshes);
    hideAllButOneMeshLayerColorbar(nv);
  };

  useEffect(() => {
    const initMeshCanvas = async () => {
      // Note: need to create new Niivue object when switching subjects, otherwise WebGL freezes.
      meshNvRef.current = new Niivue({ isColorbar: true });
      const meshNv = meshNvRef.current;
      meshNv.attachToCanvas(meshCanvas.current);
      await changeMeshes();

      // hack: load the first volume to force the meshes to use the same axes as the volumes.
      // https://github.com/niivue/niivue/issues/759
      if (visualState.volumes) {
        await meshNv.loadVolumes([
          { url: visualState.volumes[0].url, opacity: 0.0 },
        ]);
        // WARNING: using undocumented functions
        meshNv.volumes[0].colorbarVisible = false;
        meshNv.updateGLVolume();
      }

      // Niivue settings
      meshNv.setMeshThicknessOn2D(0);
      meshNv.setHighResolutionCapable(false);
      meshNv.opts.isOrientCube = true;
    };

    const initVolumeCanvas = async () => {
      // Note: need to create new Niivue object when switching subjects, otherwise WebGL freezes.
      volumeNvRef.current = new Niivue();
      const volumeNv = volumeNvRef.current;

      volumeNv.attachToCanvas(volumeCanvas.current);
      await volumeNv.loadVolumes(visualState.volumes);
      volumeNv.setSliceType(3);
      volumeNv.setSliceMM(true);
      volumeNv.opts.multiplanarForceRender = true;
    };

    /**
     * (Re-)Initialize the Niivue instance and load meshes and volumes.
     */
    const init = async () => {
      await Promise.all([initMeshCanvas(), initVolumeCanvas()]);
      volumeNvRef.current.syncWith(meshNvRef.current, {
        "3d": true,
        "2d": true,
      });
      meshNvRef.current.syncWith(volumeNvRef.current, {
        "3d": true,
        "2d": true,
      });
    };

    /**
     * Sync the Niivue instance's volume opacities with the prop.
     */
    const updateVolumeOpacities = () => {
      const nv = volumeNvRef.current;
      if (!nv) {
        return;
      }
      zipNvState(nv.volumes, visualState.volumes, "url").forEach(
        ([i, _vol, desiredState]) => {
          nv.setOpacity(i, desiredState.opacity);
        },
      );
    };

    /**
     * Mutate the current Niivue instance's loaded mesh and volume properties.
     */
    const update = () => {
      updateVolumeOpacities();
      changeMeshes();
    };

    if (prevState.counter !== visualState.counter) {
      init();
    } else {
      update();
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
  return {
    url: mesh.url,
    name: mesh.name,
    opacity: mesh.opacity,
    visible: mesh.visible,
    layers: mesh.activeLayerIndex
      ? [{ url: mesh.layerUrls[mesh.activeLayerIndex], ...meshOverlaySettings }]
      : [],
  };
}

function hideAllButOneMeshLayerColorbar(nv: Niivue) {
  for (let i = 1; i < nv.meshes.length; i++) {
    nv.setMeshProperty(nv.meshes[i].id, "colorbarVisible", false);
  }
}

function meshesAreDifferent(
  a: NVMeshFromUrlOptions,
  b: NVMeshFromUrlOptions,
): boolean {
  return false; // TODO
}

export default SubplateSurfaces;
