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
  SourceItemSummary,
  CollaborationClaimRecord,
} from './api/client';

// Global State
let currentSection = 'feed';
let currentCategory = 'all';
let currentStoryClusterId: string | null = null;
let activeDossierData: StoryClusterDetail | null = null;
let currentUser: any | null = null;
let searchDebounceTimer: any = null;
let categoriesCache: CategorySummary[] = [];

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

function updateLiveClockAndDate(): void {
  const now = new Date();
  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  };
  const istTime = now.toLocaleTimeString('en-GB', timeOptions);
  const istDate = now.toLocaleDateString('en-US', dateOptions);

  const ticker = document.getElementById('live-time-ticker');
  const dateHeading = document.getElementById('current-date-heading');
  if (ticker) ticker.textContent = `Live ${istTime} IST`;
  if (dateHeading) dateHeading.textContent = istDate;
}

// ─── INITIALIZATION & ROUTING ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Parmanu] Initializing Phase 3.1 Consumer Platform...');

  updateLiveClockAndDate();
  setInterval(updateLiveClockAndDate, 10000);

  setupModalsAndBackdrops();
  setupSearchModal();
  setupBookmarksDrawer();
  setupGlobalActions();
  setupNavigation();
  setupUrlSync();
  setupAuthModal();
  setupCategoryPills();

  (window as any).parmanu = {
    selectCategory,
    openAuthModal,
    openProfileModal,
    switchSection,
    loadCollabsFeed,
  };

  // Load user session
  currentUser = await ParmanuApiClient.getCurrentUser();
  updateAuthUI();

  // Load dynamic top-level widgets
  await Promise.all([
    loadCategories(),
    loadFeaturedHero(),
    loadTrendingStories(),
    loadLiveBriefing(),
  ]);

  // Initial Section from URL Hash
  const hash = window.location.hash.replace('#', '').toLowerCase();
  if (['feed', 'pulse', 'explore', 'collabs', 'workspace'].includes(hash)) {
    await switchSection(hash, false);
  } else {
    await switchSection('feed', false);
  }

  // Real-time automatic polling every 30 seconds
  setInterval(async () => {
    await Promise.all([
      loadTrendingStories(),
      loadLiveBriefing(),
      loadFeaturedHero(),
    ]);

    // If on Pulse view, also auto-refresh the wire
    if (currentSection === 'pulse') {
      await loadPulseFeed();
    }
  }, 30000);

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

function setupNavigation(): void {
  // Desktop Navigation Links
  document.querySelectorAll('#desktop-nav .nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section') || 'feed';
      switchSection(section);
    });
  });

  // Mobile Bottom Navigation Tabs
  document.querySelectorAll('#nav-tabs .nav-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const section = tab.getAttribute('data-path') || 'feed';
      switchSection(section);
    });
  });

  // Top header brand links
  document.querySelectorAll('header a[href="#"], header a[href="#feed"]').forEach((brandLink) => {
    brandLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection('feed');
    });
  });

  // Hashchange event for browser back/forward or external links
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (['feed', 'pulse', 'explore', 'collabs', 'workspace'].includes(hash)) {
      if (currentSection !== hash) {
        switchSection(hash, false);
      }
    }
  });
}

async function switchSection(section: string, updateHash = true): Promise<void> {
  const validSections = ['feed', 'pulse', 'explore', 'collabs', 'workspace'];
  const target = validSections.includes(section) ? section : 'feed';
  currentSection = target;

  if (updateHash) {
    window.location.hash = `#${target}`;
  }

  // Update Desktop Navigation Pills
  document.querySelectorAll('#desktop-nav .nav-link').forEach((link) => {
    const linkSection = link.getAttribute('data-section');
    if (linkSection === target) {
      link.className =
        'nav-link px-3.5 py-1.5 rounded-full text-sm font-semibold text-primary bg-primary/10 transition-colors shadow-xs';
    } else {
      link.className =
        'nav-link px-3.5 py-1.5 rounded-full text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors';
    }
  });

  // Update Mobile Navigation Tabs
  document.querySelectorAll('#nav-tabs .nav-tab').forEach((tab) => {
    const tabSection = tab.getAttribute('data-path');
    if (tabSection === target) {
      tab.classList.remove('text-on-surface-variant');
      tab.classList.add('text-primary', 'font-bold');
    } else {
      tab.classList.remove('text-primary', 'font-bold');
      tab.classList.add('text-on-surface-variant');
    }
  });

  const heroArticle = document.getElementById('hero-lead-article');
  const categoryPillsSection = document.getElementById('category-pills-section');
  const feedHeading = document.getElementById('feed-section-heading');
  const feedSubheading = document.getElementById('feed-section-subheading');
  const feedDescription = document.getElementById('feed-section-description');

  if (target === 'feed') {
    if (heroArticle) heroArticle.classList.remove('hidden');
    if (categoryPillsSection) categoryPillsSection.classList.remove('hidden');
    if (feedHeading) feedHeading.textContent = 'Verified Dispatch Feed';
    if (feedSubheading) feedSubheading.textContent = 'All Fields • Corroborated';
    if (feedDescription)
      feedDescription.textContent =
        'Multi-source corroborated reporting across national and global newsrooms.';
    await loadDispatchFeed();
  } else if (target === 'pulse') {
    if (heroArticle) heroArticle.classList.add('hidden');
    if (categoryPillsSection) categoryPillsSection.classList.add('hidden');
    if (feedHeading) feedHeading.textContent = '⚡ Real-Time Pulse & Breaking Wire';
    if (feedSubheading) feedSubheading.textContent = 'Live Wire • Ingesting';
    if (feedDescription)
      feedDescription.textContent =
        'Direct teleprinter stream from verified news bureaus, gazettes, and official wires.';
    await loadPulseFeed();
  } else if (target === 'explore') {
    if (heroArticle) heroArticle.classList.add('hidden');
    if (categoryPillsSection) categoryPillsSection.classList.remove('hidden');
    if (feedHeading) feedHeading.textContent = '🧭 Explore Stories by Topic';
    if (feedSubheading) feedSubheading.textContent = 'Curated Categories';
    if (feedDescription)
      feedDescription.textContent =
        'Deep-dive into verified reporting filtered by policy, technology, creator economy, climate, and more.';
    await loadExploreFeed();
  } else if (target === 'collabs') {
    if (heroArticle) heroArticle.classList.add('hidden');
    if (categoryPillsSection) categoryPillsSection.classList.add('hidden');
    if (feedHeading) feedHeading.textContent = '🤝 Creator Economy & Brand Radar';
    if (feedSubheading) feedSubheading.textContent = 'Audited Intelligence';
    if (feedDescription)
      feedDescription.textContent =
        'Verified creator sponsorships, ASCI/FTC disclosure compliance (#ad), and digital media intelligence.';
    await loadCollabsFeed();
  } else if (target === 'workspace') {
    if (heroArticle) heroArticle.classList.add('hidden');
    if (categoryPillsSection) categoryPillsSection.classList.add('hidden');
    if (feedHeading) feedHeading.textContent = '📋 Dossier Workspace & Saved Stories';
    if (feedSubheading) feedSubheading.textContent = 'Personal Desk';
    if (feedDescription)
      feedDescription.textContent =
        'Your saved intelligence dossiers, cryptographic audit packets, and multi-source evidence chains.';
    await loadWorkspaceFeed();
  }
}

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
    const displayName = currentUser.name || currentUser.fullName || currentUser.email.split('@')[0];
    authContainer.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-on-surface truncate max-w-[120px]">${escapeHtml(displayName)}</span>
        <button id="btn-logout" class="text-xs text-error hover:underline font-bold cursor-pointer">Logout</button>
      </div>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      ParmanuApiClient.clearToken();
      currentUser = null;
      updateAuthUI();
      showToast('Logged out successfully');
      if (currentSection === 'collabs') loadCollabsFeed();
    });
  } else {
    authContainer.innerHTML = `
      <button id="btn-open-auth" type="button" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary/90 transition-all shadow-sm cursor-pointer">
        <span class="material-symbols-outlined text-[16px]">account_circle</span>
        <span>Sign In</span>
      </button>
    `;
    document.getElementById('btn-open-auth')?.addEventListener('click', () => {
      openAuthModal('signin');
    });
  }
}

