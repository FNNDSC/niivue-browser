import { SubjectUrls } from "./client";
import { produce, immerable } from "immer";

/**
 * `NVMeshLayer` options.
 *
 * https://niivue.github.io/niivue/devdocs/global.html#NVMeshLayer
 */
type MeshOverlaySettings = {
  colormap: string;
  colormapNegative: string;
  useNegativeCmap: boolean;
  cal_min: number;
  cal_max: number;
};

/**
 * A file from a URL which has data for a layer of a brain hemisphere.
 */
abstract class BrainHemiFile {
  readonly url: string;
  readonly opacity: number = 1.0;

  [immerable] = true;

  protected constructor(url: string, opacity: number) {
    this.url = url;
    this.opacity = opacity;
  }

  /**
   * Return the file name portion of a URL.
   */
  get name(): string {
    return filenameOfUrl(this.url);
  }

  /**
   * Produce the file name without:
   *
   * - file extension
   * - `lh.`/`rh.` prefixes
   * - `_81920` suffix (MNI surface convention)
   */
  get centerName(): string {
    return centerNameOf(this.url);
  }
}

function centerNameOf(urlOrFilename: string) {
  let name = filenameWithoutExtension(filenameOfUrl(urlOrFilename));
  if (name.startsWith("lh.") || name.startsWith("rh.")) {
    name = name.substring(3);
  }
  if (name.endsWith("_81920")) {
    name = name.substring(0, name.length - 6);
    if (name.endsWith(".")) {
      name = name.substring(0, name.length - 1);
    }
  }
  return name;
}

/**
 * Simplified data for `NVMeshFromUrlOptions` which supports only a single layer.
 *
 * https://niivue.github.io/niivue/devdocs/global.html#NVMeshFromUrlOptions
 */
class Mesh extends BrainHemiFile {
  readonly layerUrls: string[];
  visible: boolean;
  activeLayerIndex: number | null = null;

  protected constructor(
    url: string,
    opacity: number,
    layerUrls: string[],
    visible: boolean,
    activeLayerIndex: number | null,
  ) {
    super(url, opacity);
    this.layerUrls = layerUrls;
    this.visible = visible;
    this.activeLayerIndex = activeLayerIndex;
  }

  static create(url: string, allLayerUrls: string[]): Mesh {
    const layerUrls = findOverlaysForMesh(url, allLayerUrls);
    return new Mesh(url, 1.0, layerUrls, false, null);
  }

  changeVisible(visible: boolean): Mesh {
    return produce(this, (draft) => {
      draft.visible = visible;
    });
  }

  changeActiveLayer(activeLayerIndex: number): Mesh {
    if (activeLayerIndex < 0 || activeLayerIndex >= this.layerUrls.length) {
      throw Error(
        `${activeLayerIndex} is not in the range [0, ${this.layerUrls.length})`,
      );
    }
    return produce(this, (draft) => {
      draft.activeLayerIndex = activeLayerIndex;
    });
  }

  get activeLayerUrl(): string | null {
    if (this.activeLayerIndex === null) {
      return null;
    }
    return this.layerUrls[this.activeLayerIndex];
  }
}

/**
 * Simplified options for loading a volume using NiiVue.
 *
 * https://niivue.github.io/niivue/devdocs/Niivue.html#loadVolumes
 */
class Volume extends BrainHemiFile {
  constructor(url: string, opacity: number) {
    super(url, opacity);
  }

  changeOpacity(opacity: number): Volume {
    return produce(this, (draft) => {
      draft.opacity = opacity;
    });
  }
}

/**
 * Find mesh overlays which correspond to the given mesh according to file name.
 */
function findOverlaysForMesh(meshUrl: string, overlayUrls: string[]): string[] {
  const meshNameWithoutExtension = filenameWithoutExtension(
    filenameOfUrl(meshUrl),
  );
  return overlayUrls.filter((overlayUrl) => {
    return filenameOfUrl(overlayUrl).startsWith(meshNameWithoutExtension);
  });
}

/**
 * The state of the visualizer. These fields somewhat correspond to the parameters to NiiVue's functions.
 */
type VisualState = {
  /**
   * Mesh and mesh overlay data to display.
   */
  meshes: Mesh[];
  /**
   * Volume data to display.
   */
  volumes: Volume[];
  /**
   * A monotonic counter which changes value when a different subject is selected.
   */
  counter: number;
  /**
   * Mesh overlay settings to use for all mesh overlays.
   */
  globalMeshOverlaySettings: MeshOverlaySettings;
};

const INITIAL_STATE: VisualState = {
  meshes: [],
  volumes: [],
  counter: 0,
  globalMeshOverlaySettings: {
    colormap: "blue2red",
    colormapNegative: "winter",
    useNegativeCmap: false,
    cal_min: 0.0,
    cal_max: 10.0,
  },
};
Object.freeze(INITIAL_STATE);

/**
 * Convert object type while matching mesh overlays to their respective meshes.
 * For example, `lh.wm._81920.disterr.mz3` is identified as a mesh overlay for `lh.wm._81920.mz3`.
 */
function organizeUrlsAsState(
  files: SubjectUrls,
  previous: VisualState,
): VisualState {
  const meshesData = [files.left, files.right].flatMap((side) => {
    return side.surfaces.map((meshUrl) =>
      Mesh.create(meshUrl, side.surfaceOverlays),
    );
  });

  // set the first mesh to be visible
  let selectedCenterName = meshesData ? meshesData[0].centerName : null;
  const meshes = meshesData.map((mesh) =>
    mesh.changeVisible(mesh.centerName == selectedCenterName),
  );

  const volumes = [files.left, files.right].flatMap((side) =>
    side.volumes.map((url) => {
      // set the volume corresponding to the first mesh to be visible
      const opacity =
        selectedCenterName === null || selectedCenterName == centerNameOf(url)
          ? 1.0
          : 0.0;
      return new Volume(url, opacity);
    }),
  );

  const counter = previous.counter + 1;
  const globalMeshOverlaySettings = previous.globalMeshOverlaySettings;
  return { volumes, meshes, counter, globalMeshOverlaySettings };
}

/**
 * @returns the file name part of given URL.
 */
function filenameOfUrl(url: string): string {
  return url.substring(url.lastIndexOf("/") + 1);
}

/**
 * Remove the file extension from a file name.
 */
function filenameWithoutExtension(name: string): string {
  return name.substring(0, name.lastIndexOf("."));
}

export {
  Mesh,
  Volume,
  VisualState,
  INITIAL_STATE,
  MeshOverlaySettings,
  organizeUrlsAsState,
  centerNameOf,
};
