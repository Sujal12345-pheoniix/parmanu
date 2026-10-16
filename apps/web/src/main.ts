/**
 * Parmanu Consumer Platform — Client Engine
 * Phase 3.1: Connects consumer discovery screens, hero deep dive, dossiers, search, and bookmarks to live APIs.
 */

import {
  ParmanuApiClient,
  StoryClusterDetail,
  CategorySummary,
  SearchResultData,
  BookmarkRecord,
} from './api/client';

// Global State
let currentCategory = 'all';
let currentStoryClusterId: string | null = null;
let activeDossierData: StoryClusterDetail | null = null;
let currentUser: any | null = null;
let searchDebounceTimer: any = null;

// DOM Utilities
function showToast(message: string, duration = 3000): void {
  let toastContainer = document.getElementById('parmanu-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'parmanu-toast-container';
    toastContainer.className = 'fixed bottom-20 md:bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className =
    'bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto';
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[16px] text-secondary">info</span>
    <span>${escapeHtml(message)}</span>
  `;

  toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

// ─── INITIALIZATION & ROUTING ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Parmanu] Initializing Phase 3.1 Consumer Platform...');

  setupModalsAndBackdrops();
  setupSearchModal();
  setupBookmarksDrawer();
  setupGlobalActions();
  setupUrlSync();

  // Load user session
  currentUser = await ParmanuApiClient.getCurrentUser();
  updateAuthUI();

  // Load dynamic data
  await Promise.all([
    loadCategories(),
    loadFeaturedHero(),
    loadTrendingStories(),
    loadDispatchFeed(),
  ]);

  // Check URL query parameters for deep-linking
  const params = new URLSearchParams(window.location.search);
  const storyParam = params.get('story');
  const catParam = params.get('category');
  if (catParam) {
    selectCategory(catParam, false);
  }
  if (storyParam) {
    openDossierModal(storyParam);
  }
});

function setupUrlSync(): void {
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const storyParam = params.get('story');
    const catParam = params.get('category') || 'all';

    selectCategory(catParam, false);

    if (storyParam) {
      openDossierModal(storyParam, false);
    } else {
      closeAllModals(false);
    }
  });
}

function updateUrl(params: { category?: string; story?: string | null }): void {
  const url = new URL(window.location.href);
  if (params.category !== undefined) {
    if (params.category === 'all') {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', params.category);
    }
  }
  if (params.story !== undefined) {
    if (!params.story) {
      url.searchParams.delete('story');
    } else {
      url.searchParams.set('story', params.story);
    }
  }
  window.history.pushState({}, '', url.toString());
}

// ─── AUTHENTICATION UI ────────────────────────────────────────────────

function updateAuthUI(): void {
  const authContainer = document.getElementById('user-auth-badge');
  if (!authContainer) return;

  if (currentUser) {
    authContainer.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-on-surface truncate max-w-[120px]">${escapeHtml(currentUser.fullName || currentUser.email)}</span>
        <button id="btn-logout" class="text-xs text-error hover:underline font-bold">Logout</button>
      </div>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      ParmanuApiClient.clearToken();
      currentUser = null;
      updateAuthUI();
      showToast('Logged out successfully');
    });
  }
}

// ─── CATEGORIES & PILLS ────────────────────────────────────────────────

async function loadCategories(): Promise<void> {
  const container = document.getElementById('category-pills');
  if (!container) return;

  const categories = await ParmanuApiClient.fetchCategories();
  if (categories.length === 0) return;

  const currentSelection = currentCategory.toLowerCase();

  let html = `
    <button class="category-pill px-4 py-1.5 rounded-full ${
      currentSelection === 'all'
        ? 'bg-primary text-on-primary shadow-sm'
        : 'bg-surface-container text-on-surface hover:bg-surface-variant'
    } text-xs font-bold shrink-0 transition-all active:scale-95" type="button" data-category="all">
      All Fields
    </button>
  `;

  categories.forEach((cat: CategorySummary) => {
    const isSelected = currentSelection === cat.slug;
    html += `
      <button class="category-pill px-4 py-1.5 rounded-full ${
        isSelected
          ? 'bg-primary text-on-primary shadow-sm'
          : 'bg-surface-container text-on-surface hover:bg-surface-variant'
      } text-xs font-medium shrink-0 transition-all active:scale-95" type="button" data-category="${escapeHtml(cat.slug)}">
        ${escapeHtml(cat.name)} <span class="opacity-70 text-[11px]">(${cat.count})</span>
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.category-pill').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const cat = target.getAttribute('data-category') || 'all';
      selectCategory(cat);
    });
  });
}