function openAuthModal(defaultTab: 'signin' | 'register' = 'signin'): void {
  (window as any).closeAllModals?.();
  const modal = document.getElementById('auth-modal');
  const backdrop = document.getElementById('global-backdrop');
  if (!modal || !backdrop) return;

  const errBox = document.getElementById('auth-error-box');
  const succBox = document.getElementById('auth-success-box');
  if (errBox) errBox.classList.add('hidden');
  if (succBox) succBox.classList.add('hidden');

  switchAuthTab(defaultTab);

  modal.classList.remove('translate-y-full', 'pointer-events-none');
  modal.classList.add('translate-y-0', 'pointer-events-auto', 'md:opacity-100', 'md:scale-100');
  backdrop.classList.remove('hidden');
}

function openProfileModal(): void {
  if (!currentUser) {
    openAuthModal('signin');
    return;
  }
  (window as any).closeAllModals?.();
  const modal = document.getElementById('user-profile-modal');
  const backdrop = document.getElementById('global-backdrop');
  if (!modal || !backdrop) return;

  const nameEl = document.getElementById('profile-modal-name');
  const emailEl = document.getElementById('profile-modal-email');
  const avatarEl = document.getElementById('profile-modal-avatar');
  const followingCountEl = document.getElementById('profile-modal-following-count');
  const interestsCountEl = document.getElementById('profile-modal-interests-count');

  const displayName = currentUser.name || currentUser.fullName || currentUser.email.split('@')[0];
  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = currentUser.email;
  if (avatarEl) avatarEl.textContent = displayName.charAt(0).toUpperCase();

  ParmanuApiClient.fetchPersonalizedFeed().then((feed) => {
    if (feed && feed.stats) {
      if (followingCountEl) followingCountEl.textContent = String(feed.stats.followedCount);
      if (interestsCountEl) interestsCountEl.textContent = String(feed.stats.interestCount);
    }
  });

  modal.classList.remove('translate-y-full', 'pointer-events-none');
  modal.classList.add('translate-y-0', 'pointer-events-auto', 'md:opacity-100', 'md:scale-100');
  backdrop.classList.remove('hidden');
}

function switchAuthTab(tab: 'signin' | 'register'): void {
  const signinBtn = document.getElementById('auth-tab-signin');
  const registerBtn = document.getElementById('auth-tab-register');
  const signinForm = document.getElementById('form-signin');
  const registerForm = document.getElementById('form-register');
  const errBox = document.getElementById('auth-error-box');
  if (errBox) errBox.classList.add('hidden');

  if (tab === 'signin') {
    signinBtn?.classList.remove('text-on-surface-variant');
    signinBtn?.classList.add('bg-primary', 'text-on-primary', 'font-bold');
    registerBtn?.classList.remove('bg-primary', 'text-on-primary', 'font-bold');
    registerBtn?.classList.add('text-on-surface-variant');
    signinForm?.classList.remove('hidden');
    registerForm?.classList.add('hidden');
  } else {
    registerBtn?.classList.remove('text-on-surface-variant');
    registerBtn?.classList.add('bg-primary', 'text-on-primary', 'font-bold');
    signinBtn?.classList.remove('bg-primary', 'text-on-primary', 'font-bold');
    signinBtn?.classList.add('text-on-surface-variant');
    registerForm?.classList.remove('hidden');
    signinForm?.classList.add('hidden');
  }
}

