# Story Lifecycle, Evidence Flow & Entity Relationship Architecture
## Parmanu Platform — Phase 2.2: Story Intelligence & Verification Engine

---

### 1. Architectural Overview

Phase 2.2 delivers the story intelligence, deduplication, and evidence verification engine on top of Parmanu's Phase 2.1 data ingestion pipeline. It transforms multiple incoming content records (articles, official gazettes, press releases, voluntary creator posts) into coherent, clustered, traceable stories without losing the original sources or presenting speculation as fact.

---

### 2. Story Cluster Lifecycle Architecture

```mermaid
stateDiagram-v2
    [*] --> DETECTED: First SourceItem observed for event
    DETECTED --> CLUSTERED: 2+ SourceItems attached (confidence >= 0.65)
    DETECTED --> ARCHIVED: Low quality or irrelevant
    
    CLUSTERED --> UNDER_REVIEW: Human editor assigns cluster
    CLUSTERED --> VERIFIED_FOR_PUBLICATION: Automated high-trust verification (Official Government feed)
    CLUSTERED --> ARCHIVED: Duplicate or merged into existing cluster
    
    UNDER_REVIEW --> VERIFIED_FOR_PUBLICATION: Editor confirms evidence and facts
    UNDER_REVIEW --> DISPUTED: Contradicting reports emerge
    UNDER_REVIEW --> CLUSTERED: Editor requests additional corroboration
    UNDER_REVIEW --> ARCHIVED: False alarm or unverified rumour
    
    VERIFIED_FOR_PUBLICATION --> PUBLISHED: Scheduled or immediate public broadcast
    VERIFIED_FOR_PUBLICATION --> UNDER_REVIEW: New contradicting evidence arrives before publish
    
    PUBLISHED --> UPDATED: Developing story updates attached
    PUBLISHED --> DISPUTED: Post-publication contradiction or dispute
    PUBLISHED --> CORRECTED: Publisher issues official correction
    PUBLISHED --> RETRACTED: Publisher withdraws report or proven false
    PUBLISHED --> ARCHIVED: Natural lifecycle expiration
    
    UPDATED --> DISPUTED: Contradicting update arrives
    UPDATED --> CORRECTED: Correction to published update
    UPDATED --> RETRACTED: Retraction
    UPDATED --> ARCHIVED: Archived
    
    DISPUTED --> UNDER_REVIEW: Editorial re-investigation
    DISPUTED --> CORRECTED: Resolution confirms corrected version
    DISPUTED --> RETRACTED: Disputed claim officially retracted
    
    CORRECTED --> UPDATED: Corrected timeline resumes updates
    RETRACTED --> ARCHIVED: Retracted story permanently archived with retraction notice
    ARCHIVED --> [*]
```

---

### 3. Layered Deduplication & Similarity Engine

Incoming records pass through a 5-layer deterministic evaluation against candidate items within a rolling 72-hour event window:

```mermaid
flowchart TD
    In[Incoming SourceItem] --> L1{Layer 1: Exact Match?}
    L1 -- Same sourceId & dedupeHash OR canonicalUrl --> Exact[EXACT_ITEM_DUPLICATE\nConfidence = 1.0\nUpdate lastCheckedAt; do not cluster]
    L1 -- Distinct --> L2{Layer 2 & 3: Lexical Similarity?}
    
    L2 -- "Correction: / Retraction: prefix & Jaccard >= 0.30" --> Corr[CORRECTION_OR_RETRACTION\nConfidence = 0.95\nAttach as UPDATE]
    L2 -- "Jaccard >= 0.85 OR Levenshtein >= 0.88 within 72h" --> Synd[SYNDICATED_COPY\nConfidence = 0.85-0.98\nAttach as CORROBORATING; Flag Syndicated]
    L2 -- "Same source + Update marker + Jaccard >= 0.30 within 48h" --> Upd[STORY_UPDATE\nConfidence = 0.85\nAttach as UPDATE]
    L2 -- "Jaccard 0.45 - 0.84 within 72h" --> Event[SAME_EVENT_COVERAGE\nConfidence = 0.65-0.89\nAttach as CORROBORATING]
    
    L2 -- "Jaccard >= 0.20 but timeDiff > 72h" --> DiffEvent[SAME_ENTITY_DIFFERENT_EVENT\nConfidence = 0.35\nDo NOT cluster; create separate cluster]
    L2 -- "Jaccard < 0.20" --> Distinct[DISTINCT\nConfidence < 0.20\nCreate new StoryCluster with status DETECTED]
```