function selectCategory(categorySlug: string, updateHistory = true): void {
  currentCategory = categorySlug;

  document.querySelectorAll('.category-pill').forEach((p) => {
    const pill = p as HTMLElement;
    const cat = pill.getAttribute('data-category');
    if (cat === currentCategory) {
      pill.classList.remove('bg-surface-container', 'text-on-surface');
      pill.classList.add('bg-primary', 'text-on-primary', 'shadow-sm');
    } else {
      pill.classList.remove('bg-primary', 'text-on-primary', 'shadow-sm');
      pill.classList.add('bg-surface-container', 'text-on-surface');
    }
  });

  if (updateHistory) {
    updateUrl({ category: currentCategory });
  }

  loadDispatchFeed();
}

// ─── HERO ARTICLE ─────────────────────────────────────────────────────

async function loadFeaturedHero(): Promise<void> {
  const featured = await ParmanuApiClient.fetchFeaturedStory();
  if (!featured) return;

  const heroSection = document.querySelector('article.bg-surface-container-lowest');
  if (!heroSection) return;

  const headlineEl = heroSection.querySelector('h1.font-headline');
  const summaryEl = heroSection.querySelector('p.text-sm');
  const veracityEl = heroSection.querySelector('.bg-surface-container-low .text-xs.text-on-surface-variant');
  const badgeEl = heroSection.querySelector('.absolute.top-4.left-4');
  const bookmarkBtn = heroSection.querySelector('button[aria-label="Bookmark story"]');
  const shareBtn = heroSection.querySelector('button[aria-label="Share story"]');
  const dossierBtn = heroSection.querySelector('button.bg-primary');

  if (headlineEl) headlineEl.textContent = featured.primaryHeadline;
  if (summaryEl) summaryEl.textContent = featured.summary || 'Corroborated intelligence report.';

  if (veracityEl) {
    const sourceCount = featured.items?.length || 1;
    veracityEl.textContent = `Grounded in ${sourceCount} verified source record(s). Triangulated confidence score: ${Math.round(
      featured.confidenceScore * 100
    )}%.`;
  }

  if (badgeEl) {
    badgeEl.innerHTML = `
      <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-secondary text-xs font-bold shadow-sm">
        <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
        ${escapeHtml(featured.status)}
      </span>
      <span class="inline-flex items-center px-2.5 py-1 rounded-full bg-inverse-surface/80 text-inverse-on-surface font-code text-xs">
        ${featured.itemCount} Sources Verified
      </span>
    `;
  }

  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleBookmarkAction(featured.id, bookmarkBtn as HTMLElement);
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleShare(featured.primaryHeadline);
    });
  }

  if (dossierBtn) {
    dossierBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDossierModal(featured.id);
    });
  }
}

// ─── TRENDING STORIES & SIDEBAR ───────────────────────────────────────

async function loadTrendingStories(): Promise<void> {
  const trending = await ParmanuApiClient.fetchTrendingStories(undefined, 4);
  if (trending.length === 0) return;

  const breakingAlert = document.querySelector('.bg-primary\\/5');
  if (breakingAlert && trending[0]) {
    const top = trending[0];
    const p = breakingAlert.querySelector('p');
    const sourceBadge = breakingAlert.querySelector('.bg-primary\\/10');
    const viewTraceBtn = breakingAlert.querySelector('button');

    if (p) p.textContent = top.primaryHeadline;
    if (sourceBadge) {
      sourceBadge.innerHTML = `
        <span class="material-symbols-outlined text-[13px]">layers</span>
        ${top.itemCount} Sources
      `;
    }
    if (viewTraceBtn) {
      viewTraceBtn.onclick = (e) => {
        e.stopPropagation();
        openDossierModal(top.id);
      };
    }
  }
}