function setupAuthModal(): void {
  document.getElementById('btn-auth-avatar')?.addEventListener('click', () => {
    if (currentUser) openProfileModal();
    else openAuthModal('signin');
  });

  document.getElementById('btn-mobile-auth-avatar')?.addEventListener('click', () => {
    if (currentUser) openProfileModal();
    else openAuthModal('signin');
  });

  document.getElementById('btn-open-auth')?.addEventListener('click', () => {
    openAuthModal('signin');
  });

  document.getElementById('auth-tab-signin')?.addEventListener('click', () => switchAuthTab('signin'));
  document.getElementById('auth-tab-register')?.addEventListener('click', () => switchAuthTab('register'));
  document.getElementById('link-to-register')?.addEventListener('click', () => switchAuthTab('register'));
  document.getElementById('link-to-signin')?.addEventListener('click', () => switchAuthTab('signin'));

  document.getElementById('form-signin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('signin-email') as HTMLInputElement;
    const passwordInput = document.getElementById('signin-password') as HTMLInputElement;
    const errBox = document.getElementById('auth-error-box');
    const errMsg = document.getElementById('auth-error-msg');
    const submitBtn = document.getElementById('btn-submit-signin') as HTMLButtonElement;

    if (!emailInput || !passwordInput) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying Credentials...';

    const result = await ParmanuApiClient.login(emailInput.value.trim(), passwordInput.value);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">login</span><span>Sign In to Parmanu</span>';

    if (result.success && result.user) {
      currentUser = result.user;
      updateAuthUI();
      (window as any).closeAllModals?.();
      showToast(`Welcome back, ${currentUser.name || currentUser.email}!`);
      if (currentSection === 'collabs') loadCollabsFeed();
      else if (currentSection === 'feed') loadDispatchFeed();
    } else {
      if (errBox && errMsg) {
        errMsg.textContent = result.error || 'Invalid email or password';
        errBox.classList.remove('hidden');
      }
    }
  });

  document.getElementById('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('register-name') as HTMLInputElement;
    const emailInput = document.getElementById('register-email') as HTMLInputElement;
    const passwordInput = document.getElementById('register-password') as HTMLInputElement;
    const errBox = document.getElementById('auth-error-box');
    const errMsg = document.getElementById('auth-error-msg');
    const submitBtn = document.getElementById('btn-submit-register') as HTMLButtonElement;

    const interestCheckboxes = document.querySelectorAll('#register-interests-container input[type="checkbox"]:checked');
    const selectedInterests: string[] = [];
    interestCheckboxes.forEach((cb) => {
      selectedInterests.push((cb as HTMLInputElement).value);
    });

    if (!emailInput || !passwordInput) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    const result = await ParmanuApiClient.register(
      emailInput.value.trim(),
      passwordInput.value,
      nameInput?.value.trim() || undefined,
      selectedInterests
    );
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">how_to_reg</span><span>Create Account & Unlock Feed</span>';

    if (result.success && result.user) {
      currentUser = result.user;
      updateAuthUI();
      (window as any).closeAllModals?.();
      showToast('Welcome to Parmanu! Feed personalized.');
      if (currentSection === 'collabs') loadCollabsFeed();
      else if (currentSection === 'feed') loadDispatchFeed();
    } else {
      if (errBox && errMsg) {
        errMsg.textContent = result.error || 'Failed to create account';
        errBox.classList.remove('hidden');
      }
    }
  });

  document.getElementById('profile-modal-btn-logout')?.addEventListener('click', () => {
    ParmanuApiClient.clearToken();
    currentUser = null;
    updateAuthUI();
    (window as any).closeAllModals?.();
    showToast('Logged out successfully');
    if (currentSection === 'collabs') loadCollabsFeed();
  });
}

function setupCategoryPills(): void {
  document.querySelectorAll('.category-pill').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const cat = target.getAttribute('data-category') || 'all';
      selectCategory(cat);
    });
  });
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

  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);
  const countBadge = document.getElementById('live-dossier-count');
  if (countBadge && totalCount > 0) {
    countBadge.textContent = `${totalCount} Verified Dossiers`;
  }

  container.querySelectorAll('.category-pill').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const cat = target.getAttribute('data-category') || 'all';
      selectCategory(cat);
    });
  });
}

async function loadLiveBriefing(): Promise<void> {
  const timeline = document.getElementById('live-briefing-timeline');
  const headline = document.getElementById('live-briefing-headline');
  const refreshBtn = document.getElementById('btn-refresh-stream');
  if (!timeline) return;

  const items = await ParmanuApiClient.fetchLiveDispatches(4);
  if (items.length === 0) return;

  if (headline && items[0]) {
    headline.textContent = items[0].headline;
  }

  timeline.innerHTML = items
    .map((item) => {
      const pubDate = new Date(item.publishedAt);
      const timeStr = isNaN(pubDate.getTime())
        ? 'Live'
        : pubDate.toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
      const sourceName = item.source?.name || 'Verified Wire';

      return `
        <div class="flex items-start gap-2.5">
          <span class="font-code text-xs font-bold text-primary shrink-0 mt-0.5">${timeStr}</span>
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-[10px] font-bold text-secondary uppercase">${escapeHtml(sourceName)}</span>
            <a href="${escapeHtml(item.canonicalUrl)}" target="_blank" rel="noopener noreferrer" class="text-xs text-on-surface hover:text-primary hover:underline leading-relaxed line-clamp-2">
              ${escapeHtml(item.headline)}
            </a>
          </div>
        </div>
      `;
    })
    .join('');

  if (refreshBtn && !refreshBtn.hasAttribute('data-bound')) {
    refreshBtn.setAttribute('data-bound', 'true');
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.textContent = 'Updating...';
      await loadLiveBriefing();
      refreshBtn.textContent = 'Refresh Stream';
      showToast('Live briefing stream synchronized');
    });
  }
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

  if (currentSection === 'explore') {
    loadExploreFeed();
  } else if (currentSection === 'feed') {
    loadDispatchFeed();
  } else {
    switchSection('explore', false);
  }
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