---

### 4. Evidence Verification & Non-Syndication Rules

Parmanu enforces strict evidentiary rules before upgrading a story's status:

```mermaid
flowchart TD
    EvidenceList[Attached Claim Evidence Records] --> CheckContradiction{"Any stance == CONTRADICTS?"}
    CheckContradiction -- Yes --> DisputedState[Status = DISPUTED\nPropagate DISPUTED to StoryCluster]
    CheckContradiction -- No --> CheckOfficial{"Any stance == SUPPORTS from\nGovernment Feed or Official Creator OAuth?"}
    
    CheckOfficial -- Yes --> OfficialState[Status = OFFICIALLY_CONFIRMED]
    CheckOfficial -- No --> FilterSupporting["Filter stance == SUPPORTS\nFilter sourceIndependence == INDEPENDENT"]
    
    FilterSupporting --> CountIndependent{"Count of independent sources >= 2?"}
    CountIndependent -- Yes --> MultiSource[Status = MULTIPLE_SOURCES\nIndependent multi-desk corroboration]
    CountIndependent -- No --> CountSingle{"Count of supporting sources >= 1?"}
    
    CountSingle -- Yes --> SingleSource[Status = SINGLE_SOURCE\nNote: Syndicated reprints do NOT count as multiple sources]
    CountSingle -- No --> Unassessed[Status = UNASSESSED]
```

#### Core Evidence Rules:
1. **The Syndication Rule**: Multiple news websites repeating the exact same wire report (e.g. PTI wire syndicated to 5 news portals) do **not** constitute independent corroboration. They are recorded with `sourceIndependence: SYNDICATED` and count as a single primary source.
2. **The Official Confirmation Rule**: Only primary statements issued directly through verified Government portals (`.gov.in`, `rbi.org.in`) or an authenticated creator's own voluntary OAuth account can confer `OFFICIALLY_CONFIRMED` status.
3. **The Contradiction Gate**: Any credible contradicting statement immediately transitions the claim and its parent cluster to `DISPUTED` for editorial adjudication.

---

### 5. Entity Resolution & Collaboration Graph

```mermaid
erDiagram
    EntityRegistry ||--o{ EntityToStoryCluster : references
    StoryCluster ||--o{ EntityToStoryCluster : links
    EntityRegistry ||--o{ EntityRelationship : "source"
    EntityRegistry ||--o{ EntityRelationship : "target"
    StoryCluster ||--o{ StoryClusterItem : contains
    SourceItem ||--o{ StoryClusterItem : attached_to
    StoryCluster ||--o{ StoryClaim : asserts
    StoryClaim ||--o{ ClaimEvidence : verified_by
    SourceItem ||--o{ ClaimEvidence : grounds

    EntityRegistry {
        string id PK
        string canonicalName
        string slug UK
        string entityType
        string[] aliases
        boolean isVerified
    }

    EntityRelationship {
        string id PK
        string sourceEntityId FK
        string targetEntityId FK
        string relationshipType
        string status
        float confidence
    }

    StoryCluster {
        string id PK
        string clusterSlug UK
        string primaryHeadline
        string status
        float confidenceScore
        datetime firstObservedAt
        datetime lastObservedAt
    }
```

#### Collaboration Truthfulness Guarantees:
- **No Unsubstantiated Upgrades**: Rumored relationships (`RUMORED_RELATIONSHIP`) can never be initialized or upgraded to `CONFIRMED` without direct evidence from an official brand press release or creator disclosure.
- **Anti-Conflation Guarantee**: Two individuals or brands sharing a common name or alias are never automatically merged into a single entity without explicit admin review.
