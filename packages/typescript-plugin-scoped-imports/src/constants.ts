export const PRIVATE_FOLDER = "__private__";
export const PRIVATE_SEGMENT = `/${PRIVATE_FOLDER}/`;
export const PRIVATE_SEGMENT_START = `/${PRIVATE_FOLDER}`;

const PRIVATE_FOLDER_REGEX = PRIVATE_FOLDER.replace(
  /[.*+?^${}()|[\]\\]/g,
  "\\$&",
);

export const PRIVATE_IMPORT_PATTERN = new RegExp(
  `from\\s+["']([^"']*${PRIVATE_FOLDER_REGEX}[^"']*)["']`,
  "g",
);