// ─── VERIFIED DISPATCH FEED ───────────────────────────────────────────

async function loadDispatchFeed(): Promise<void> {
  const container = document.getElementById('live-ingested-feed-container');
  if (!container) return;

  container.innerHTML = `
    <div class="py-8 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs font-semibold">Retrieving verified dispatches...</span>
    </div>
  `;

  const { clusters } = await ParmanuApiClient.fetchStoryClusters({
    category: currentCategory === 'all' ? undefined : currentCategory,
    limit: 20,
  });

  if (clusters.length === 0) {
    container.innerHTML = `
      <div class="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-secondary text-4xl">folder_open</span>
        <h4 class="text-base font-bold text-on-surface">No verified stories in this category yet</h4>
        <p class="text-xs text-on-surface-variant max-w-sm">Our ingestion engine monitors incoming feeds 24/7. Switch category or check back shortly.</p>
        <button class="px-4 py-2 bg-surface-container rounded-full text-xs font-bold text-primary hover:bg-surface-variant" onclick="window.parmanu.selectCategory('all')">
          View All Fields
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  clusters.forEach((story: StoryClusterDetail) => {
    const card = document.createElement('article');
    card.className =
      'bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3 border border-surface-container hover:shadow-md transition-shadow cursor-pointer';

    const sourceName = story.items?.[0]?.sourceItem?.source?.name || 'Verified Source';
    const sourceUrl = story.items?.[0]?.sourceItem?.canonicalUrl || '#';
    const categories = Array.isArray(story.category) ? story.category.join(' • ') : 'News';
    const relativeTime = formatRelativeTime(story.publishedAt || story.lastObservedAt);

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
          <span class="material-symbols-outlined text-[13px]" style="font-variation-settings: 'FILL' 1;">verified</span>
          Verified • ${escapeHtml(sourceName)}
        </span>
        <span class="font-code text-xs text-on-surface-variant">${relativeTime}</span>
      </div>
      <div class="flex flex-col gap-1 min-w-0">
        <span class="text-xs text-primary font-bold uppercase tracking-wider">${escapeHtml(categories)}</span>
        <h4 class="text-base sm:text-lg font-bold text-on-surface leading-snug hover:text-primary transition-colors">
          ${escapeHtml(story.primaryHeadline)}
        </h4>
        <p class="text-xs sm:text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
          ${escapeHtml(story.summary || 'Corroborated intelligence report triangulated from multiple reporting endpoints.')}
        </p>
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-surface-container text-xs text-on-surface-variant">
        <span class="font-code text-on-surface-variant flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px] text-secondary">layers</span>
          ${story.itemCount} Sources Corroborated
        </span>
        <div class="flex items-center gap-2">
          <button class="btn-card-save p-1 rounded-full text-on-surface-variant hover:text-primary active:scale-90 transition-transform" data-id="${escapeHtml(
            story.id
          )}" title="Save bookmark">
            <span class="material-symbols-outlined text-[18px]">bookmark</span>
          </button>
          <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="text-primary font-bold flex items-center gap-0.5 hover:underline" onclick="event.stopPropagation()">
            Read Source <span class="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      openDossierModal(story.id);
    });

    const cardSaveBtn = card.querySelector('.btn-card-save') as HTMLElement;
    cardSaveBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleBookmarkAction(story.id, cardSaveBtn);
    });

    container.appendChild(card);
  });
}

// ─── DOSSIER MODAL (STORY DETAIL) ─────────────────────────────────────

async function openDossierModal(clusterId: string, updateHistory = true): Promise<void> {
  const modal = document.getElementById('dossier-main');
  const backdrop = document.getElementById('global-backdrop');
  if (!modal || !backdrop) return;

  currentStoryClusterId = clusterId;
  closeAllModals(false);

  // Set modal in loading state
  modal.classList.remove('translate-y-full', 'pointer-events-none');
  modal.classList.add('translate-y-0', 'pointer-events-auto', 'md:opacity-100', 'md:scale-100');
  backdrop.classList.remove('hidden');

  if (updateHistory) {
    updateUrl({ story: clusterId });
  }

  const contentArea = modal.querySelector('.p-5.overflow-y-auto');
  const titleEl = modal.querySelector('h3.font-headline');

  if (titleEl) titleEl.textContent = 'Loading Evidence Dossier...';
  if (contentArea) {
    contentArea.innerHTML = `
      <div class="py-12 text-center flex flex-col items-center justify-center gap-3 text-on-surface-variant">
        <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs font-semibold">Compiling provenance chain and factual corroborations...</span>
      </div>
    `;
  }

  const detail = await ParmanuApiClient.fetchStoryDetail(clusterId);
  if (!detail) {
    if (contentArea) {
      contentArea.innerHTML = `
        <div class="text-center py-8 flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-error text-3xl">error_outline</span>
          <p class="text-sm font-bold text-on-surface">Unable to retrieve story dossier</p>
          <p class="text-xs text-on-surface-variant">The requested dossier might be under editorial review or archived.</p>
        </div>
      `;
    }
    return;
  }

  activeDossierData = detail;
  renderDossierDetail(modal, detail);
}

function renderDossierDetail(modal: HTMLElement, detail: StoryClusterDetail): void {
  const titleEl = modal.querySelector('h3.font-headline');
  const contentArea = modal.querySelector('.p-5.overflow-y-auto');

  if (titleEl) {
    titleEl.textContent = `Dossier: ${detail.primaryHeadline.substring(0, 45)}...`;
  }

  if (!contentArea) return;

  const isOfficiallyConfirmed =
    detail.status === 'PUBLISHED' || detail.status === 'UPDATED';
  const confidencePercent = Math.round((detail.confidenceScore || 0.5) * 100);

  // Render claims section
  let claimsHtml = '';
  if (detail.claims && detail.claims.length > 0) {
    claimsHtml = `
      <div class="flex flex-col gap-2">
        <span class="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px] text-primary">fact_check</span>
          Factual Claims &amp; Verification Stance
        </span>
        <div class="flex flex-col gap-2">
          ${detail.claims
            .map(
              (claim) => `
            <div class="p-3 bg-surface-container rounded-xl flex flex-col gap-1.5 border border-surface-container-high">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-primary">${escapeHtml(claim.claimType)}</span>
                <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-secondary-fixed text-on-secondary-fixed">
                  ${escapeHtml(claim.verificationStatus)}
                </span>
              </div>
              <p class="text-xs text-on-surface font-medium leading-snug">${escapeHtml(claim.claimText)}</p>
              ${
                claim.evidenceRecords && claim.evidenceRecords.length > 0
                  ? `<div class="pt-1 text-[11px] text-on-surface-variant flex flex-col gap-0.5">
                      ${claim.evidenceRecords
                        .map(
                          (ev) =>
                            `<span class="flex items-center gap-1">
                              <span class="material-symbols-outlined text-[12px] text-secondary">check</span>
                              ${escapeHtml(ev.sourceItem?.source?.name || 'Publisher')}: <em>"${escapeHtml(
                              ev.quoteExcerpt || 'Corroborating record'
                            )}"</em>
                            </span>`
                        )
                        .join('')}
                    </div>`
                  : ''
              }
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  // Render primary sources
  const sourcesHtml = (detail.items || [])
    .map(
      (item) => `
      <div class="p-3 bg-surface-container rounded-xl flex items-start justify-between gap-2 hover:bg-surface-container-high transition-colors">
        <div class="flex items-start gap-2 min-w-0">
          <span class="material-symbols-outlined text-primary text-[20px] mt-0.5">description</span>
          <div class="flex flex-col min-w-0">
            <a href="${escapeHtml(
              item.sourceItem?.canonicalUrl || '#'
            )}" target="_blank" rel="noopener noreferrer" class="text-xs font-bold text-on-surface truncate hover:text-primary hover:underline">
              ${escapeHtml(item.sourceItem?.headline || 'Attributed source')}
            </a>
            <span class="font-code text-[11px] text-on-surface-variant">
              ${escapeHtml(item.sourceItem?.source?.name || 'Publisher')} • ${formatRelativeTime(
        item.sourceItem?.publishedAt || ''
      )}
            </span>
          </div>
        </div>
        <a href="${escapeHtml(
          item.sourceItem?.canonicalUrl || '#'
        )}" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary/80">
          <span class="material-symbols-outlined text-[18px]">open_in_new</span>
        </a>
      </div>
    `
    )
    .join('');

  // Render correction notice if applicable
  const correctionHtml = detail.correctionNotes
    ? `
      <div class="p-3 bg-secondary-fixed/20 border border-secondary rounded-xl flex items-start gap-2">
        <span class="material-symbols-outlined text-secondary text-[20px]">info</span>
        <div class="flex flex-col gap-0.5">
          <span class="text-xs font-bold text-on-surface">Official Editorial Note / Correction</span>
          <p class="text-xs text-on-surface-variant leading-relaxed">${escapeHtml(detail.correctionNotes)}</p>
        </div>
      </div>
    `
    : '';

  contentArea.innerHTML = `
    <div class="p-3.5 bg-surface-container-low rounded-xl flex items-center justify-between border border-surface-container">
      <div>
        <span class="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Integrity Verdict</span>
        <span class="text-sm text-secondary font-bold">${
          isOfficiallyConfirmed
            ? 'Officially Confirmed &amp; Triangulated'
            : 'In Review / Emerging Story'
        }</span>
      </div>
      <span class="font-code text-xs bg-surface-container px-2 py-1 rounded text-on-surface">Score: ${confidencePercent}%</span>
    </div>

    ${correctionHtml}

    <div class="flex flex-col gap-1.5">
      <span class="text-xs font-bold text-primary uppercase tracking-wider">${escapeHtml(
        Array.isArray(detail.category) ? detail.category.join(' • ') : 'National'
      )}</span>
      <h2 class="text-lg font-bold text-on-surface leading-snug">${escapeHtml(detail.primaryHeadline)}</h2>
      <p class="text-xs sm:text-sm text-on-surface-variant leading-relaxed">${escapeHtml(
        detail.summary || 'Summary under compilation by intelligence engine.'
      )}</p>
    </div>

    ${claimsHtml}

    <div class="flex flex-col gap-2">
      <span class="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1">
        <span class="material-symbols-outlined text-[16px] text-primary">link</span>
        Corroborated Primary Source Records (${detail.items?.length || 0})
      </span>
      <div class="flex flex-col gap-2">
        ${sourcesHtml || '<span class="text-xs text-on-surface-variant">No direct source links recorded.</span>'}
      </div>
    </div>

    <div class="flex items-center gap-2 pt-2 border-t border-surface-container">
      <button id="btn-dossier-save" class="flex-1 py-2.5 bg-surface-container text-on-surface rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-surface-variant transition-colors active:scale-95" type="button">
        <span class="material-symbols-outlined text-[18px]">bookmark</span>
        <span>Save Dossier</span>
      </button>
      <button id="btn-dossier-share" class="flex-1 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors active:scale-95 shadow-sm" type="button">
        <span class="material-symbols-outlined text-[18px]">share</span>
        <span>Share</span>
      </button>
    </div>
  `;

  // Attach action listeners
  const saveBtn = document.getElementById('btn-dossier-save');
  const shareBtn = document.getElementById('btn-dossier-share');

  // Check initial bookmark status
  ParmanuApiClient.checkBookmark(detail.id).then((isSaved) => {
    if (isSaved && saveBtn) {
      saveBtn.classList.add('text-secondary', 'font-bold');
      saveBtn.querySelector('span:last-child')!.textContent = 'Saved';
    }
  });

  saveBtn?.addEventListener('click', async () => {
    await toggleBookmarkAction(detail.id, saveBtn);
  });

  shareBtn?.addEventListener('click', () => {
    handleShare(detail.primaryHeadline);
  });
}

// ─── BOOKMARK ACTIONS ─────────────────────────────────────────────────

async function toggleBookmarkAction(storyClusterId: string, buttonEl: HTMLElement): Promise<void> {
  const isCurrentlySaved = await ParmanuApiClient.checkBookmark(storyClusterId);

  if (isCurrentlySaved) {
    const success = await ParmanuApiClient.removeBookmark(storyClusterId);
    if (success) {
      buttonEl.classList.remove('text-secondary');
      const textSpan = buttonEl.querySelector('span:last-child');
      if (textSpan && textSpan.textContent === 'Saved') {
        textSpan.textContent = 'Save Dossier';
      }
      showToast('Removed from saved bookmarks');
    } else {
      showToast('Please login to manage your saved items');
    }
  } else {
    const success = await ParmanuApiClient.saveBookmark({ storyClusterId });
    if (success) {
      buttonEl.classList.add('text-secondary');
      const textSpan = buttonEl.querySelector('span:last-child');
      if (textSpan && textSpan.textContent === 'Save Dossier') {
        textSpan.textContent = 'Saved';
      }
      showToast('Saved to your verified dossiers');
    } else {
      showToast('Please login to save bookmarks');
    }
  }
}

// ─── SEARCH MODAL ─────────────────────────────────────────────────────

function setupSearchModal(): void {
  let searchModal = document.getElementById('parmanu-search-modal');
  if (!searchModal) {
    searchModal = document.createElement('div');
    searchModal.id = 'parmanu-search-modal';
    searchModal.className =
      'fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 pointer-events-none opacity-0 transition-opacity duration-200';
    searchModal.innerHTML = `
      <div class="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl border border-surface-container overflow-hidden pointer-events-auto flex flex-col max-h-[75vh]">
        <div class="p-4 border-b border-surface-container flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-[24px]">search</span>
          <input id="search-input" type="text" placeholder="Search verified stories, creators, or topics (e.g. AI, PIB, Tata)..." class="flex-1 bg-transparent text-on-surface text-base outline-none placeholder:text-on-surface-variant font-medium" />
          <kbd class="hidden sm:inline-block px-2 py-0.5 bg-surface-container text-on-surface-variant rounded text-xs font-code font-bold">ESC</kbd>
          <button id="search-close-btn" class="p-1 rounded-full text-on-surface-variant hover:text-on-surface">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div id="search-results-container" class="p-4 overflow-y-auto flex flex-col gap-3 min-h-[160px]">
          <span class="text-xs text-on-surface-variant text-center py-8">Type a keyword to discover corroborated news, creator intelligence, and government traces.</span>
        </div>
      </div>
    `;
    document.body.appendChild(searchModal);
  }

  const input = searchModal.querySelector('#search-input') as HTMLInputElement;
  const resultsContainer = searchModal.querySelector('#search-results-container') as HTMLElement;
  const closeBtn = searchModal.querySelector('#search-close-btn') as HTMLElement;

  closeBtn?.addEventListener('click', closeSearchModal);

  input?.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(searchDebounceTimer);
    if (!q) {
      resultsContainer.innerHTML =
        '<span class="text-xs text-on-surface-variant text-center py-8">Type a keyword to discover corroborated news.</span>';
      return;
    }

    searchDebounceTimer = setTimeout(async () => {
      resultsContainer.innerHTML = `
        <div class="py-6 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
          <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs font-semibold">Searching verified records...</span>
        </div>
      `;

      const results = await ParmanuApiClient.search(q);
      renderSearchResults(resultsContainer, results);
    }, 250);
  });

  // Global search trigger
  (window as any).openSearchModal = openSearchModal;
}

function openSearchModal(): void {
  const modal = document.getElementById('parmanu-search-modal');
  const backdrop = document.getElementById('global-backdrop');
  const input = modal?.querySelector('#search-input') as HTMLInputElement;

  if (modal && backdrop) {
    modal.classList.remove('pointer-events-none', 'opacity-0');
    modal.classList.add('pointer-events-auto', 'opacity-100');
    backdrop.classList.remove('hidden');
    input?.focus();
  }
}

function closeSearchModal(): void {
  const modal = document.getElementById('parmanu-search-modal');
  const backdrop = document.getElementById('global-backdrop');

  if (modal && backdrop) {
    modal.classList.add('pointer-events-none', 'opacity-0');
    modal.classList.remove('pointer-events-auto', 'opacity-100');
    backdrop.classList.add('hidden');
  }
}

function renderSearchResults(container: HTMLElement, results: SearchResultData): void {
  const { clusters, entities } = results;

  if (clusters.length === 0 && entities.length === 0) {
    container.innerHTML = `
      <div class="py-8 text-center text-xs text-on-surface-variant">
        No verified intelligence found matching your search.
      </div>
    `;
    return;
  }

  let html = '';

  if (entities.length > 0) {
    html += `
      <div class="flex flex-col gap-1.5 pb-2 border-b border-surface-container">
        <span class="text-[11px] font-bold text-primary uppercase tracking-wider">Identified Entities</span>
        <div class="flex flex-wrap gap-2">
          ${entities
            .map(
              (ent) => `
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-surface-container rounded-full text-xs font-semibold text-on-surface">
              <span class="material-symbols-outlined text-[14px] text-secondary">verified</span>
              ${escapeHtml(ent.canonicalName)} <span class="text-[10px] text-on-surface-variant">(${escapeHtml(
                ent.entityType
              )})</span>
            </span>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  if (clusters.length > 0) {
    html += `
      <div class="flex flex-col gap-2">
        <span class="text-[11px] font-bold text-primary uppercase tracking-wider">Verified Stories (${clusters.length})</span>
        ${clusters
          .map(
            (c) => `
          <div class="search-result-item p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer flex flex-col gap-1 border border-surface-container" data-id="${escapeHtml(
            c.id
          )}">
            <span class="text-xs font-bold text-on-surface leading-snug">${escapeHtml(c.primaryHeadline)}</span>
            <div class="flex items-center gap-2 text-[11px] text-on-surface-variant">
              <span class="text-secondary font-bold">${c.itemCount} Sources</span>
              <span>•</span>
              <span>${Array.isArray(c.category) ? c.category.join(', ') : 'News'}</span>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  container.innerHTML = html;

  container.querySelectorAll('.search-result-item').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      if (id) {
        closeSearchModal();
        openDossierModal(id);
      }
    });
  });
}

// ─── BOOKMARKS DRAWER ─────────────────────────────────────────────────

function setupBookmarksDrawer(): void {
  let drawer = document.getElementById('parmanu-bookmarks-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'parmanu-bookmarks-drawer';
    drawer.className =
      'fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface-container-lowest shadow-2xl border-l border-surface-container transform translate-x-full transition-transform duration-300 flex flex-col pointer-events-none';
    drawer.innerHTML = `
      <div class="p-4 border-b border-surface-container flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-secondary text-[22px]">bookmark</span>
          <h3 class="font-headline text-lg font-bold text-on-surface">Saved Dossiers</h3>
        </div>
        <button id="bookmarks-close-btn" class="p-1 rounded-full text-on-surface-variant hover:text-on-surface">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <div id="bookmarks-list-container" class="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
        <div class="py-12 text-center text-xs text-on-surface-variant">Loading bookmarks...</div>
      </div>
    `;
    document.body.appendChild(drawer);
  }

  drawer.querySelector('#bookmarks-close-btn')?.addEventListener('click', closeBookmarksDrawer);

  (window as any).openBookmarksDrawer = openBookmarksDrawer;
}

async function openBookmarksDrawer(): Promise<void> {
  const drawer = document.getElementById('parmanu-bookmarks-drawer');
  const backdrop = document.getElementById('global-backdrop');
  if (!drawer || !backdrop) return;

  drawer.classList.remove('translate-x-full', 'pointer-events-none');
  drawer.classList.add('translate-x-0', 'pointer-events-auto');
  backdrop.classList.remove('hidden');

  const container = drawer.querySelector('#bookmarks-list-container') as HTMLElement;
  if (!container) return;

  const { bookmarks } = await ParmanuApiClient.fetchBookmarks();
  if (bookmarks.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center flex flex-col items-center gap-2 text-on-surface-variant">
        <span class="material-symbols-outlined text-3xl">bookmark_border</span>
        <span class="text-sm font-bold text-on-surface">No saved dossiers</span>
        <span class="text-xs">Click the bookmark icon on any story to save it for offline reference.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = bookmarks
    .map((bm: BookmarkRecord) => {
      const cluster = bm.storyCluster;
      const title = cluster?.primaryHeadline || bm.sourceItem?.headline || 'Saved Item';
      const category = cluster?.category ? cluster.category.join(' • ') : 'News';
      const targetId = cluster?.id || bm.sourceItemId || '';

      return `
        <div class="p-3 bg-surface-container-low rounded-xl border border-surface-container flex items-start justify-between gap-2">
          <div class="flex flex-col gap-1 min-w-0 cursor-pointer" onclick="window.parmanu.openDossierModal('${escapeHtml(
            targetId
          )}')">
            <span class="text-[11px] font-bold text-primary uppercase">${escapeHtml(category)}</span>
            <span class="text-xs font-bold text-on-surface leading-snug line-clamp-2">${escapeHtml(title)}</span>
          </div>
          <button class="p-1 text-on-surface-variant hover:text-error transition-colors" onclick="window.parmanu.removeBookmarkItem('${escapeHtml(
            bm.id
          )}')">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      `;
    })
    .join('');
}