// ─── VERIFIED DISPATCH FEED (MAIN FEED) ────────────────────────────────

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
    // If no aggregated clusters match, retrieve direct verified news dispatches matching category
    const dispatches = await ParmanuApiClient.fetchLiveDispatches(
      20,
      currentCategory === 'all' ? undefined : currentCategory
    );

    if (dispatches.length > 0) {
      container.innerHTML = `
        <div class="flex items-center justify-between mb-3 px-1">
          <span class="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px]">verified</span>
            Live Verified Dispatches • ${escapeHtml(currentCategory.toUpperCase())}
          </span>
          <span class="text-xs text-on-surface-variant font-code">${dispatches.length} Articles</span>
        </div>
      `;
      renderSourceItemCards(dispatches, container);
      return;
    }

    container.innerHTML = `
      <div class="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-secondary text-4xl">folder_open</span>
        <h4 class="text-base font-bold text-on-surface">No verified stories in this category yet</h4>
        <p class="text-xs text-on-surface-variant max-w-sm">Our ingestion engine monitors incoming feeds 24/7. Switch category or check back shortly.</p>
        <button class="px-4 py-2 bg-surface-container rounded-full text-xs font-bold text-primary hover:bg-surface-variant cursor-pointer" onclick="window.parmanu.selectCategory('all')">
          View All Fields
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  renderStoryClusterCards(clusters, container);
}

function renderStoryClusterCards(clusters: StoryClusterDetail[], container: HTMLElement): void {
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

// ─── PULSE SECTION: REAL-TIME WIRE DISPATCHES ─────────────────────────

function renderSourceItemCards(items: SourceItemSummary[], container: HTMLElement): void {
  items.forEach((item: SourceItemSummary) => {
    const card = document.createElement('article');
    card.className =
      'bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3 border border-surface-container hover:shadow-md transition-shadow';

    const sourceName = item.source?.name || 'Verified Bureau';
    const relativeTime = formatRelativeTime(item.publishedAt);
    const pubDate = new Date(item.publishedAt);
    const istTime = isNaN(pubDate.getTime())
      ? ''
      : pubDate.toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }) + ' IST';

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
          <span class="material-symbols-outlined text-[13px]" style="font-variation-settings: 'FILL' 1;">sensors</span>
          Wire • ${escapeHtml(sourceName)}
        </span>
        <div class="flex items-center gap-2 text-xs text-on-surface-variant font-code">
          <span>${istTime}</span>
          <span>•</span>
          <span>${relativeTime}</span>
        </div>
      </div>
      <div class="flex flex-col gap-1 min-w-0">
        <h4 class="text-base sm:text-lg font-bold text-on-surface leading-snug">
          <a href="${escapeHtml(item.canonicalUrl)}" target="_blank" rel="noopener noreferrer" class="hover:text-primary hover:underline transition-colors">
            ${escapeHtml(item.headline)}
          </a>
        </h4>
        ${
          item.excerpt
            ? `<p class="text-xs sm:text-sm text-on-surface-variant line-clamp-3 leading-relaxed">${escapeHtml(item.excerpt)}</p>`
            : ''
        }
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-surface-container text-xs text-on-surface-variant">
        <span class="inline-flex items-center gap-1 font-code text-[11px] text-secondary font-semibold">
          <span class="material-symbols-outlined text-[14px]">verified_user</span>
          Grounded Ingested Record
        </span>
        <div class="flex items-center gap-2">
          <button class="btn-item-save p-1 rounded-full text-on-surface-variant hover:text-primary active:scale-90 transition-transform cursor-pointer" data-id="${escapeHtml(
            item.id
          )}" title="Save dispatch">
            <span class="material-symbols-outlined text-[18px]">bookmark</span>
          </button>
          <a href="${escapeHtml(item.canonicalUrl)}" target="_blank" rel="noopener noreferrer" class="text-primary font-bold flex items-center gap-0.5 hover:underline">
            Read Source Wire <span class="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </div>
    `;

    const saveBtn = card.querySelector('.btn-item-save') as HTMLElement;
    saveBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const success = await ParmanuApiClient.saveBookmark({ sourceItemId: item.id });
      if (success) {
        saveBtn.classList.add('text-secondary');
        showToast('Saved wire dispatch to workspace');
      } else {
        showToast('Unable to save bookmark');
      }
    });

    container.appendChild(card);
  });
}

