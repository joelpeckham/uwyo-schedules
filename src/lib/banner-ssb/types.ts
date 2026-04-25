export type BannerTerm = { code: string; description?: string };

export type BannerSubject = { code: string; description?: string };

export type SearchResultsRow = Record<string, unknown> & {
  term?: string;
  courseReferenceNumber?: string;
  subject?: string;
  courseNumber?: string;
  linkIdentifier?: string;
  isSectionLinked?: boolean;
};

export type SearchResultsResponse = {
  success: boolean;
  totalCount?: number;
  data: SearchResultsRow[] | null;
};

export type FetchLinkedSectionsResponse = {
  linkedData?: SearchResultsRow[][];
  [key: string]: unknown;
};

export type ScrapePlanChunk = {
  chunkId: string;
  termCode: string;
  subjectCodes: string[];
};

export type ScrapePlan = {
  runId: string;
  origin: string;
  terms: BannerTerm[];
  chunks: ScrapePlanChunk[];
};

/** Blob kinds recorded in `CatalogManifest.blobs`. */
export type CatalogBlobKind =
  | "sections"
  | "linked"
  | "termCatalog";

export type CatalogManifest = {
  schemaVersion: 1;
  runId: string;
  origin: string;
  startedAt: string;
  completedAt?: string;
  terms: { code: string; description?: string }[];
  blobs: { path: string; url: string; kind: CatalogBlobKind | string }[];
  errors?: string[];
};