function closeBookmarksDrawer(): void {
  const drawer = document.getElementById('parmanu-bookmarks-drawer');
  const backdrop = document.getElementById('global-backdrop');
  if (drawer && backdrop) {
    drawer.classList.add('translate-x-full', 'pointer-events-none');
    drawer.classList.remove('translate-x-0', 'pointer-events-auto');
    backdrop.classList.add('hidden');
  }
}

// ─── GLOBAL MODAL HELPERS ─────────────────────────────────────────────

function setupModalsAndBackdrops(): void {
  const backdrop = document.getElementById('global-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeAllModals();
    });
  }

  // Keyboard Escape listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
    // Command/Control + K for quick search
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearchModal();
    }
  });
}

function closeAllModals(updateHistory = true): void {
  const modalIds = ['dossier-main', 'dossier-breaking', 'download-app-modal'];
  modalIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('translate-y-full', 'pointer-events-none');
      el.classList.remove('translate-y-0', 'pointer-events-auto', 'md:opacity-100', 'md:scale-100');
    }
  });

  closeSearchModal();
  closeBookmarksDrawer();

  const backdrop = document.getElementById('global-backdrop');
  if (backdrop) backdrop.classList.add('hidden');

  currentStoryClusterId = null;
  activeDossierData = null;

  if (updateHistory) {
    updateUrl({ story: null });
  }
}