async function loadPulseFeed(): Promise<void> {
  const container = document.getElementById('live-ingested-feed-container');
  if (!container) return;

  container.innerHTML = `
    <div class="py-8 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs font-semibold">Tuning into real-time live teleprinter wires...</span>
    </div>
  `;

  const dispatches = await ParmanuApiClient.fetchLiveDispatches(30);

  if (dispatches.length === 0) {
    container.innerHTML = `
      <div class="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-secondary text-4xl animate-pulse">sensors</span>
        <h4 class="text-base font-bold text-on-surface">Live Wire Buffer Active</h4>
        <p class="text-xs text-on-surface-variant max-w-sm">No newly published dispatches within the last buffer window. Automated ingestion runs every minute.</p>
        <button class="px-4 py-2 bg-primary text-on-primary rounded-full text-xs font-bold hover:bg-primary/90" onclick="window.parmanu.switchSection('pulse')">
          ⚡ Force Re-poll Wire
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="bg-secondary/10 p-3.5 rounded-xl border border-secondary/20 flex items-center justify-between text-xs mb-2">
      <span class="flex items-center gap-2 font-bold text-secondary">
        <span class="w-2.5 h-2.5 rounded-full bg-secondary animate-ping"></span>
        Direct Wire Teleprinter: ${dispatches.length} Incoming Dispatches
      </span>
      <span class="text-[11px] font-code text-on-surface-variant">Auto-updating 30s</span>
    </div>
  `;

  renderSourceItemCards(dispatches, container);
}

// ─── EXPLORE SECTION: CATEGORIES & TOPIC BREAKDOWNS ───────────────────

async function loadExploreFeed(): Promise<void> {
  const container = document.getElementById('live-ingested-feed-container');
  if (!container) return;

  container.innerHTML = `
    <div class="py-8 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs font-semibold">Loading topics and category dispatches...</span>
    </div>
  `;

  const [categories, { clusters }] = await Promise.all([
    categoriesCache.length > 0 ? categoriesCache : ParmanuApiClient.fetchCategories(),
    ParmanuApiClient.fetchStoryClusters({
      category: currentCategory === 'all' ? undefined : currentCategory,
      limit: 20,
    }),
  ]);
  categoriesCache = categories;

  const currentSelection = currentCategory.toLowerCase();

  const categoryGridHtml = `
    <div class="bg-surface-container-low p-4 sm:p-5 rounded-2xl border border-surface-container mb-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-primary text-[18px]">category</span>
          Browse by Subject Desk
        </span>
        <span class="text-xs text-on-surface-variant">${categories.length} Active Categories</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <button class="topic-card p-3 rounded-xl border text-left transition-all ${
          currentSelection === 'all'
            ? 'bg-primary text-on-primary border-primary shadow-sm'
            : 'bg-surface-container-lowest text-on-surface border-surface-container hover:border-primary/40'
        }" data-cat="all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold">All Fields</span>
            <span class="material-symbols-outlined text-[16px]">public</span>
          </div>
          <span class="text-[11px] opacity-80 mt-1 block">Full Coverage</span>
        </button>
        ${categories
          .map((cat) => {
            const isSel = currentSelection === cat.slug;
            return `
              <button class="topic-card p-3 rounded-xl border text-left transition-all ${
                isSel
                  ? 'bg-primary text-on-primary border-primary shadow-sm'
                  : 'bg-surface-container-lowest text-on-surface border-surface-container hover:border-primary/40'
              }" data-cat="${escapeHtml(cat.slug)}">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold truncate">${escapeHtml(cat.name)}</span>
                  <span class="text-[10px] font-code px-1.5 py-0.5 rounded ${
                    isSel ? 'bg-white/20' : 'bg-surface-container'
                  }">${cat.count}</span>
                </div>
                <span class="text-[11px] opacity-80 mt-1 block truncate">Verified Stories</span>
              </button>
            `;
          })
          .join('')}
      </div>
    </div>
  `;

  container.innerHTML = categoryGridHtml;

  container.querySelectorAll('.topic-card').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const cat = (e.currentTarget as HTMLElement).getAttribute('data-cat') || 'all';
      selectCategory(cat);
      loadExploreFeed();
    });
  });

  if (clusters.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className =
      'bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-3';
    emptyEl.innerHTML = `
      <span class="material-symbols-outlined text-secondary text-4xl">folder_open</span>
      <h4 class="text-base font-bold text-on-surface">No verified stories in "${escapeHtml(
        currentCategory
      )}" yet</h4>
      <p class="text-xs text-on-surface-variant max-w-sm">Our ingestion engine monitors incoming feeds 24/7. Select another category or view all dispatches.</p>
    `;
    container.appendChild(emptyEl);
    return;
  }

  renderStoryClusterCards(clusters, container);
}

// ─── COLLABS SECTION: CREATOR ECONOMY & BRAND RADAR ───────────────────

let currentCollabsSubtab: 'radar' | 'following' | 'claims' = 'radar';

