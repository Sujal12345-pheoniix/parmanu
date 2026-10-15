import { calculateDedupeHash } from '../connectors/base.connector';
import { defaultNormalizationService, NormalizationService } from './normalization.service';

export enum DeduplicationMatchCategory {
  EXACT_ITEM_DUPLICATE = 'EXACT_ITEM_DUPLICATE',
  SYNDICATED_COPY = 'SYNDICATED_COPY',
  SAME_EVENT_COVERAGE = 'SAME_EVENT_COVERAGE',
  SAME_ENTITY_DIFFERENT_EVENT = 'SAME_ENTITY_DIFFERENT_EVENT',
  STORY_UPDATE = 'STORY_UPDATE',
  CORRECTION_OR_RETRACTION = 'CORRECTION_OR_RETRACTION',
  DISTINCT = 'DISTINCT',
}

export interface DuplicateEvaluationResult {
  category: DeduplicationMatchCategory;
  confidence: number;
  matchReason: string;
  isDuplicate: boolean;
  shouldCluster: boolean;
  matchedFields: string[];
}

export interface CandidateItem {
  id: string;
  sourceId: string;
  canonicalUrl: string;
  headline: string;
  excerpt?: string | null;
  publishedAt: Date;
  author?: string | null;
  category?: string[];
}

/**
 * Tokenizes text into lowercase normalized words, filtering out common stopwords
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'by',
  'with', 'is', 'are', 'was', 'were', 'it', 'its', 'from', 'as', 'that',
  'this', 'these', 'those', 'has', 'have', 'had', 'be', 'been', 'will', 'new'
]);

export function tokenizeText(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Calculates Jaccard similarity coefficient between two sets of tokens
 */
export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }
  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Computes Levenshtein edit distance ratio between two strings (0.0 to 1.0)
 */
export function calculateLevenshteinRatio(s1: string, s2: string): number {
  const longer = s1.length >= s2.length ? s1 : s2;
  const shorter = s1.length < s2.length ? s1 : s2;

  if (longer.length === 0) return 1.0;

  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }

  return (longer.length - costs[shorter.length]) / longer.length;
}

export class DeduplicationService {
  constructor(private normalizationService: NormalizationService = defaultNormalizationService) {}

