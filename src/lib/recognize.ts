// File extensions and regexes to match file types

const VOLUME_FILE_EXTENSIONS = [".nii", ".nii.gz"];
const SURFACE_OVERLAY_RE = /.+\.(disterr|smtherr|tlink_\d+mm)(\.abs)?\.mz3/;
const SURFACE_FILE_EXTENSION = [".mz3"];

// Column names used by Marisol to indicate subject name, in order of precedence.
const SUBJECT_COLUMN_NAMES = ["BCH_number", "Anon_number", "MRN"];

export {
  VOLUME_FILE_EXTENSIONS,
  SURFACE_OVERLAY_RE,
  SURFACE_FILE_EXTENSION,
  SUBJECT_COLUMN_NAMES,
};