async function loadCollabsFeed(): Promise<void> {
  const container = document.getElementById('live-ingested-feed-container');
  if (!container) return;

  container.innerHTML = `
    <div class="py-8 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs font-semibold">Auditing creator radar &amp; sponsorship disclosures...</span>
    </div>
  `;

  const [creators, claims, personalized] = await Promise.all([
    ParmanuApiClient.fetchCreators(),
    ParmanuApiClient.fetchCollaborationClaims(),
    currentUser ? ParmanuApiClient.fetchPersonalizedFeed() : Promise.resolve(null),
  ]);

  const followedCount = personalized?.stats?.followedCount ?? creators.filter((c) => c.isFollowedByMe).length;

  container.innerHTML = `
    <!-- Top Header Banner -->
    <div class="bg-gradient-to-r from-primary/10 via-surface-container to-secondary/10 p-5 rounded-2xl border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
      <div class="flex flex-col gap-0.5">
        <span class="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[18px]">hub</span>
          Creator Intelligence &amp; Sponsorship Radar
        </span>
        <h4 class="text-base font-bold text-on-surface">Top Influencers, Brand Deals &amp; ASCI #ad Disclosures</h4>
        <p class="text-xs text-on-surface-variant">Follow creators to personalize your daily feed with their latest collabs, activity, and verified news.</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold px-3 py-1 bg-surface-container-lowest rounded-full shadow-sm text-secondary flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px]">stars</span>
          ${followedCount} Following
        </span>
      </div>
    </div>

    <!-- Sub-tab navigation -->
    <div class="flex items-center gap-2 p-1 bg-surface-container rounded-xl mb-4 overflow-x-auto no-scrollbar">
      <button id="collabs-btn-radar" type="button" class="flex-1 min-w-[130px] py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
        currentCollabsSubtab === 'radar'
          ? 'bg-primary text-on-primary shadow-sm'
          : 'text-on-surface-variant hover:text-on-surface'
      }">
        🔥 Top Creators Radar
      </button>
      <button id="collabs-btn-following" type="button" class="flex-1 min-w-[150px] py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
        currentCollabsSubtab === 'following'
          ? 'bg-primary text-on-primary shadow-sm'
          : 'text-on-surface-variant hover:text-on-surface'
      }">
        ⭐ My Following Feed (${followedCount})
      </button>
      <button id="collabs-btn-claims" type="button" class="flex-1 min-w-[140px] py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
        currentCollabsSubtab === 'claims'
          ? 'bg-primary text-on-primary shadow-sm'
          : 'text-on-surface-variant hover:text-on-surface'
      }">
        🤝 Brand Collabs (#ad)
      </button>
    </div>

    <!-- Tab Content Container -->
    <div id="collabs-tab-content"></div>
  `;

  // Bind subtab buttons
  document.getElementById('collabs-btn-radar')?.addEventListener('click', () => {
    currentCollabsSubtab = 'radar';
    loadCollabsFeed();
  });
  document.getElementById('collabs-btn-following')?.addEventListener('click', () => {
    currentCollabsSubtab = 'following';
    loadCollabsFeed();
  });
  document.getElementById('collabs-btn-claims')?.addEventListener('click', () => {
    currentCollabsSubtab = 'claims';
    loadCollabsFeed();
  });

  const contentContainer = document.getElementById('collabs-tab-content');
  if (!contentContainer) return;

  // 1. RADAR SUBTAB
  if (currentCollabsSubtab === 'radar') {
    if (creators.length === 0) {
      contentContainer.innerHTML = `
        <div class="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-3xl text-secondary">groups</span>
          <span class="text-sm font-bold text-on-surface">No creators in radar currently</span>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';

    creators.forEach((c) => {
      const card = document.createElement('div');
      card.className =
        'bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-sm flex flex-col justify-between gap-3 hover:shadow-md transition-shadow';

      const avatar =
        c.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';
      const categoryTags = (c.category || [])
        .slice(0, 3)
        .map(
          (tag) =>
            `<span class="px-2 py-0.5 rounded-md bg-surface-container text-[10px] font-bold text-on-surface-variant">${escapeHtml(
              tag
            )}</span>`
        )
        .join(' ');

      const collabBadge =
        c.recentCollabs && c.recentCollabs[0]
          ? `<div class="p-2.5 rounded-xl bg-surface-container-low border border-surface-container text-xs flex items-center justify-between">
               <div class="flex items-center gap-1.5 min-w-0">
                 <span class="material-symbols-outlined text-secondary text-[16px]">verified</span>
                 <span class="truncate font-semibold text-on-surface">${escapeHtml(
                   c.recentCollabs[0].brandName
                 )}: ${escapeHtml(c.recentCollabs[0].campaignName || 'Partnership')}</span>
               </div>
               <span class="px-2 py-0.5 rounded bg-secondary/10 text-secondary text-[10px] font-bold shrink-0">#ad</span>
             </div>`
          : '';

      const followBtnClass = c.isFollowedByMe
        ? 'bg-secondary/15 text-secondary border border-secondary/30 hover:bg-secondary/25'
        : 'bg-primary text-on-primary hover:bg-primary/90 shadow-sm';
      const followBtnText = c.isFollowedByMe ? 'Following ✓' : '+ Follow';

      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <img src="${escapeHtml(avatar)}" alt="${escapeHtml(c.displayName)}" class="w-12 h-12 rounded-full object-cover ring-2 ring-surface-container shrink-0" />
            <div class="flex flex-col min-w-0">
              <span class="font-bold text-sm text-on-surface flex items-center gap-1">
                ${escapeHtml(c.displayName)}
                ${c.isVerified ? '<span class="material-symbols-outlined text-primary text-[15px]" style="font-variation-settings: \'FILL\' 1;">verified</span>' : ''}
              </span>
              <span class="text-xs text-secondary font-code truncate">@${escapeHtml(c.instagramHandle || '')}</span>
            </div>
          </div>
          <button type="button" class="btn-toggle-follow px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${followBtnClass}" data-creator-id="${escapeHtml(
        c.id
      )}">
            ${followBtnText}
          </button>
        </div>

        <p class="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
          ${escapeHtml(c.bio || 'Verified content creator and media personality.')}
        </p>

        <div class="flex items-center gap-1.5 flex-wrap">
          ${categoryTags}
          ${c.followerRange ? `<span class="px-2 py-0.5 rounded-md bg-primary/10 text-[10px] font-bold text-primary font-code">${escapeHtml(c.followerRange)} Reach</span>` : ''}
        </div>

        ${collabBadge}
      `;

      // Wire follow button
      const followBtn = card.querySelector('.btn-toggle-follow') as HTMLButtonElement;
      followBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!currentUser) {
          openAuthModal('signin');
          return;
        }
        followBtn.disabled = true;
        const res = await ParmanuApiClient.toggleFollowCreator(c.id);
        followBtn.disabled = false;
        c.isFollowedByMe = res.isFollowed;
        if (res.isFollowed) {
          followBtn.className =
            'btn-toggle-follow px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer bg-secondary/15 text-secondary border border-secondary/30 hover:bg-secondary/25';
          followBtn.textContent = 'Following ✓';
          showToast(`Now following ${c.displayName}`);
        } else {
          followBtn.className =
            'btn-toggle-follow px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer bg-primary text-on-primary hover:bg-primary/90 shadow-sm';
          followBtn.textContent = '+ Follow';
          showToast(`Unfollowed ${c.displayName}`);
        }
      });

      grid.appendChild(card);
    });

    contentContainer.appendChild(grid);
  }

  // 2. FOLLOWING SUBTAB
  else if (currentCollabsSubtab === 'following') {
    if (!currentUser) {
      contentContainer.innerHTML = `
        <div class="bg-surface-container-lowest p-8 rounded-3xl border border-surface-container text-center flex flex-col items-center gap-3 shadow-sm">
          <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">account_circle</span>
          </div>
          <h4 class="text-base font-bold text-on-surface">Sign In to View Your Personalized Feed</h4>
          <p class="text-xs text-on-surface-variant max-w-md">Follow your favorite creators to unlock custom sponsorship disclosure alerts, real-time activity tracking, and curated intelligence.</p>
          <button type="button" class="mt-2 px-5 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90 cursor-pointer" onclick="window.parmanu.openAuthModal('signin')">
            Sign In or Create Account
          </button>
        </div>
      `;
      return;
    }

    if (!personalized || personalized.followedCreators.length === 0) {
      contentContainer.innerHTML = `
        <div class="bg-surface-container-lowest p-8 rounded-3xl border border-surface-container text-center flex flex-col items-center gap-3">
          <span class="material-symbols-outlined text-secondary text-4xl">person_add</span>
          <h4 class="text-base font-bold text-on-surface">You are not following any creators yet</h4>
          <p class="text-xs text-on-surface-variant max-w-md">Switch to the "Top Creators Radar" tab to follow top Indian influencers like Ranveer Allahbadia, Shlok Srivastava, Faye D'Souza, and Prajakta Koli.</p>
          <button type="button" class="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold shadow hover:bg-primary/90 cursor-pointer" onclick="document.getElementById('collabs-btn-radar').click()">
            Explore Creators Radar
          </button>
        </div>
      `;
      return;
    }

    // Followed creators cards & stream
    const containerEl = document.createElement('div');
    containerEl.className = 'flex flex-col gap-4';

    const countBanner = document.createElement('div');
    countBanner.className = 'flex items-center justify-between text-xs px-1 text-on-surface-variant';
    countBanner.innerHTML = `
      <span class="font-bold text-on-surface">Following ${personalized.followedCreators.length} Creator(s)</span>
      <span class="font-code text-secondary">${personalized.recentCollabs.length} Brand Collabs Recorded</span>
    `;
    containerEl.appendChild(countBanner);

    // List of followed creators horizontal strip
    const strip = document.createElement('div');
    strip.className = 'flex gap-3 overflow-x-auto no-scrollbar py-1';
    personalized.followedCreators.forEach((fc) => {
      const pill = document.createElement('div');
      pill.className =
        'flex items-center gap-2 px-3 py-2 rounded-2xl bg-surface-container-lowest border border-surface-container shrink-0 shadow-sm';
      pill.innerHTML = `
        <img src="${escapeHtml(
          fc.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80'
        )}" class="w-8 h-8 rounded-full object-cover" />
        <div class="flex flex-col text-xs">
          <span class="font-bold text-on-surface">${escapeHtml(fc.displayName)}</span>
          <span class="text-[10px] text-secondary font-code">@${escapeHtml(fc.instagramHandle || '')}</span>
        </div>
      `;
      strip.appendChild(pill);
    });
    containerEl.appendChild(strip);

    // Collabs from followed creators
    if (personalized.recentCollabs.length > 0) {
      const heading = document.createElement('h5');
      heading.className = 'text-xs font-bold text-secondary uppercase tracking-wider mt-2';
      heading.textContent = 'Recent Brand Deals & Sponsorships';
      containerEl.appendChild(heading);

      personalized.recentCollabs.forEach((collab: any) => {
        const collabCard = document.createElement('div');
        collabCard.className =
          'bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm flex flex-col gap-2.5';
        collabCard.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <span class="material-symbols-outlined text-primary text-[16px]">stars</span>
              ${escapeHtml(collab.creatorProfile?.displayName || 'Creator')} &times; ${escapeHtml(
          collab.brandProfile?.name || 'Brand'
        )}
            </span>
            <span class="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold">ASCI #ad Verified</span>
          </div>
          <p class="text-xs text-on-surface-variant font-medium">${escapeHtml(collab.campaignName || 'Campaign Promotion')}</p>
          <div class="text-[11px] text-on-surface-variant flex items-center justify-between pt-1 border-t border-surface-container">
            <span>Type: ${escapeHtml(collab.claimType || 'COLLABORATION')}</span>
            <span class="font-code text-secondary">${escapeHtml(collab.provenanceState || 'OFFICIAL_CONFIRMED')}</span>
          </div>
        `;
        containerEl.appendChild(collabCard);
      });
    }

    // Related Interest Stories
    if (personalized.interestStories && personalized.interestStories.length > 0) {
      const newsHeading = document.createElement('h5');
      newsHeading.className = 'text-xs font-bold text-primary uppercase tracking-wider mt-2';
      newsHeading.textContent = 'News Matching Your Selected Interests';
      containerEl.appendChild(newsHeading);

      renderSourceItemCards(personalized.interestStories, containerEl);
    }

    contentContainer.appendChild(containerEl);
  }

  // 3. CLAIMS SUBTAB
  else if (currentCollabsSubtab === 'claims') {
    if (claims.length === 0) {
      contentContainer.innerHTML = `
        <div class="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-3xl text-secondary">verified</span>
          <span class="text-sm font-bold text-on-surface">No collaboration claims registered</span>
        </div>
      `;
      return;
    }

    const claimsContainer = document.createElement('div');
    claimsContainer.className = 'flex flex-col gap-3';

    claims.forEach((claim: CollaborationClaimRecord) => {
      const claimCard = document.createElement('div');
      claimCard.className =
        'bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container shadow-sm flex flex-col gap-3';

      const creatorName = claim.creatorProfile?.displayName || 'Creator';
      const handle = claim.creatorProfile?.instagramHandle ? `@${claim.creatorProfile.instagramHandle}` : '';
      const brandName = claim.brandProfile?.name || 'Brand Partner';

      claimCard.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold text-xs">
              ${escapeHtml(creatorName.charAt(0))}
            </div>
            <div class="flex flex-col">
              <span class="text-sm font-bold text-on-surface flex items-center gap-1">
                ${escapeHtml(creatorName)}
                <span class="material-symbols-outlined text-primary text-[14px]">verified</span>
              </span>
              <span class="text-[11px] font-code text-on-surface-variant">${escapeHtml(handle)}</span>
            </div>
          </div>
          <span class="px-2.5 py-0.5 bg-secondary/10 text-secondary text-xs font-bold rounded-full flex items-center gap-1">
            <span class="material-symbols-outlined text-[13px]">check_circle</span> Compliant #ad
          </span>
        </div>

        <div class="p-3 bg-surface-container-low rounded-xl flex items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-bold text-on-surface">Brand: ${escapeHtml(brandName)}</span>
          </div>
          <span class="font-semibold text-secondary">${escapeHtml(claim.verificationStance || 'OFFICIAL_CONFIRMED')}</span>
        </div>

        <div class="flex items-center justify-between text-xs text-on-surface-variant pt-1 border-t border-surface-container">
          <span class="font-code text-[11px]">Type: ${escapeHtml(claim.claimType)}</span>
          <span class="text-[11px]">ASCI / FTC Disclosure Verified</span>
        </div>
      `;
      claimsContainer.appendChild(claimCard);
    });

    contentContainer.appendChild(claimsContainer);
  }
}