  /**
   * Layered duplicate evaluation comparing an incoming item against an existing candidate
   */
  public evaluatePair(itemA: CandidateItem, itemB: CandidateItem): DuplicateEvaluationResult {
    // Layer 1: Exact Hash / URL Match
    const hashA = calculateDedupeHash(itemA.sourceId, itemA.headline);
    const hashB = calculateDedupeHash(itemB.sourceId, itemB.headline);
    const canonA = this.normalizationService.canonicalizeUrl(itemA.canonicalUrl).canonicalUrl;
    const canonB = this.normalizationService.canonicalizeUrl(itemB.canonicalUrl).canonicalUrl;

    if (hashA === hashB || (canonA === canonB && itemA.sourceId === itemB.sourceId)) {
      return {
        category: DeduplicationMatchCategory.EXACT_ITEM_DUPLICATE,
        confidence: 1.0,
        matchReason: 'Exact cryptographic dedupe hash or canonical URL match from same source',
        isDuplicate: true,
        shouldCluster: false,
        matchedFields: ['dedupeHash', 'canonicalUrl'],
      };
    }

    // Check for explicit Correction or Retraction markers
    const isCorrectionOrRetraction =
      /^(?:correction|clarification|update|retracted|withdrawn)\s*:/i.test(itemA.headline) ||
      /^(?:correction|clarification|update|retracted|withdrawn)\s*:/i.test(itemB.headline);

    // Layer 2 & 3: Token Jaccard and Levenshtein Similarity
    const tokensA = tokenizeText(itemA.headline);
    const tokensB = tokenizeText(itemB.headline);
    const jaccardScore = calculateJaccardSimilarity(tokensA, tokensB);

    const normHeadA = this.normalizationService.normalizeText(itemA.headline).toLowerCase();
    const normHeadB = this.normalizationService.normalizeText(itemB.headline).toLowerCase();
    const levenshteinScore = calculateLevenshteinRatio(normHeadA, normHeadB);

    // Time window difference in hours
    const timeDiffHours = Math.abs(itemA.publishedAt.getTime() - itemB.publishedAt.getTime()) / (1000 * 60 * 60);

    // Detection: Explicit Correction or Retraction (e.g. "Correction: ...", "Clarification: ...")
    if (isCorrectionOrRetraction && (jaccardScore >= 0.30 || levenshteinScore >= 0.40) && timeDiffHours <= 72) {
      return {
        category: DeduplicationMatchCategory.CORRECTION_OR_RETRACTION,
        confidence: 0.95,
        matchReason: 'Overlapping event topic with explicit correction or retraction prefix',
        isDuplicate: false,
        shouldCluster: true,
        matchedFields: ['headline', 'timeDiffHours'],
      };
    }

    // Detection: Story Update (Same source or wire, developing headline with update/live marker)
    const hasUpdateMarker =
      normHeadA.includes('update') || normHeadB.includes('update') ||
      normHeadA.includes('live') || normHeadB.includes('live') ||
      normHeadA.includes('developing') || normHeadB.includes('developing');

    if (
      itemA.sourceId === itemB.sourceId &&
      (jaccardScore >= 0.30 || levenshteinScore >= 0.45) &&
      timeDiffHours <= 48 &&
      hasUpdateMarker
    ) {
      return {
        category: DeduplicationMatchCategory.STORY_UPDATE,
        confidence: 0.85,
        matchReason: 'Developing live update sequence from same publisher',
        isDuplicate: false,
        shouldCluster: true,
        matchedFields: ['sourceId', 'headline', 'timeWindow'],
      };
    }

    // Detection: Syndicated Wire Copy (High title similarity across different sources)
    if ((jaccardScore >= 0.85 || levenshteinScore >= 0.88) && timeDiffHours <= 72) {
      return {
        category: DeduplicationMatchCategory.SYNDICATED_COPY,
        confidence: Math.max(jaccardScore, levenshteinScore),
        matchReason: `High lexical similarity (${(Math.max(jaccardScore, levenshteinScore) * 100).toFixed(1)}%) published within 72 hours across different publishers`,
        isDuplicate: true, // Known syndication
        shouldCluster: true,
        matchedFields: ['headline', 'tokens'],
      };
    }

    // Detection: Same Event Coverage (Different journalists, overlapping key entities, within 48-hour window)
    if (jaccardScore >= 0.45 && timeDiffHours <= 72) {
      return {
        category: DeduplicationMatchCategory.SAME_EVENT_COVERAGE,
        confidence: Number((0.65 + jaccardScore * 0.3).toFixed(2)),
        matchReason: `Overlapping event vocabulary (Jaccard: ${(jaccardScore * 100).toFixed(1)}%) within ${Math.round(timeDiffHours)}h event window`,
        isDuplicate: false,
        shouldCluster: true,
        matchedFields: ['tokens', 'timeDiffHours'],
      };
    }

    // Detection: Same Entity, Different Event (low token overlap or wide temporal distance)
    if (jaccardScore >= 0.20 && timeDiffHours > 72) {
      return {
        category: DeduplicationMatchCategory.SAME_ENTITY_DIFFERENT_EVENT,
        confidence: 0.35,
        matchReason: 'Shared vocabulary/entities but outside the active event clustering window (>72h)',
        isDuplicate: false,
        shouldCluster: false,
        matchedFields: ['tokens'],
      };
    }

    return {
      category: DeduplicationMatchCategory.DISTINCT,
      confidence: 0.05,
      matchReason: 'Distinct events with insufficient lexical or temporal overlap',
      isDuplicate: false,
      shouldCluster: false,
      matchedFields: [],
    };
  }
}

export const defaultDeduplicationService = new DeduplicationService();
