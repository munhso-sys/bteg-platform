export type ReviewFindingType =
  | "difference"
  | "contradiction"
  | "conflict"
  | "missing_requirement"
  | "duplicate";

export type ReviewSeverity = "high" | "medium" | "low";

export type ExtractedPage = {
  page: number | null;
  text: string;
};

export type ExtractedDocument = {
  id: string;
  name: string;
  mimeType: string;
  pages: ExtractedPage[];
  characterCount: number;
  warnings: string[];
};

export type ReviewChunk = {
  id: string;
  documentId: string;
  documentName: string;
  index: number;
  page: number | null;
  section: string | null;
  text: string;
};

export type ReviewCitation = {
  documentId: string;
  documentName: string;
  chunkId: string;
  page: number | null;
  section: string | null;
  quote: string;
  supported: boolean;
};

export type ReviewFinding = {
  id: string;
  type: ReviewFindingType;
  severity: ReviewSeverity;
  title: string;
  summary: string;
  rationale: string;
  supported: boolean;
  citations: ReviewCitation[];
};

export type PolicyReviewResult = {
  id: string;
  generatedAt: string;
  mode: "openai" | "local";
  documents: Array<{
    id: string;
    name: string;
    mimeType: string;
    pageCount: number;
    characterCount: number;
    chunkCount: number;
  }>;
  findings: ReviewFinding[];
  warnings: string[];
  stats: {
    comparedPairs: number;
    supportedFindings: number;
    unsupportedFindings: number;
    totalChunks: number;
    highRiskFindings: number;
    contradictions: number;
    conflicts: number;
    missingRequirements: number;
    duplicates: number;
    citationCoveragePct: number;
  };
};

export type PolicyOrganization = {
  type: "heltes" | "alba";
  id: string;
  name: string;
  heltesId: string | null;
  heltesName: string | null;
};

export type StoredPolicySummary = {
  id: string;
  name: string;
  referenceCode: string | null;
  status: string | null;
  clauseCount: number | null;
  organizations: PolicyOrganization[];
  organizationScope: "assigned" | "all" | "unassigned";
};

export type PolicyReviewChatCitation = {
  documentName: string;
  page: number | null;
  section: string | null;
  quote: string;
  supported: boolean;
};

export type PolicyReviewChatMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: PolicyReviewChatCitation[];
  supported?: boolean;
};