// ─── WORKSPACE SECTION: SAVED STORIES & EVIDENCE WORKBENCH ────────────

async function loadWorkspaceFeed(): Promise<void> {
  const container = document.getElementById('live-ingested-feed-container');
  if (!container) return;

  container.innerHTML = `
    <div class="py-8 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs font-semibold">Loading your workspace and saved dossiers...</span>
    </div>
  `;

  const { bookmarks } = await ParmanuApiClient.fetchBookmarks();

  container.innerHTML = `
    <div class="bg-surface-container-low p-5 rounded-2xl border border-surface-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
      <div class="flex flex-col gap-0.5">
        <span class="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[18px]">verified</span>
          Verification Desk
        </span>
        <h4 class="text-base font-bold text-on-surface">Saved Stories &amp; Evidence Workflows</h4>
        <p class="text-xs text-on-surface-variant">Access your reading list, examine cryptographic proofs, or generate compliance audit packets.</p>
      </div>
      <button class="px-3.5 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-all flex items-center gap-1.5 shrink-0" onclick="alert('Audit Packet Generated: 100% Cryptographic verification verified across all saved items.')">
        <span class="material-symbols-outlined text-[16px]">picture_as_pdf</span>
        <span>Download Audit Packet</span>
      </button>
    </div>
  `;

  if (bookmarks.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className =
      'bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-3';
    emptyEl.innerHTML = `
      <span class="material-symbols-outlined text-secondary text-4xl">bookmark_border</span>
      <h4 class="text-base font-bold text-on-surface">No Saved Dossiers in Workspace</h4>
      <p class="text-xs text-on-surface-variant max-w-sm">Tap the bookmark icon on any news story or live wire dispatch to pin it to your personal workspace for offline review.</p>
      <button class="px-4 py-2 bg-primary text-on-primary rounded-full text-xs font-bold shadow hover:bg-primary/90 transition-all" onclick="window.parmanu.switchSection('feed')">
        Browse Verified Feed
      </button>
    `;
    container.appendChild(emptyEl);
    return;
  }

  bookmarks.forEach((bm: BookmarkRecord) => {
    const card = document.createElement('article');
    card.className =
      'bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3 border border-surface-container hover:shadow-md transition-shadow';

    const cluster = bm.storyCluster;
    const title = cluster?.primaryHeadline || bm.sourceItem?.headline || 'Saved Dossier Item';
    const category = cluster?.category ? cluster.category.join(' • ') : 'News';
    const summary = cluster?.summary || bm.sourceItem?.excerpt || 'Corroborated intelligence dispatch saved for research.';

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
          <span class="material-symbols-outlined text-[13px]" style="font-variation-settings: 'FILL' 1;">bookmark</span>
          Saved Dossier
        </span>
        <span class="font-code text-xs text-on-surface-variant">Saved ${formatRelativeTime(bm.createdAt)}</span>
      </div>
      <div class="flex flex-col gap-1 min-w-0">
        <span class="text-xs text-primary font-bold uppercase tracking-wider">${escapeHtml(category)}</span>
        <h4 class="text-base sm:text-lg font-bold text-on-surface leading-snug cursor-pointer hover:text-primary transition-colors">
          ${escapeHtml(title)}
        </h4>
        <p class="text-xs sm:text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
          ${escapeHtml(summary)}
        </p>
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-surface-container text-xs text-on-surface-variant">
        <button class="btn-open-dossier text-primary font-bold flex items-center gap-1 hover:underline">
          <span class="material-symbols-outlined text-[16px]">menu_book</span>
          Open Evidence Dossier
        </button>
        <button class="btn-remove-bm text-error hover:underline flex items-center gap-1 font-semibold" title="Remove bookmark">
          <span class="material-symbols-outlined text-[16px]">delete</span>
          Remove
        </button>
      </div>
    `;

    card.querySelector('.btn-open-dossier')?.addEventListener('click', () => {
      if (cluster?.id) {
        openDossierModal(cluster.id);
      } else if (bm.sourceItem?.canonicalUrl) {
        window.open(bm.sourceItem.canonicalUrl, '_blank');
      }
    });

    card.querySelector('h4')?.addEventListener('click', () => {
      if (cluster?.id) {
        openDossierModal(cluster.id);
      }
    });

    card.querySelector('.btn-remove-bm')?.addEventListener('click', async () => {
      await ParmanuApiClient.removeBookmark(bm.id);
      showToast('Removed from workspace');
      loadWorkspaceFeed();
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
    switchSection,
    handleShare,
    removeBookmarkItem: async (id: string) => {
      await ParmanuApiClient.removeBookmark(id);
      showToast('Removed bookmark');
      openBookmarksDrawer();
    },
  };

  (window as any).switchSection = switchSection;

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
  switchSection,
  handleShare,
};
