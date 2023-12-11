import Papa from "papaparse";
import {
  VOLUME_FILE_EXTENSIONS,
  SURFACE_OVERLAY_RE,
  SURFACE_FILE_EXTENSION,
  SUBJECT_COLUMN_NAMES,
} from "./recognize";
const ACCEPT_JSON = {
  headers: {
    Accept: "application/json",
  },
};

type HemiUrls = {
  volumes: string[];
  surfaces: string[];
  surfaceOverlays: string[];
  other: string[];
};

type SubjectUrls = {
  left: HemiUrls;
  right: HemiUrls;
};

type Subject = {
  name: string;
  info?: any;
  age?: number;
};

/**
 * An entry returned by Caddy's file browser.
 */
type CaddyEntry = {
  name: string;
  size: number;
  url: string;
  mod_time: string;
  mode: number;
  is_dir: boolean;
  is_symlink: boolean;
};

/**
 * A client for getting data from the `all_niftiandmz3` output directory from the
 * snakemake pipeline.
 */
class Client {
  public baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * List subjects. If a CSV of subject information is available, then the subject information is
   * combined with the subject directories available.
   */
  async lsSubjects(): Promise<Subject[]> {
    const res = await fetch(this.baseUrl, ACCEPT_JSON);
    const data: CaddyEntry[] = await res.json();
    const subjectNames = data
      .filter((entry) => entry.is_dir)
      .map((entry) => entry.name)
      .map(trimTrailingSlash);
    const csvFileName = data
      .filter((entry) => !entry.is_dir)
      .map((entry) => entry.name)
      .find((name) => name.endsWith(".csv"));
    if (csvFileName === undefined) {
      return subjectNames.map((name) => {
        return { name };
      });
    }
    const csvData = await fetchCsv(this.baseUrl + csvFileName);
    csvData.forEach(mutNormalizeCsvData);

    return subjectNames
      .map((name) => {
        const info = csvData.find(
          (row) => row.subject && row.subject.trim() === name,
        );
        if (info === undefined) {
          return { name };
        }
        return { name, info, age: info.age };
      })
      .sort(subjectSortComparer);
  }

  /**
   * List all the files (volumes, surfaces, surface overlay data) for a subject.
   */
  async getFiles(subject: string): Promise<SubjectUrls> {
    const url = this.baseUrl + subject;
    const res = await fetch(url, ACCEPT_JSON);
    const data: CaddyEntry[] = await res.json();
    const fileNames: string[] = data
      .filter((entry) => !entry.is_dir)
      .map((entry) => entry.name);
    const fileNamesLeft = fileNames.filter((name) => name.startsWith("lh."));
    const fileNamesRight = fileNames.filter((name) => name.startsWith("rh."));
    return {
      left: classifyFileNamesAsUrls(fileNamesLeft, this.baseUrl, subject),
      right: classifyFileNamesAsUrls(fileNamesRight, this.baseUrl, subject),
    };
  }
}

async function fetchCsv(url: string): Promise<any[]> {
  const csvRes = await fetch(url);
  const csvString = await csvRes.text();
  const parseResult = Papa.parse(csvString.trimEnd(), { header: true });
  if (parseResult.errors.length > 0) {
    console.error(`Failed to parse CSV from ${url}`);
    console.dir(parseResult.errors);
    throw Error(parseResult.errors);
  }
  return parseResult.data;
}

/**
 * Mutates the object in the following ways:
 *
 * - if "age" can be parsed as float, do so, and rename the key to lowercase.
 * - if "subject" is not a key, then create a value for it based on the value from other columns.
 */
function mutNormalizeCsvData(data: any): any {
  const ageKey = Object.keys(data).find((k) => k.toLowerCase() === "age");
  const ageAsFloat = parseFloat(data[ageKey]);
  if (!Number.isNaN(ageAsFloat)) {
    data.age = ageAsFloat;
    if (ageKey !== "age") {
      delete data[ageKey];
    }
  }

  const subjectKey = Object.keys(data).find(
    (k) => k.toLowerCase() === "subject",
  );
  if (subjectKey) {
    if (subjectKey !== "subject") {
      data.subject = data[subjectKey];
      delete data[subjectKey];
    }
    return;
  }

  for (const columnName of SUBJECT_COLUMN_NAMES) {
    if (data[columnName]) {
      data.subject = data[columnName];
      break;
    }
  }
}

function trimTrailingSlash(name: string): string {
  if (name.endsWith("/")) {
    return name.substring(0, name.length - 1);
  }
  return name;
}

function classifyFileNamesAsUrls(
  fileNames: string[],
  baseUrl: string,
  subject: string,
) {
  return addUrlToFileNames(classifyFileNames(fileNames), baseUrl, subject);
}

function classifyFileNames(fileNames: string[]): HemiUrls {
  const urls: HemiUrls = {
    surfaces: [],
    volumes: [],
    surfaceOverlays: [],
    other: [],
  };
  fileNames.forEach((fileName) => {
    const matchesFileExtension = (ext) => fileName.endsWith(ext);
    if (VOLUME_FILE_EXTENSIONS.some(matchesFileExtension)) {
      urls.volumes.push(fileName);
    } else if (fileName.match(SURFACE_OVERLAY_RE)) {
      urls.surfaceOverlays.push(fileName);
    } else if (SURFACE_FILE_EXTENSION.some(matchesFileExtension)) {
      urls.surfaces.push(fileName);
    } else {
      urls.other.push(fileName);
    }
  });
  return urls;
}

function addUrlToFileNames(
  names: HemiUrls,
  baseUrl: string,
  subject: string,
): HemiUrls {
  const createUrl = (name) => `${baseUrl + subject}/${name}`;
  return {
    volumes: names.volumes.map(createUrl),
    surfaces: names.surfaces.map(createUrl),
    surfaceOverlays: names.surfaceOverlays.map(createUrl),
    other: names.other.map(createUrl),
  };
}

/**
 * Helper function for sorting subjects by age.
 */
function subjectSortComparer(a: Subject, b: Subject): number {
  if (typeof a.age === "number") {
    if (typeof b.age === "number") {
      // same age
      if (a.age === b.age) {
        return a.name.localeCompare(b.name);
      }
      // different age
      return a.age - b.age;
    } else {
      // b age unknown
      return 1;
    }
  }
  // a age unknown
  if (b.info && b.age > 0) {
    return -1;
  }
  // both age unknown
  return a.name.localeCompare(b.name);
}

export { HemiUrls, SubjectUrls, Subject, Client };