function setupGlobalActions(): void {
  // Expose on global window object for inline HTML event handlers
  (window as any).parmanu = {
    openDossierModal,
    closeAllModals,
    openSearchModal,
    openBookmarksDrawer,
    selectCategory,
    handleShare,
    removeBookmarkItem: async (id: string) => {
      await ParmanuApiClient.removeBookmark(id);
      showToast('Removed bookmark');
      openBookmarksDrawer();
    },
  };

  (window as any).toggleDossier = (id: string) => {
    if (id === 'dossier-main') {
      if (activeDossierData) {
        openDossierModal(activeDossierData.id);
      } else {
        const topLead = document.querySelector('article.bg-surface-container-lowest');
        if (topLead) {
          openDossierModal('featured');
        }
      }
    } else {
      const el = document.getElementById(id);
      const backdrop = document.getElementById('global-backdrop');
      if (el && backdrop) {
        el.classList.remove('translate-y-full', 'pointer-events-none');
        el.classList.add('translate-y-0', 'pointer-events-auto', 'md:opacity-100', 'md:scale-100');
        backdrop.classList.remove('hidden');
      }
    }
  };

  (window as any).closeAllModals = closeAllModals;
  (window as any).handleShare = handleShare;
}

function handleShare(title?: string): void {
  const shareTitle = title || document.title;
  const shareUrl = window.location.href;

  if (navigator.share) {
    navigator
      .share({
        title: shareTitle,
        text: 'Verified story from Parmanu News & Creator Intelligence',
        url: shareUrl,
      })
      .catch(() => {});
  } else {
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        showToast('Story link copied to clipboard!');
      })
      .catch(() => {
        showToast('Unable to copy link to clipboard');
      });
  }
}

export {
  openDossierModal,
  closeAllModals,
  openSearchModal,
  openBookmarksDrawer,
  selectCategory,
  handleShare,
};
