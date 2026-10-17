var pe=Object.defineProperty;var ue=(a,e,t)=>e in a?pe(a,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):a[e]=t;var te=(a,e,t)=>ue(a,typeof e!="symbol"?e+"":e,t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&n(r)}).observe(document,{childList:!0,subtree:!0});function t(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function n(s){if(s.ep)return;s.ep=!0;const o=t(s);fetch(s.href,o)}})();const _={};class x{static getToken(){try{return localStorage.getItem(this.tokenKey)}catch{return null}}static setToken(e){try{localStorage.setItem(this.tokenKey,e)}catch{}}static clearToken(){try{localStorage.removeItem(this.tokenKey)}catch{}}static apiUrl(e){return`${((_==null?void 0:_.VITE_API_URL)||"").replace(/\/$/,"")}${e}`}static getHeaders(){const e={"Content-Type":"application/json"},t=this.getToken();return t&&(e.Authorization=`Bearer ${t}`),e}static async fetchFeaturedStory(){try{const e=await fetch(this.apiUrl("/api/v1/stories/featured"),{headers:this.getHeaders()});if(!e.ok)return null;const t=await e.json();return t.success?t.data:null}catch(e){return console.error("Failed to fetch featured story",e),null}}static async fetchTrendingStories(e,t=10){try{const n=new URLSearchParams;e&&e!=="ALL"&&n.set("category",e),n.set("limit",String(t));const s=await fetch(this.apiUrl(`/api/v1/stories/trending?${n.toString()}`),{headers:this.getHeaders()});if(!s.ok)return[];const o=await s.json();return o.success?o.data:[]}catch(n){return console.error("Failed to fetch trending stories",n),[]}}static async fetchStoryClusters(e){var t;try{const n=new URLSearchParams;e.category&&e.category!=="ALL"&&n.set("category",e.category),e.page&&n.set("page",String(e.page)),e.limit&&n.set("limit",String(e.limit)),e.search&&n.set("search",e.search);const s=await fetch(this.apiUrl(`/api/v1/clusters?${n.toString()}`),{headers:this.getHeaders()});if(!s.ok)return{clusters:[],total:0};const o=await s.json();return{clusters:o.data||[],total:((t=o.meta)==null?void 0:t.total)||0}}catch(n){return console.error("Failed to fetch story clusters",n),{clusters:[],total:0}}}static async fetchStoryDetail(e){try{const t=await fetch(this.apiUrl(`/api/v1/clusters/${encodeURIComponent(e)}`),{headers:this.getHeaders()});if(!t.ok)return null;const n=await t.json();return n.success?n.data:null}catch(t){return console.error(`Failed to fetch story cluster ${e}`,t),null}}static async fetchCategories(){try{const e=await fetch(this.apiUrl("/api/v1/categories"),{headers:this.getHeaders()});if(e.ok){const t=await e.json();if(t.success&&Array.isArray(t.data))return t.data}}catch(e){console.error("Failed to fetch categories",e)}return[]}static async fetchLiveDispatches(e=10,t){try{const n=new URLSearchParams;n.set("limit",String(e)),t&&t!=="all"&&t!=="ALL"&&n.set("category",t);const s=await fetch(this.apiUrl(`/api/v1/news?${n.toString()}`),{headers:this.getHeaders()});return s.ok?(await s.json()).data||[]:[]}catch(n){return console.error("Failed to fetch live dispatches",n),[]}}static async fetchCollaborationClaims(){try{const e=await fetch(this.apiUrl("/api/v1/collaboration/claims"),{headers:this.getHeaders()});return e.ok?(await e.json()).data||[]:[]}catch(e){return console.error("Failed to fetch collaboration claims",e),[]}}static async search(e,t,n=1){try{const s=new URLSearchParams;s.set("q",e),t&&t!=="ALL"&&s.set("category",t),s.set("page",String(n));const o=await fetch(this.apiUrl(`/api/v1/search?${s.toString()}`),{headers:this.getHeaders()});if(!o.ok)return{clusters:[],entities:[]};const r=await o.json();return r.success?r.data:{clusters:[],entities:[]}}catch(s){return console.error("Failed to execute search",s),{clusters:[],entities:[]}}}static async fetchBookmarks(e=1,t=20){var n;try{const s=await fetch(this.apiUrl(`/api/v1/bookmarks?page=${e}&limit=${t}`),{headers:this.getHeaders()});if(!s.ok)return{bookmarks:[],total:0};const o=await s.json();return{bookmarks:o.data||[],total:((n=o.meta)==null?void 0:n.total)||0}}catch(s){return console.error("Failed to fetch bookmarks",s),{bookmarks:[],total:0}}}static async checkBookmark(e){var t;try{const n=await fetch(this.apiUrl(`/api/v1/bookmarks/check/${encodeURIComponent(e)}`),{headers:this.getHeaders()});if(!n.ok)return!1;const s=await n.json();return!!((t=s==null?void 0:s.data)!=null&&t.isBookmarked)}catch{return!1}}static async saveBookmark(e){try{return(await fetch(this.apiUrl("/api/v1/bookmarks"),{method:"POST",headers:this.getHeaders(),body:JSON.stringify(e)})).ok}catch(t){return console.error("Failed to save bookmark",t),!1}}static async removeBookmark(e){try{return(await fetch(this.apiUrl(`/api/v1/bookmarks/${encodeURIComponent(e)}`),{method:"DELETE",headers:this.getHeaders()})).ok}catch(t){return console.error("Failed to remove bookmark",t),!1}}static async getCurrentUser(){try{if(!this.getToken())return null;const t=await fetch(this.apiUrl("/api/v1/auth/me"),{headers:this.getHeaders()});if(!t.ok)return this.clearToken(),null;const n=await t.json();return n.success?n.data:null}catch{return null}}static async login(e,t){try{const n=await fetch(this.apiUrl("/api/v1/auth/login"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:t})}),s=await n.json();return!n.ok||!s.success?{success:!1,error:s.error||"Invalid credentials"}:(this.setToken(s.data.token),{success:!0,user:s.data.user})}catch(n){return{success:!1,error:n.message||"Network error"}}}static async register(e,t,n,s){var o,r;try{const d=await fetch(this.apiUrl("/api/v1/auth/register"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:t,name:n,interests:s})}),p=await d.json();return!d.ok||!p.success?{success:!1,error:p.error||((r=(o=p.details)==null?void 0:o[0])==null?void 0:r.message)||"Registration failed"}:(this.setToken(p.data.token),{success:!0,user:p.data.user})}catch(d){return{success:!1,error:d.message||"Network error"}}}static async fetchCreators(){try{const e=await fetch(this.apiUrl("/api/v1/creators"),{headers:this.getHeaders()});return e.ok?(await e.json()).data||[]:[]}catch(e){return console.error("Failed to fetch creators",e),[]}}static async toggleFollowCreator(e){var t;try{const s=await(await fetch(this.apiUrl(`/api/v1/creators/${encodeURIComponent(e)}/follow`),{method:"POST",headers:this.getHeaders()})).json();return{isFollowed:!!((t=s.data)!=null&&t.isFollowed),message:s.message||""}}catch(n){return console.error("Failed to toggle follow creator",n),{isFollowed:!1,message:"Request failed"}}}static async fetchPersonalizedFeed(){try{const e=await fetch(this.apiUrl("/api/v1/user/personalized-feed"),{headers:this.getHeaders()});if(!e.ok)return null;const t=await e.json();return t.success?t.data:null}catch(e){return console.error("Failed to fetch personalized feed",e),null}}static async updateUserInterests(e){try{return(await fetch(this.apiUrl("/api/v1/user/interests"),{method:"PUT",headers:this.getHeaders(),body:JSON.stringify({categories:e})})).ok}catch{return!1}}}te(x,"tokenKey","parmanu_auth_token");let T="feed",S="all",R=null,v=null,ae=null,V=[];function L(a,e=3e3){let t=document.getElementById("parmanu-toast-container");t||(t=document.createElement("div"),t.id="parmanu-toast-container",t.className="fixed bottom-20 md:bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none",document.body.appendChild(t));const n=document.createElement("div");n.className="bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto",n.innerHTML=`
    <span class="material-symbols-outlined text-[16px] text-secondary">info</span>
    <span>${i(a)}</span>
  `,t.appendChild(n),requestAnimationFrame(()=>{n.classList.remove("translate-y-2","opacity-0")}),setTimeout(()=>{n.classList.add("translate-y-2","opacity-0"),setTimeout(()=>n.remove(),300)},e)}function i(a){return a?a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}function P(a){const e=new Date(a),n=Math.floor((new Date().getTime()-e.getTime())/1e3);return n<60?"Just now":n<3600?`${Math.floor(n/60)}m ago`:n<86400?`${Math.floor(n/3600)}h ago`:`${Math.floor(n/86400)}d ago`}function ne(){const a=new Date,e={timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:!1},t={timeZone:"Asia/Kolkata",weekday:"long",month:"short",day:"numeric"},n=a.toLocaleTimeString("en-GB",e),s=a.toLocaleDateString("en-US",t),o=document.getElementById("live-time-ticker"),r=document.getElementById("current-date-heading");o&&(o.textContent=`Live ${n} IST`),r&&(r.textContent=s)}document.addEventListener("DOMContentLoaded",async()=>{console.log("[Parmanu] Initializing Phase 3.1 Consumer Platform..."),ne(),setInterval(ne,1e4),ke(),he(),we(),Le(),fe(),me(),xe(),ge(),window.parmanu={selectCategory:A,openAuthModal:I,openProfileModal:z,switchSection:C,loadCollabsFeed:j},v=await x.getCurrentUser(),F(),await Promise.all([ye(),se(),oe(),W(),K()]);const a=window.location.hash.replace("#","").toLowerCase();v?["about","feed","pulse","explore","collabs","workspace"].includes(a)?await C(a,!1):await C("feed",!1):await C("about",!1),setInterval(async()=>{await Promise.all([oe(),W(),se(),K()]),T==="pulse"?await ie():T==="feed"?await J():T==="collabs"&&await j()},3e4);const e=new URLSearchParams(window.location.search),t=e.get("story"),n=e.get("category");n&&A(n,!1),t&&B(t)});function fe(){document.querySelectorAll("#desktop-nav .nav-link").forEach(a=>{a.addEventListener("click",e=>{e.preventDefault();const t=a.getAttribute("data-section")||"feed";C(t)})}),document.querySelectorAll("#nav-tabs .nav-tab").forEach(a=>{a.addEventListener("click",e=>{e.preventDefault();const t=a.getAttribute("data-path")||"feed";C(t)})}),document.querySelectorAll('header a[href="#"], header a[href="#feed"]').forEach(a=>{a.addEventListener("click",e=>{e.preventDefault(),C(v?"feed":"about")})}),window.addEventListener("hashchange",()=>{const a=window.location.hash.replace("#","").toLowerCase();["about","feed","pulse","explore","collabs","workspace"].includes(a)&&T!==a&&C(a,!1)})}async function C(a,e=!0){let n=["about","feed","pulse","explore","collabs","workspace"].includes(a)?a:v?"feed":"about";!v&&n!=="about"&&(n="about",I("signin"),L("Please sign in or create an account to access the dashboard.")),T=n,e&&(window.location.hash=`#${n}`),document.querySelectorAll("#desktop-nav .nav-link").forEach(m=>{m.getAttribute("data-section")===n?m.className="nav-link px-3.5 py-1.5 rounded-full text-sm font-semibold text-primary bg-primary/10 transition-colors shadow-xs":m.className="nav-link px-3.5 py-1.5 rounded-full text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"}),document.querySelectorAll("#nav-tabs .nav-tab").forEach(m=>{m.getAttribute("data-path")===n?(m.classList.remove("text-on-surface-variant"),m.classList.add("text-primary","font-bold")):(m.classList.remove("text-primary","font-bold"),m.classList.add("text-on-surface-variant"))});const s=document.getElementById("landing-page-view"),o=document.getElementById("dashboard-view"),r=document.getElementById("user-personalized-header");if(n==="about"){s&&s.classList.remove("hidden"),o&&o.classList.add("hidden"),window.scrollTo({top:0,behavior:"smooth"});return}s&&s.classList.add("hidden"),o&&o.classList.remove("hidden"),v?r&&r.classList.remove("hidden"):r&&r.classList.add("hidden");const d=document.getElementById("hero-lead-article"),p=document.getElementById("category-pills-section"),u=document.getElementById("feed-section-heading"),l=document.getElementById("feed-section-subheading"),c=document.getElementById("feed-section-description");n==="feed"?(d&&d.classList.remove("hidden"),p&&p.classList.remove("hidden"),u&&(u.textContent="Verified Dispatch Feed"),l&&(l.textContent="All Fields • Corroborated"),c&&(c.textContent="Multi-source corroborated reporting across national and global newsrooms."),await J()):n==="pulse"?(d&&d.classList.add("hidden"),p&&p.classList.add("hidden"),u&&(u.textContent="⚡ Real-Time Pulse & Breaking Wire"),l&&(l.textContent="Live Wire • Ingesting"),c&&(c.textContent="Direct teleprinter stream from verified news bureaus, gazettes, and official wires."),await ie()):n==="explore"?(d&&d.classList.add("hidden"),p&&p.classList.remove("hidden"),u&&(u.textContent="🧭 Explore Stories by Topic"),l&&(l.textContent="Curated Categories"),c&&(c.textContent="Deep-dive into verified reporting filtered by policy, technology, creator economy, climate, and more."),await Z()):n==="collabs"?(d&&d.classList.add("hidden"),p&&p.classList.add("hidden"),u&&(u.textContent="🤝 Creator Economy & Brand Radar"),l&&(l.textContent="Audited Intelligence"),c&&(c.textContent="Verified creator sponsorships, ASCI/FTC disclosure compliance (#ad), and digital media intelligence."),await j()):n==="workspace"&&(d&&d.classList.add("hidden"),p&&p.classList.add("hidden"),u&&(u.textContent="📋 Dossier Workspace & Saved Stories"),l&&(l.textContent="Personal Desk"),c&&(c.textContent="Your saved intelligence dossiers, cryptographic audit packets, and multi-source evidence chains."),await le())}function me(){window.addEventListener("popstate",()=>{const a=new URLSearchParams(window.location.search),e=a.get("story"),t=a.get("category")||"all";A(t,!1),e?B(e,!1):H(!1)})}function G(a){const e=new URL(window.location.href);a.category!==void 0&&(a.category==="all"?e.searchParams.delete("category"):e.searchParams.set("category",a.category)),a.story!==void 0&&(a.story?e.searchParams.set("story",a.story):e.searchParams.delete("story")),window.history.pushState({},"",e.toString())}function F(){var p;const a=document.getElementById("user-auth-badge"),e=document.getElementById("user-personalized-header"),t=document.getElementById("dash-user-greeting"),n=document.getElementById("dash-user-avatar"),s=document.getElementById("dash-user-interest-tags"),o=document.getElementById("desktop-nav"),r=document.getElementById("mobile-nav-bar"),d=document.getElementById("btn-mobile-open-auth");if(v){const u=v.name||v.fullName||v.email.split("@")[0];if(a&&(a.innerHTML=`
        <div class="flex items-center gap-2">
          <button onclick="window.openProfileModal()" type="button" class="text-xs font-semibold text-primary hover:underline truncate max-w-[120px] cursor-pointer">${i(u)}</button>
          <button id="btn-logout" class="text-xs text-error hover:underline font-bold cursor-pointer">Logout</button>
        </div>
      `,(p=document.getElementById("btn-logout"))==null||p.addEventListener("click",async()=>{x.clearToken(),v=null,F(),L("Logged out successfully"),await C("about")})),d&&d.classList.add("hidden"),o&&o.querySelectorAll("[data-section]").forEach(l=>{l.classList.remove("hidden")}),r&&r.classList.remove("hidden"),t&&(t.textContent=`Welcome back, ${u}!`),n&&(n.textContent=u.charAt(0).toUpperCase()),s){const l=v.interests||["creator","policy","culture"];s.innerHTML=l.map(c=>`<span class="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface text-[11px] font-semibold border border-surface-container-high">${i(c.toUpperCase())}</span>`).join("")}e&&T!=="about"&&e.classList.remove("hidden")}else a&&(a.innerHTML=`
        <button id="btn-open-auth" onclick="window.openAuthModal('signin')" type="button" class="flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary/90 transition-all shadow-sm cursor-pointer">
          <span class="material-symbols-outlined text-[16px]">account_circle</span>
          <span>Sign In</span>
        </button>
      `),d&&d.classList.remove("hidden"),o&&o.querySelectorAll("[data-section]").forEach(u=>{const l=u.getAttribute("data-section");l&&l!=="about"?u.classList.add("hidden"):u.classList.remove("hidden")}),r&&r.classList.add("hidden"),e&&e.classList.add("hidden")}function I(a="signin"){H(!1);const e=document.getElementById("auth-modal"),t=document.getElementById("global-backdrop");if(!e||!t)return;const n=document.getElementById("auth-error-box"),s=document.getElementById("auth-success-box");n&&n.classList.add("hidden"),s&&s.classList.add("hidden"),M(a),e.classList.remove("hidden","translate-y-full","pointer-events-none","md:opacity-0","md:scale-95"),e.classList.add("block","translate-y-0","pointer-events-auto","md:opacity-100","md:scale-100"),t.classList.remove("hidden")}function z(){if(!v){I("signin");return}H(!1);const a=document.getElementById("user-profile-modal"),e=document.getElementById("global-backdrop");if(!a||!e)return;const t=document.getElementById("profile-modal-name"),n=document.getElementById("profile-modal-email"),s=document.getElementById("profile-modal-avatar"),o=document.getElementById("profile-modal-following-count"),r=document.getElementById("profile-modal-interests-count"),d=v.name||v.fullName||v.email.split("@")[0];t&&(t.textContent=d),n&&(n.textContent=v.email),s&&(s.textContent=d.charAt(0).toUpperCase()),x.fetchPersonalizedFeed().then(p=>{p&&p.stats&&(o&&(o.textContent=String(p.stats.followedCount)),r&&(r.textContent=String(p.stats.interestCount)))}),a.classList.remove("hidden","translate-y-full","pointer-events-none"),a.classList.add("block","translate-y-0","pointer-events-auto","md:opacity-100","md:scale-100"),e.classList.remove("hidden")}function M(a){const e=document.getElementById("auth-tab-signin"),t=document.getElementById("auth-tab-register"),n=document.getElementById("form-signin"),s=document.getElementById("form-register"),o=document.getElementById("auth-error-box");o&&o.classList.add("hidden"),a==="signin"?(e==null||e.classList.remove("text-on-surface-variant"),e==null||e.classList.add("bg-primary","text-on-primary","font-bold"),t==null||t.classList.remove("bg-primary","text-on-primary","font-bold"),t==null||t.classList.add("text-on-surface-variant"),n==null||n.classList.remove("hidden"),s==null||s.classList.add("hidden")):(t==null||t.classList.remove("text-on-surface-variant"),t==null||t.classList.add("bg-primary","text-on-primary","font-bold"),e==null||e.classList.remove("bg-primary","text-on-primary","font-bold"),e==null||e.classList.add("text-on-surface-variant"),s==null||s.classList.remove("hidden"),n==null||n.classList.add("hidden"))}function xe(){var a,e,t,n,s,o,r,d,p,u,l,c,m;(a=document.getElementById("btn-open-auth"))==null||a.addEventListener("click",()=>{I("signin")}),(e=document.getElementById("btn-mobile-open-auth"))==null||e.addEventListener("click",()=>{I("signin")}),(t=document.getElementById("hero-btn-signin"))==null||t.addEventListener("click",()=>{I("signin")}),(n=document.getElementById("hero-btn-register"))==null||n.addEventListener("click",()=>{I("register")}),(s=document.getElementById("cta-btn-signin"))==null||s.addEventListener("click",()=>{I("signin")}),(o=document.getElementById("cta-btn-register"))==null||o.addEventListener("click",()=>{I("register")}),(r=document.getElementById("auth-tab-signin"))==null||r.addEventListener("click",()=>M("signin")),(d=document.getElementById("auth-tab-register"))==null||d.addEventListener("click",()=>M("register")),(p=document.getElementById("link-to-register"))==null||p.addEventListener("click",()=>M("register")),(u=document.getElementById("link-to-signin"))==null||u.addEventListener("click",()=>M("signin")),(l=document.getElementById("form-signin"))==null||l.addEventListener("submit",async f=>{var y;f.preventDefault();const g=document.getElementById("signin-email"),b=document.getElementById("signin-password"),w=document.getElementById("auth-error-box"),k=document.getElementById("auth-error-msg"),h=document.getElementById("btn-submit-signin");if(!g||!b)return;h.disabled=!0,h.textContent="Verifying Credentials...";const E=await x.login(g.value.trim(),b.value);h.disabled=!1,h.innerHTML='<span class="material-symbols-outlined text-[16px]">login</span><span>Sign In to Parmanu</span>',E.success&&E.user?(v=E.user,F(),(y=window.closeAllModals)==null||y.call(window),L(`Welcome back, ${v.name||v.email}! Dashboard loaded.`),await C("feed")):w&&k&&(k.textContent=E.error||"Invalid email or password",w.classList.remove("hidden"))}),(c=document.getElementById("form-register"))==null||c.addEventListener("submit",async f=>{var ee;f.preventDefault();const g=document.getElementById("register-name"),b=document.getElementById("register-email"),w=document.getElementById("register-password"),k=document.getElementById("auth-error-box"),h=document.getElementById("auth-error-msg"),E=document.getElementById("btn-submit-register"),y=document.querySelectorAll('#register-interests-container input[type="checkbox"]:checked'),N=[];if(y.forEach(de=>{N.push(de.value)}),!b||!w)return;E.disabled=!0,E.textContent="Creating Account...";const U=await x.register(b.value.trim(),w.value,(g==null?void 0:g.value.trim())||void 0,N);E.disabled=!1,E.innerHTML='<span class="material-symbols-outlined text-[16px]">how_to_reg</span><span>Create Account & Unlock Feed</span>',U.success&&U.user?(v=U.user,F(),(ee=window.closeAllModals)==null||ee.call(window),L("Welcome to Parmanu! Your personalized dashboard is active."),await C("feed")):k&&h&&(h.textContent=U.error||"Failed to create account",k.classList.remove("hidden"))}),(m=document.getElementById("profile-modal-btn-logout"))==null||m.addEventListener("click",async()=>{var f;x.clearToken(),v=null,F(),(f=window.closeAllModals)==null||f.call(window),L("Logged out successfully"),await C("about")})}function ge(){document.querySelectorAll(".category-pill").forEach(a=>{a.addEventListener("click",e=>{const n=e.currentTarget.getAttribute("data-category")||"all";A(n)})})}async function ye(){const a=document.getElementById("category-pills");if(!a)return;const e=await x.fetchCategories();if(e.length===0)return;const t=S.toLowerCase();let n=`
    <button class="category-pill px-4 py-1.5 rounded-full ${t==="all"?"bg-primary text-on-primary shadow-sm":"bg-surface-container text-on-surface hover:bg-surface-variant"} text-xs font-bold shrink-0 transition-all active:scale-95" type="button" data-category="all">
      All Fields
    </button>
  `;e.forEach(r=>{const d=t===r.slug;n+=`
      <button class="category-pill px-4 py-1.5 rounded-full ${d?"bg-primary text-on-primary shadow-sm":"bg-surface-container text-on-surface hover:bg-surface-variant"} text-xs font-medium shrink-0 transition-all active:scale-95" type="button" data-category="${i(r.slug)}">
        ${i(r.name)} <span class="opacity-70 text-[11px]">(${r.count})</span>
      </button>
    `}),a.innerHTML=n;const s=e.reduce((r,d)=>r+d.count,0),o=document.getElementById("live-dossier-count");o&&s>0&&(o.textContent=`${s} Verified Dossiers`),a.querySelectorAll(".category-pill").forEach(r=>{r.addEventListener("click",d=>{const u=d.currentTarget.getAttribute("data-category")||"all";A(u)})})}async function W(){const a=document.getElementById("live-briefing-timeline"),e=document.getElementById("live-briefing-headline"),t=document.getElementById("btn-refresh-stream");if(!a)return;const n=await x.fetchLiveDispatches(4);n.length!==0&&(e&&n[0]&&(e.textContent=n[0].headline),a.innerHTML=n.map(s=>{var p;const o=new Date(s.publishedAt),r=isNaN(o.getTime())?"Live":o.toLocaleTimeString("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:!1}),d=((p=s.source)==null?void 0:p.name)||"Verified Wire";return`
        <div class="flex items-start gap-2.5">
          <span class="font-code text-xs font-bold text-primary shrink-0 mt-0.5">${r}</span>
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-[10px] font-bold text-secondary uppercase">${i(d)}</span>
            <a href="${i(s.canonicalUrl)}" target="_blank" rel="noopener noreferrer" class="text-xs text-on-surface hover:text-primary hover:underline leading-relaxed line-clamp-2">
              ${i(s.headline)}
            </a>
          </div>
        </div>
      `}).join(""),t&&!t.hasAttribute("data-bound")&&(t.setAttribute("data-bound","true"),t.addEventListener("click",async()=>{t.textContent="Updating...",await W(),t.textContent="Refresh Stream",L("Live briefing stream synchronized")})))}function A(a,e=!0){S=a,document.querySelectorAll(".category-pill").forEach(t=>{const n=t;n.getAttribute("data-category")===S?(n.classList.remove("bg-surface-container","text-on-surface"),n.classList.add("bg-primary","text-on-primary","shadow-sm")):(n.classList.remove("bg-primary","text-on-primary","shadow-sm"),n.classList.add("bg-surface-container","text-on-surface"))}),e&&G({category:S}),T==="explore"?Z():T==="feed"?J():C("explore",!1)}async function se(){var b,w,k,h,E;const a=document.getElementById("hero-lead-article")||document.querySelector("article.bg-surface-container-lowest");if(!a)return;const e=a.querySelector("h1.font-headline"),t=a.querySelector("p.text-sm, p.text-base"),n=document.getElementById("hero-veracity-desc")||a.querySelector(".bg-surface-container-low .text-xs.text-on-surface-variant"),s=document.getElementById("hero-status-pill"),o=document.getElementById("hero-source-count-badge"),r=document.getElementById("hero-time-ago"),d=document.getElementById("hero-category-tag"),p=document.getElementById("hero-author-name"),u=document.getElementById("hero-author-role"),l=a.querySelector('button[aria-label="Bookmark story"]'),c=a.querySelector('button[aria-label="Share story"]'),m=a.querySelector("button.bg-primary"),f=await x.fetchFeaturedStory();if(f){if(e&&(e.textContent=f.primaryHeadline),t&&(t.textContent=f.summary||"Corroborated intelligence report."),d){const y=Array.isArray(f.category)?f.category.join(" • "):f.category||"Verified News";d.textContent=y.toUpperCase()}if(n){const y=((b=f.items)==null?void 0:b.length)||1;n.textContent=`Grounded in ${y} verified source record(s). Triangulated confidence score: ${Math.round(f.confidenceScore*100)}%.`}s&&(s.innerHTML=`
        <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
        ${i(f.status)}
      `),o&&(o.textContent=`${f.itemCount} Sources Verified`),r&&(r.innerHTML=`<span class="material-symbols-outlined text-[15px]">schedule</span> ${P(f.publishedAt||f.lastObservedAt)}`),p&&(p.textContent="Parmanu Editorial Desk"),u&&(u.textContent="Multi-Source Triangulation"),l&&(l.onclick=async y=>{y.stopPropagation(),await Q(f.id,l)}),c&&(c.onclick=y=>{y.stopPropagation(),D(f.primaryHeadline)}),m&&(m.onclick=y=>{y.stopPropagation(),B(f.id)});return}const g=await x.fetchLiveDispatches(1);if(g.length>0){const y=g[0];e&&(e.textContent=y.headline),t&&(t.textContent=y.excerpt||"Real-time wire dispatch verified and fingerprinted by Parmanu ingestion engine."),d&&(d.textContent=(((w=y.source)==null?void 0:w.name)||"National Wire").toUpperCase()),n&&(n.textContent=`Grounded in verified wire report from ${((k=y.source)==null?void 0:k.name)||"Verified Bureau"}. Fingerprinted status: ${y.provenanceState}.`),s&&(s.innerHTML=`
        <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">sensors</span>
        Live Wire
      `),o&&(o.textContent=((h=y.source)==null?void 0:h.name)||"Wire Dispatch"),r&&(r.innerHTML=`<span class="material-symbols-outlined text-[15px]">schedule</span> ${P(y.publishedAt)}`),p&&(p.textContent=`${((E=y.source)==null?void 0:E.name)||"National"} Bureau`),u&&(u.textContent="Verified Ingestion Feed"),c&&(c.onclick=N=>{N.stopPropagation(),D(y.headline)}),m&&(m.onclick=N=>{N.stopPropagation(),window.open(y.canonicalUrl,"_blank","noopener,noreferrer")})}}async function oe(){var o;const a=document.getElementById("breaking-headline"),e=document.getElementById("breaking-source-badge"),t=document.getElementById("btn-view-breaking-trace"),n=await x.fetchTrendingStories(void 0,4);if(n.length>0){const r=n[0];a&&(a.textContent=r.primaryHeadline),e&&(e.innerHTML=`
        <span class="material-symbols-outlined text-[13px]">layers</span>
        ${r.itemCount} Sources
      `),t&&(t.onclick=d=>{d.stopPropagation(),B(r.id)});return}const s=await x.fetchLiveDispatches(1);if(s.length>0){const r=s[0];a&&(a.textContent=r.headline),e&&(e.innerHTML=`
        <span class="material-symbols-outlined text-[13px]">sensors</span>
        ${i(((o=r.source)==null?void 0:o.name)||"Wire")}
      `),t&&(t.onclick=d=>{d.stopPropagation(),window.open(r.canonicalUrl,"_blank","noopener,noreferrer")})}}async function K(){if(!document.getElementById("creator-spotlight-card"))return;const e=await x.fetchCreators();if(!e||e.length===0)return;const t=e[0],n=document.getElementById("spotlight-name"),s=document.getElementById("spotlight-handle"),o=document.getElementById("spotlight-bio"),r=document.getElementById("spotlight-avatar"),d=document.getElementById("spotlight-statement"),p=document.getElementById("spotlight-tags"),u=document.getElementById("spotlight-follow-btn");if(n&&(n.textContent=t.displayName),s&&(s.textContent=t.instagramHandle?`@${t.instagramHandle}`:"@creator"),o&&(o.textContent=t.bio||`${(t.followersCount||0).toLocaleString()} Verified Audience`),r&&(t.avatarUrl?r.innerHTML=`<img src="${i(t.avatarUrl)}" alt="${i(t.displayName)}" class="w-full h-full rounded-full object-cover">`:r.textContent=t.displayName.split(" ").map(l=>l[0]).join("").slice(0,2).toUpperCase()),d&&(d.textContent=t.bio||`Tracking brand deals, commercial disclosures, and editorial activity for ${t.displayName}.`),p){const l=Array.isArray(t.category)?t.category[0]||"Creator Economy":t.category||"Creator Economy";p.innerHTML=`
      <span class="px-2 py-0.5 bg-primary/10 text-primary rounded font-code text-[11px] flex items-center gap-1">
        <span class="material-symbols-outlined text-[13px]">verified</span> ${(t.followersCount||0).toLocaleString()} Followers
      </span>
      <span class="px-2 py-0.5 bg-surface-container-highest text-on-surface rounded font-code text-[11px] flex items-center gap-1">
        <span class="material-symbols-outlined text-[13px]">hub</span> ${i(l)}
      </span>
    `}u&&(u.innerHTML=`
      <span class="material-symbols-outlined text-[16px]">${t.isFollowedByMe?"check":"person_add"}</span>
      <span>${t.isFollowedByMe?"Following on Parmanu":"Follow & Track Collabs"}</span>
    `,u.onclick=async()=>{if(!v){I("signin");return}const l=await x.toggleFollowCreator(t.id);t.isFollowedByMe=l.isFollowed,L(l.isFollowed?`Following ${t.displayName}! Added to your personalized feed.`:`Unfollowed ${t.displayName}`),K()})}async function J(){const a=document.getElementById("live-ingested-feed-container");if(!a)return;a.innerHTML=`
    <div class="py-8 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs font-semibold">Retrieving verified dispatches...</span>
    </div>
  `;const{clusters:e}=await x.fetchStoryClusters({category:S==="all"?void 0:S,limit:20});if(e.length===0){const t=await x.fetchLiveDispatches(20,S==="all"?void 0:S);if(t.length>0){a.innerHTML=`
        <div class="flex items-center justify-between mb-3 px-1">
          <span class="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px]">verified</span>
            Live Verified Dispatches • ${i(S.toUpperCase())}
          </span>
          <span class="text-xs text-on-surface-variant font-code">${t.length} Articles</span>
        </div>
      `,Y(t,a);return}a.innerHTML=`
      <div class="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-secondary text-4xl">folder_open</span>
        <h4 class="text-base font-bold text-on-surface">No verified stories in this category yet</h4>
        <p class="text-xs text-on-surface-variant max-w-sm">Our ingestion engine monitors incoming feeds 24/7. Switch category or check back shortly.</p>
        <button class="px-4 py-2 bg-surface-container rounded-full text-xs font-bold text-primary hover:bg-surface-variant cursor-pointer" onclick="window.parmanu.selectCategory('all')">
          View All Fields
        </button>
      </div>
    `;return}a.innerHTML="",re(e,a)}function re(a,e){a.forEach(t=>{var u,l,c,m,f,g,b;const n=document.createElement("article");n.className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3 border border-surface-container hover:shadow-md transition-shadow cursor-pointer";const s=((m=(c=(l=(u=t.items)==null?void 0:u[0])==null?void 0:l.sourceItem)==null?void 0:c.source)==null?void 0:m.name)||"Verified Source",o=((b=(g=(f=t.items)==null?void 0:f[0])==null?void 0:g.sourceItem)==null?void 0:b.canonicalUrl)||"#",r=Array.isArray(t.category)?t.category.join(" • "):"News",d=P(t.publishedAt||t.lastObservedAt);n.innerHTML=`
      <div class="flex items-center justify-between">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
          <span class="material-symbols-outlined text-[13px]" style="font-variation-settings: 'FILL' 1;">verified</span>
          Verified • ${i(s)}
        </span>
        <span class="font-code text-xs text-on-surface-variant">${d}</span>
      </div>
      <div class="flex flex-col gap-1 min-w-0">
        <span class="text-xs text-primary font-bold uppercase tracking-wider">${i(r)}</span>
        <h4 class="text-base sm:text-lg font-bold text-on-surface leading-snug hover:text-primary transition-colors">
          ${i(t.primaryHeadline)}
        </h4>
        <p class="text-xs sm:text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
          ${i(t.summary||"Corroborated intelligence report triangulated from multiple reporting endpoints.")}
        </p>
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-surface-container text-xs text-on-surface-variant">
        <span class="font-code text-on-surface-variant flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px] text-secondary">layers</span>
          ${t.itemCount} Sources Corroborated
        </span>
        <div class="flex items-center gap-2">
          <button class="btn-card-save p-1 rounded-full text-on-surface-variant hover:text-primary active:scale-90 transition-transform" data-id="${i(t.id)}" title="Save bookmark">
            <span class="material-symbols-outlined text-[18px]">bookmark</span>
          </button>
          <a href="${i(o)}" target="_blank" rel="noopener noreferrer" class="text-primary font-bold flex items-center gap-0.5 hover:underline" onclick="event.stopPropagation()">
            Read Source <span class="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </div>
    `,n.addEventListener("click",()=>{B(t.id)});const p=n.querySelector(".btn-card-save");p==null||p.addEventListener("click",async w=>{w.stopPropagation(),await Q(t.id,p)}),e.appendChild(n)})}function Y(a,e){a.forEach(t=>{var u;const n=document.createElement("article");n.className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3 border border-surface-container hover:shadow-md transition-shadow";const s=((u=t.source)==null?void 0:u.name)||"Verified Bureau",o=P(t.publishedAt),r=new Date(t.publishedAt),d=isNaN(r.getTime())?"":r.toLocaleTimeString("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:!1})+" IST";n.innerHTML=`
      <div class="flex items-center justify-between">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
          <span class="material-symbols-outlined text-[13px]" style="font-variation-settings: 'FILL' 1;">sensors</span>
          Wire • ${i(s)}
        </span>
        <div class="flex items-center gap-2 text-xs text-on-surface-variant font-code">
          <span>${d}</span>
          <span>•</span>
          <span>${o}</span>
        </div>
      </div>
      <div class="flex flex-col gap-1 min-w-0">
        <h4 class="text-base sm:text-lg font-bold text-on-surface leading-snug">
          <a href="${i(t.canonicalUrl)}" target="_blank" rel="noopener noreferrer" class="hover:text-primary hover:underline transition-colors">
            ${i(t.headline)}
          </a>
        </h4>
        ${t.excerpt?`<p class="text-xs sm:text-sm text-on-surface-variant line-clamp-3 leading-relaxed">${i(t.excerpt)}</p>`:""}
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-surface-container text-xs text-on-surface-variant">
        <span class="inline-flex items-center gap-1 font-code text-[11px] text-secondary font-semibold">
          <span class="material-symbols-outlined text-[14px]">verified_user</span>
          Grounded Ingested Record
        </span>
        <div class="flex items-center gap-2">
          <button class="btn-item-save p-1 rounded-full text-on-surface-variant hover:text-primary active:scale-90 transition-transform cursor-pointer" data-id="${i(t.id)}" title="Save dispatch">
            <span class="material-symbols-outlined text-[18px]">bookmark</span>
          </button>
          <a href="${i(t.canonicalUrl)}" target="_blank" rel="noopener noreferrer" class="text-primary font-bold flex items-center gap-0.5 hover:underline">
            Read Source Wire <span class="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </div>
    `;const p=n.querySelector(".btn-item-save");p==null||p.addEventListener("click",async l=>{l.stopPropagation(),await x.saveBookmark({sourceItemId:t.id})?(p.classList.add("text-secondary"),L("Saved wire dispatch to workspace")):L("Unable to save bookmark")}),e.appendChild(n)})}async function ie(){const a=document.getElementById("live-ingested-feed-container");if(!a)return;a.innerHTML=`
    <div class="py-8 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs font-semibold">Tuning into real-time live teleprinter wires...</span>
    </div>
  `;const e=await x.fetchLiveDispatches(30);if(e.length===0){a.innerHTML=`
      <div class="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-secondary text-4xl animate-pulse">sensors</span>
        <h4 class="text-base font-bold text-on-surface">Live Wire Buffer Active</h4>
        <p class="text-xs text-on-surface-variant max-w-sm">No newly published dispatches within the last buffer window. Automated ingestion runs every minute.</p>
        <button class="px-4 py-2 bg-primary text-on-primary rounded-full text-xs font-bold hover:bg-primary/90" onclick="window.parmanu.switchSection('pulse')">
          ⚡ Force Re-poll Wire
        </button>
      </div>
    `;return}a.innerHTML=`
    <div class="bg-secondary/10 p-3.5 rounded-xl border border-secondary/20 flex items-center justify-between text-xs mb-2">
      <span class="flex items-center gap-2 font-bold text-secondary">
        <span class="w-2.5 h-2.5 rounded-full bg-secondary animate-ping"></span>
        Direct Wire Teleprinter: ${e.length} Incoming Dispatches
      </span>
      <span class="text-[11px] font-code text-on-surface-variant">Auto-updating 30s</span>
    </div>
  `,Y(e,a)}async function Z(){const a=document.getElementById("live-ingested-feed-container");if(!a)return;a.innerHTML=`
    <div class="py-8 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs font-semibold">Loading topics and category dispatches...</span>
    </div>
  `;const[e,{clusters:t}]=await Promise.all([V.length>0?V:x.fetchCategories(),x.fetchStoryClusters({category:S==="all"?void 0:S,limit:20})]);V=e;const n=S.toLowerCase(),s=`
    <div class="bg-surface-container-low p-4 sm:p-5 rounded-2xl border border-surface-container mb-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-primary text-[18px]">category</span>
          Browse by Subject Desk
        </span>
        <span class="text-xs text-on-surface-variant">${e.length} Active Categories</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <button class="topic-card p-3 rounded-xl border text-left transition-all ${n==="all"?"bg-primary text-on-primary border-primary shadow-sm":"bg-surface-container-lowest text-on-surface border-surface-container hover:border-primary/40"}" data-cat="all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold">All Fields</span>
            <span class="material-symbols-outlined text-[16px]">public</span>
          </div>
          <span class="text-[11px] opacity-80 mt-1 block">Full Coverage</span>
        </button>
        ${e.map(o=>{const r=n===o.slug;return`
              <button class="topic-card p-3 rounded-xl border text-left transition-all ${r?"bg-primary text-on-primary border-primary shadow-sm":"bg-surface-container-lowest text-on-surface border-surface-container hover:border-primary/40"}" data-cat="${i(o.slug)}">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold truncate">${i(o.name)}</span>
                  <span class="text-[10px] font-code px-1.5 py-0.5 rounded ${r?"bg-white/20":"bg-surface-container"}">${o.count}</span>
                </div>
                <span class="text-[11px] opacity-80 mt-1 block truncate">Verified Stories</span>
              </button>
            `}).join("")}
      </div>
    </div>
  `;if(a.innerHTML=s,a.querySelectorAll(".topic-card").forEach(o=>{o.addEventListener("click",r=>{const d=r.currentTarget.getAttribute("data-cat")||"all";A(d),Z()})}),t.length===0){const o=document.createElement("div");o.className="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-3",o.innerHTML=`
      <span class="material-symbols-outlined text-secondary text-4xl">folder_open</span>
      <h4 class="text-base font-bold text-on-surface">No verified stories in "${i(S)}" yet</h4>
      <p class="text-xs text-on-surface-variant max-w-sm">Our ingestion engine monitors incoming feeds 24/7. Select another category or view all dispatches.</p>
    `,a.appendChild(o);return}re(t,a)}let $="radar";async function j(){var r,d,p,u;const a=document.getElementById("live-ingested-feed-container");if(!a)return;a.innerHTML=`
    <div class="py-8 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs font-semibold">Auditing creator radar &amp; sponsorship disclosures...</span>
    </div>
  `;const[e,t,n]=await Promise.all([x.fetchCreators(),x.fetchCollaborationClaims(),v?x.fetchPersonalizedFeed():Promise.resolve(null)]),s=((r=n==null?void 0:n.stats)==null?void 0:r.followedCount)??e.filter(l=>l.isFollowedByMe).length;a.innerHTML=`
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
          ${s} Following
        </span>
      </div>
    </div>

    <!-- Sub-tab navigation -->
    <div class="flex items-center gap-2 p-1 bg-surface-container rounded-xl mb-4 overflow-x-auto no-scrollbar">
      <button id="collabs-btn-radar" type="button" class="flex-1 min-w-[130px] py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${$==="radar"?"bg-primary text-on-primary shadow-sm":"text-on-surface-variant hover:text-on-surface"}">
        🔥 Top Creators Radar
      </button>
      <button id="collabs-btn-following" type="button" class="flex-1 min-w-[150px] py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${$==="following"?"bg-primary text-on-primary shadow-sm":"text-on-surface-variant hover:text-on-surface"}">
        ⭐ My Following Feed (${s})
      </button>
      <button id="collabs-btn-claims" type="button" class="flex-1 min-w-[140px] py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${$==="claims"?"bg-primary text-on-primary shadow-sm":"text-on-surface-variant hover:text-on-surface"}">
        🤝 Brand Collabs (#ad)
      </button>
    </div>

    <!-- Tab Content Container -->
    <div id="collabs-tab-content"></div>
  `,(d=document.getElementById("collabs-btn-radar"))==null||d.addEventListener("click",()=>{$="radar",j()}),(p=document.getElementById("collabs-btn-following"))==null||p.addEventListener("click",()=>{$="following",j()}),(u=document.getElementById("collabs-btn-claims"))==null||u.addEventListener("click",()=>{$="claims",j()});const o=document.getElementById("collabs-tab-content");if(o){if($==="radar"){if(e.length===0){o.innerHTML=`
        <div class="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-3xl text-secondary">groups</span>
          <span class="text-sm font-bold text-on-surface">No creators in radar currently</span>
        </div>
      `;return}const l=document.createElement("div");l.className="grid grid-cols-1 md:grid-cols-2 gap-4",e.forEach(c=>{const m=document.createElement("div");m.className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-sm flex flex-col justify-between gap-3 hover:shadow-md transition-shadow",c.avatarUrl;const f=(c.category||[]).slice(0,3).map(E=>`<span class="px-2 py-0.5 rounded-md bg-surface-container text-[10px] font-bold text-on-surface-variant">${i(E)}</span>`).join(" "),g=c.recentCollabs&&c.recentCollabs[0]?`<div class="p-2.5 rounded-xl bg-surface-container-low border border-surface-container text-xs flex items-center justify-between">
               <div class="flex items-center gap-1.5 min-w-0">
                 <span class="material-symbols-outlined text-secondary text-[16px]">verified</span>
                 <span class="truncate font-semibold text-on-surface">${i(c.recentCollabs[0].brandName)}: ${i(c.recentCollabs[0].campaignName||"Partnership")}</span>
               </div>
               <span class="px-2 py-0.5 rounded bg-secondary/10 text-secondary text-[10px] font-bold shrink-0">#ad</span>
             </div>`:"",b=c.isFollowedByMe?"bg-secondary/15 text-secondary border border-secondary/30 hover:bg-secondary/25":"bg-primary text-on-primary hover:bg-primary/90 shadow-sm",w=c.isFollowedByMe?"Following ✓":"+ Follow",k=i((c.displayName||"CR").trim().split(/\s+/).map(E=>E[0]).join("").slice(0,2).toUpperCase());m.innerHTML=`
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-12 rounded-full bg-secondary/15 text-secondary flex items-center justify-center font-bold text-sm ring-2 ring-surface-container shrink-0">
              ${k}
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-bold text-sm text-on-surface flex items-center gap-1">
                ${i(c.displayName)}
                ${c.isVerified?`<span class="material-symbols-outlined text-primary text-[15px]" style="font-variation-settings: 'FILL' 1;">verified</span>`:""}
              </span>
              <span class="text-xs text-secondary font-code truncate">@${i(c.instagramHandle||"")}</span>
            </div>
          </div>
          <button type="button" class="btn-toggle-follow px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${b}" data-creator-id="${i(c.id)}">
            ${w}
          </button>
        </div>

        <p class="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
          ${i(c.bio||"Verified content creator and media personality.")}
        </p>

        <div class="flex items-center gap-1.5 flex-wrap">
          ${f}
          ${c.followerRange?`<span class="px-2 py-0.5 rounded-md bg-primary/10 text-[10px] font-bold text-primary font-code">${i(c.followerRange)} Reach</span>`:""}
        </div>

        ${g}
      `;const h=m.querySelector(".btn-toggle-follow");h==null||h.addEventListener("click",async E=>{if(E.stopPropagation(),!v){I("signin");return}h.disabled=!0;const y=await x.toggleFollowCreator(c.id);h.disabled=!1,c.isFollowedByMe=y.isFollowed,y.isFollowed?(h.className="btn-toggle-follow px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer bg-secondary/15 text-secondary border border-secondary/30 hover:bg-secondary/25",h.textContent="Following ✓",L(`Now following ${c.displayName}`)):(h.className="btn-toggle-follow px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer bg-primary text-on-primary hover:bg-primary/90 shadow-sm",h.textContent="+ Follow",L(`Unfollowed ${c.displayName}`))}),l.appendChild(m)}),o.appendChild(l)}else if($==="following"){if(!v){o.innerHTML=`
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
      `;return}if(!n||n.followedCreators.length===0){o.innerHTML=`
        <div class="bg-surface-container-lowest p-8 rounded-3xl border border-surface-container text-center flex flex-col items-center gap-3">
          <span class="material-symbols-outlined text-secondary text-4xl">person_add</span>
          <h4 class="text-base font-bold text-on-surface">You are not following any creators yet</h4>
          <p class="text-xs text-on-surface-variant max-w-md">Switch to the "Top Creators Radar" tab to follow top Indian influencers like Ranveer Allahbadia, Shlok Srivastava, Faye D'Souza, and Prajakta Koli.</p>
          <button type="button" class="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold shadow hover:bg-primary/90 cursor-pointer" onclick="document.getElementById('collabs-btn-radar').click()">
            Explore Creators Radar
          </button>
        </div>
      `;return}const l=document.createElement("div");l.className="flex flex-col gap-4";const c=document.createElement("div");c.className="flex items-center justify-between text-xs px-1 text-on-surface-variant",c.innerHTML=`
      <span class="font-bold text-on-surface">Following ${n.followedCreators.length} Creator(s)</span>
      <span class="font-code text-secondary">${n.recentCollabs.length} Brand Collabs Recorded</span>
    `,l.appendChild(c);const m=document.createElement("div");if(m.className="flex gap-3 overflow-x-auto no-scrollbar py-1",n.followedCreators.forEach(f=>{const g=document.createElement("div");g.className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-surface-container-lowest border border-surface-container shrink-0 shadow-sm";const b=i((f.displayName||"CR").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase());g.innerHTML=`
        <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-surface-container">
          ${b}
        </div>
        <div class="flex flex-col text-xs">
          <span class="font-bold text-on-surface">${i(f.displayName)}</span>
          <span class="text-[10px] text-secondary font-code">@${i(f.instagramHandle||"")}</span>
        </div>
      `,m.appendChild(g)}),l.appendChild(m),n.recentCollabs.length>0){const f=document.createElement("h5");f.className="text-xs font-bold text-secondary uppercase tracking-wider mt-2",f.textContent="Recent Brand Deals & Sponsorships",l.appendChild(f),n.recentCollabs.forEach(g=>{var w,k;const b=document.createElement("div");b.className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm flex flex-col gap-2.5",b.innerHTML=`
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <span class="material-symbols-outlined text-primary text-[16px]">stars</span>
              ${i(((w=g.creatorProfile)==null?void 0:w.displayName)||"Creator")} &times; ${i(((k=g.brandProfile)==null?void 0:k.name)||"Brand")}
            </span>
            <span class="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold">ASCI #ad Verified</span>
          </div>
          <p class="text-xs text-on-surface-variant font-medium">${i(g.campaignName||"Campaign Promotion")}</p>
          <div class="text-[11px] text-on-surface-variant flex items-center justify-between pt-1 border-t border-surface-container">
            <span>Type: ${i(g.claimType||"COLLABORATION")}</span>
            <span class="font-code text-secondary">${i(g.provenanceState||"OFFICIAL_CONFIRMED")}</span>
          </div>
        `,l.appendChild(b)})}if(n.interestStories&&n.interestStories.length>0){const f=document.createElement("h5");f.className="text-xs font-bold text-primary uppercase tracking-wider mt-2",f.textContent="News Matching Your Selected Interests",l.appendChild(f),Y(n.interestStories,l)}o.appendChild(l)}else if($==="claims"){if(t.length===0){o.innerHTML=`
        <div class="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-3xl text-secondary">verified</span>
          <span class="text-sm font-bold text-on-surface">No collaboration claims registered</span>
        </div>
      `;return}const l=document.createElement("div");l.className="flex flex-col gap-3",t.forEach(c=>{var w,k,h;const m=document.createElement("div");m.className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container shadow-sm flex flex-col gap-3";const f=((w=c.creatorProfile)==null?void 0:w.displayName)||"Creator",g=(k=c.creatorProfile)!=null&&k.instagramHandle?`@${c.creatorProfile.instagramHandle}`:"",b=((h=c.brandProfile)==null?void 0:h.name)||"Brand Partner";m.innerHTML=`
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold text-xs">
              ${i(f.charAt(0))}
            </div>
            <div class="flex flex-col">
              <span class="text-sm font-bold text-on-surface flex items-center gap-1">
                ${i(f)}
                <span class="material-symbols-outlined text-primary text-[14px]">verified</span>
              </span>
              <span class="text-[11px] font-code text-on-surface-variant">${i(g)}</span>
            </div>
          </div>
          <span class="px-2.5 py-0.5 bg-secondary/10 text-secondary text-xs font-bold rounded-full flex items-center gap-1">
            <span class="material-symbols-outlined text-[13px]">check_circle</span> Compliant #ad
          </span>
        </div>

        <div class="p-3 bg-surface-container-low rounded-xl flex items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-bold text-on-surface">Brand: ${i(b)}</span>
          </div>
          <span class="font-semibold text-secondary">${i(c.verificationStance||"OFFICIAL_CONFIRMED")}</span>
        </div>

        <div class="flex items-center justify-between text-xs text-on-surface-variant pt-1 border-t border-surface-container">
          <span class="font-code text-[11px]">Type: ${i(c.claimType)}</span>
          <span class="text-[11px]">ASCI / FTC Disclosure Verified</span>
        </div>
      `,l.appendChild(m)}),o.appendChild(l)}}}async function le(){const a=document.getElementById("live-ingested-feed-container");if(!a)return;a.innerHTML=`
    <div class="py-8 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
      <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs font-semibold">Loading your workspace and saved dossiers...</span>
    </div>
  `;const{bookmarks:e}=await x.fetchBookmarks();if(a.innerHTML=`
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
  `,e.length===0){const t=document.createElement("div");t.className="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center flex flex-col items-center gap-3",t.innerHTML=`
      <span class="material-symbols-outlined text-secondary text-4xl">bookmark_border</span>
      <h4 class="text-base font-bold text-on-surface">No Saved Dossiers in Workspace</h4>
      <p class="text-xs text-on-surface-variant max-w-sm">Tap the bookmark icon on any news story or live wire dispatch to pin it to your personal workspace for offline review.</p>
      <button class="px-4 py-2 bg-primary text-on-primary rounded-full text-xs font-bold shadow hover:bg-primary/90 transition-all" onclick="window.parmanu.switchSection('feed')">
        Browse Verified Feed
      </button>
    `,a.appendChild(t);return}e.forEach(t=>{var p,u,l,c,m;const n=document.createElement("article");n.className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3 border border-surface-container hover:shadow-md transition-shadow";const s=t.storyCluster,o=(s==null?void 0:s.primaryHeadline)||((p=t.sourceItem)==null?void 0:p.headline)||"Saved Dossier Item",r=s!=null&&s.category?s.category.join(" • "):"News",d=(s==null?void 0:s.summary)||((u=t.sourceItem)==null?void 0:u.excerpt)||"Corroborated intelligence dispatch saved for research.";n.innerHTML=`
      <div class="flex items-center justify-between">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
          <span class="material-symbols-outlined text-[13px]" style="font-variation-settings: 'FILL' 1;">bookmark</span>
          Saved Dossier
        </span>
        <span class="font-code text-xs text-on-surface-variant">Saved ${P(t.createdAt)}</span>
      </div>
      <div class="flex flex-col gap-1 min-w-0">
        <span class="text-xs text-primary font-bold uppercase tracking-wider">${i(r)}</span>
        <h4 class="text-base sm:text-lg font-bold text-on-surface leading-snug cursor-pointer hover:text-primary transition-colors">
          ${i(o)}
        </h4>
        <p class="text-xs sm:text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
          ${i(d)}
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
    `,(l=n.querySelector(".btn-open-dossier"))==null||l.addEventListener("click",()=>{var f;s!=null&&s.id?B(s.id):(f=t.sourceItem)!=null&&f.canonicalUrl&&window.open(t.sourceItem.canonicalUrl,"_blank")}),(c=n.querySelector("h4"))==null||c.addEventListener("click",()=>{s!=null&&s.id&&B(s.id)}),(m=n.querySelector(".btn-remove-bm"))==null||m.addEventListener("click",async()=>{await x.removeBookmark(t.id),L("Removed from workspace"),le()}),a.appendChild(n)})}async function B(a,e=!0){const t=document.getElementById("dossier-main"),n=document.getElementById("global-backdrop");if(!t||!n)return;H(!1),t.classList.remove("translate-y-full","pointer-events-none"),t.classList.add("translate-y-0","pointer-events-auto","md:opacity-100","md:scale-100"),n.classList.remove("hidden"),e&&G({story:a});const s=t.querySelector(".p-5.overflow-y-auto"),o=t.querySelector("h3.font-headline");o&&(o.textContent="Loading Evidence Dossier..."),s&&(s.innerHTML=`
      <div class="py-12 text-center flex flex-col items-center justify-center gap-3 text-on-surface-variant">
        <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs font-semibold">Compiling provenance chain and factual corroborations...</span>
      </div>
    `);const r=await x.fetchStoryDetail(a);if(!r){s&&(s.innerHTML=`
        <div class="text-center py-8 flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-error text-3xl">error_outline</span>
          <p class="text-sm font-bold text-on-surface">Unable to retrieve story dossier</p>
          <p class="text-xs text-on-surface-variant">The requested dossier might be under editorial review or archived.</p>
        </div>
      `);return}R=r,be(t,r)}function be(a,e){var c;const t=a.querySelector("h3.font-headline"),n=a.querySelector(".p-5.overflow-y-auto");if(t&&(t.textContent=`Dossier: ${e.primaryHeadline.substring(0,45)}...`),!n)return;const s=e.status==="PUBLISHED"||e.status==="UPDATED",o=Math.round((e.confidenceScore||.5)*100);let r="";e.claims&&e.claims.length>0&&(r=`
      <div class="flex flex-col gap-2">
        <span class="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px] text-primary">fact_check</span>
          Factual Claims &amp; Verification Stance
        </span>
        <div class="flex flex-col gap-2">
          ${e.claims.map(m=>`
            <div class="p-3 bg-surface-container rounded-xl flex flex-col gap-1.5 border border-surface-container-high">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-primary">${i(m.claimType)}</span>
                <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-secondary-fixed text-on-secondary-fixed">
                  ${i(m.verificationStatus)}
                </span>
              </div>
              <p class="text-xs text-on-surface font-medium leading-snug">${i(m.claimText)}</p>
              ${m.evidenceRecords&&m.evidenceRecords.length>0?`<div class="pt-1 text-[11px] text-on-surface-variant flex flex-col gap-0.5">
                      ${m.evidenceRecords.map(f=>{var g,b;return`<span class="flex items-center gap-1">
                              <span class="material-symbols-outlined text-[12px] text-secondary">check</span>
                              ${i(((b=(g=f.sourceItem)==null?void 0:g.source)==null?void 0:b.name)||"Publisher")}: <em>"${i(f.quoteExcerpt||"Corroborating record")}"</em>
                            </span>`}).join("")}
                    </div>`:""}
            </div>
          `).join("")}
        </div>
      </div>
    `);const d=(e.items||[]).map(m=>{var f,g,b,w,k,h;return`
      <div class="p-3 bg-surface-container rounded-xl flex items-start justify-between gap-2 hover:bg-surface-container-high transition-colors">
        <div class="flex items-start gap-2 min-w-0">
          <span class="material-symbols-outlined text-primary text-[20px] mt-0.5">description</span>
          <div class="flex flex-col min-w-0">
            <a href="${i(((f=m.sourceItem)==null?void 0:f.canonicalUrl)||"#")}" target="_blank" rel="noopener noreferrer" class="text-xs font-bold text-on-surface truncate hover:text-primary hover:underline">
              ${i(((g=m.sourceItem)==null?void 0:g.headline)||"Attributed source")}
            </a>
            <span class="font-code text-[11px] text-on-surface-variant">
              ${i(((w=(b=m.sourceItem)==null?void 0:b.source)==null?void 0:w.name)||"Publisher")} • ${P(((k=m.sourceItem)==null?void 0:k.publishedAt)||"")}
            </span>
          </div>
        </div>
        <a href="${i(((h=m.sourceItem)==null?void 0:h.canonicalUrl)||"#")}" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary/80">
          <span class="material-symbols-outlined text-[18px]">open_in_new</span>
        </a>
      </div>
    `}).join(""),p=e.correctionNotes?`
      <div class="p-3 bg-secondary-fixed/20 border border-secondary rounded-xl flex items-start gap-2">
        <span class="material-symbols-outlined text-secondary text-[20px]">info</span>
        <div class="flex flex-col gap-0.5">
          <span class="text-xs font-bold text-on-surface">Official Editorial Note / Correction</span>
          <p class="text-xs text-on-surface-variant leading-relaxed">${i(e.correctionNotes)}</p>
        </div>
      </div>
    `:"";n.innerHTML=`
    <div class="p-3.5 bg-surface-container-low rounded-xl flex items-center justify-between border border-surface-container">
      <div>
        <span class="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Integrity Verdict</span>
        <span class="text-sm text-secondary font-bold">${s?"Officially Confirmed &amp; Triangulated":"In Review / Emerging Story"}</span>
      </div>
      <span class="font-code text-xs bg-surface-container px-2 py-1 rounded text-on-surface">Score: ${o}%</span>
    </div>

    ${p}

    <div class="flex flex-col gap-1.5">
      <span class="text-xs font-bold text-primary uppercase tracking-wider">${i(Array.isArray(e.category)?e.category.join(" • "):"National")}</span>
      <h2 class="text-lg font-bold text-on-surface leading-snug">${i(e.primaryHeadline)}</h2>
      <p class="text-xs sm:text-sm text-on-surface-variant leading-relaxed">${i(e.summary||"Summary under compilation by intelligence engine.")}</p>
    </div>

    ${r}

    <div class="flex flex-col gap-2">
      <span class="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1">
        <span class="material-symbols-outlined text-[16px] text-primary">link</span>
        Corroborated Primary Source Records (${((c=e.items)==null?void 0:c.length)||0})
      </span>
      <div class="flex flex-col gap-2">
        ${d||'<span class="text-xs text-on-surface-variant">No direct source links recorded.</span>'}
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
  `;const u=document.getElementById("btn-dossier-save"),l=document.getElementById("btn-dossier-share");x.checkBookmark(e.id).then(m=>{m&&u&&(u.classList.add("text-secondary","font-bold"),u.querySelector("span:last-child").textContent="Saved")}),u==null||u.addEventListener("click",async()=>{await Q(e.id,u)}),l==null||l.addEventListener("click",()=>{D(e.primaryHeadline)})}async function Q(a,e){if(await x.checkBookmark(a))if(await x.removeBookmark(a)){e.classList.remove("text-secondary");const s=e.querySelector("span:last-child");s&&s.textContent==="Saved"&&(s.textContent="Save Dossier"),L("Removed from saved bookmarks")}else L("Please login to manage your saved items");else if(await x.saveBookmark({storyClusterId:a})){e.classList.add("text-secondary");const s=e.querySelector("span:last-child");s&&s.textContent==="Save Dossier"&&(s.textContent="Saved"),L("Saved to your verified dossiers")}else L("Please login to save bookmarks")}function he(){let a=document.getElementById("parmanu-search-modal");a||(a=document.createElement("div"),a.id="parmanu-search-modal",a.className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 pointer-events-none opacity-0 transition-opacity duration-200",a.innerHTML=`
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
    `,document.body.appendChild(a));const e=a.querySelector("#search-input"),t=a.querySelector("#search-results-container"),n=a.querySelector("#search-close-btn");n==null||n.addEventListener("click",X),e==null||e.addEventListener("input",()=>{const s=e.value.trim();if(clearTimeout(ae),!s){t.innerHTML='<span class="text-xs text-on-surface-variant text-center py-8">Type a keyword to discover corroborated news.</span>';return}ae=setTimeout(async()=>{t.innerHTML=`
        <div class="py-6 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
          <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs font-semibold">Searching verified records...</span>
        </div>
      `;const o=await x.search(s);ve(t,o)},250)}),window.openSearchModal=O}function O(){const a=document.getElementById("parmanu-search-modal"),e=document.getElementById("global-backdrop"),t=a==null?void 0:a.querySelector("#search-input");a&&e&&(a.classList.remove("pointer-events-none","opacity-0"),a.classList.add("pointer-events-auto","opacity-100"),e.classList.remove("hidden"),t==null||t.focus())}function X(){const a=document.getElementById("parmanu-search-modal"),e=document.getElementById("global-backdrop");a&&e&&(a.classList.add("pointer-events-none","opacity-0"),a.classList.remove("pointer-events-auto","opacity-100"),e.classList.add("hidden"))}function ve(a,e){const{clusters:t,entities:n}=e;if(t.length===0&&n.length===0){a.innerHTML=`
      <div class="py-8 text-center text-xs text-on-surface-variant">
        No verified intelligence found matching your search.
      </div>
    `;return}let s="";n.length>0&&(s+=`
      <div class="flex flex-col gap-1.5 pb-2 border-b border-surface-container">
        <span class="text-[11px] font-bold text-primary uppercase tracking-wider">Identified Entities</span>
        <div class="flex flex-wrap gap-2">
          ${n.map(o=>`
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-surface-container rounded-full text-xs font-semibold text-on-surface">
              <span class="material-symbols-outlined text-[14px] text-secondary">verified</span>
              ${i(o.canonicalName)} <span class="text-[10px] text-on-surface-variant">(${i(o.entityType)})</span>
            </span>
          `).join("")}
        </div>
      </div>
    `),t.length>0&&(s+=`
      <div class="flex flex-col gap-2">
        <span class="text-[11px] font-bold text-primary uppercase tracking-wider">Verified Stories (${t.length})</span>
        ${t.map(o=>`
          <div class="search-result-item p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer flex flex-col gap-1 border border-surface-container" data-id="${i(o.id)}">
            <span class="text-xs font-bold text-on-surface leading-snug">${i(o.primaryHeadline)}</span>
            <div class="flex items-center gap-2 text-[11px] text-on-surface-variant">
              <span class="text-secondary font-bold">${o.itemCount} Sources</span>
              <span>•</span>
              <span>${Array.isArray(o.category)?o.category.join(", "):"News"}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `),a.innerHTML=s,a.querySelectorAll(".search-result-item").forEach(o=>{o.addEventListener("click",()=>{const r=o.getAttribute("data-id");r&&(X(),B(r))})})}function we(){var e;let a=document.getElementById("parmanu-bookmarks-drawer");a||(a=document.createElement("div"),a.id="parmanu-bookmarks-drawer",a.className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface-container-lowest shadow-2xl border-l border-surface-container transform translate-x-full transition-transform duration-300 flex flex-col pointer-events-none",a.innerHTML=`
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
    `,document.body.appendChild(a)),(e=a.querySelector("#bookmarks-close-btn"))==null||e.addEventListener("click",ce),window.openBookmarksDrawer=q}async function q(){const a=document.getElementById("parmanu-bookmarks-drawer"),e=document.getElementById("global-backdrop");if(!a||!e)return;a.classList.remove("translate-x-full","pointer-events-none"),a.classList.add("translate-x-0","pointer-events-auto"),e.classList.remove("hidden");const t=a.querySelector("#bookmarks-list-container");if(!t)return;const{bookmarks:n}=await x.fetchBookmarks();if(n.length===0){t.innerHTML=`
      <div class="py-12 text-center flex flex-col items-center gap-2 text-on-surface-variant">
        <span class="material-symbols-outlined text-3xl">bookmark_border</span>
        <span class="text-sm font-bold text-on-surface">No saved dossiers</span>
        <span class="text-xs">Click the bookmark icon on any story to save it for offline reference.</span>
      </div>
    `;return}t.innerHTML=n.map(s=>{var u;const o=s.storyCluster,r=(o==null?void 0:o.primaryHeadline)||((u=s.sourceItem)==null?void 0:u.headline)||"Saved Item",d=o!=null&&o.category?o.category.join(" • "):"News",p=(o==null?void 0:o.id)||s.sourceItemId||"";return`
        <div class="p-3 bg-surface-container-low rounded-xl border border-surface-container flex items-start justify-between gap-2">
          <div class="flex flex-col gap-1 min-w-0 cursor-pointer" onclick="window.parmanu.openDossierModal('${i(p)}')">
            <span class="text-[11px] font-bold text-primary uppercase">${i(d)}</span>
            <span class="text-xs font-bold text-on-surface leading-snug line-clamp-2">${i(r)}</span>
          </div>
          <button class="p-1 text-on-surface-variant hover:text-error transition-colors" onclick="window.parmanu.removeBookmarkItem('${i(s.id)}')">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      `}).join("")}function ce(){const a=document.getElementById("parmanu-bookmarks-drawer"),e=document.getElementById("global-backdrop");a&&e&&(a.classList.add("translate-x-full","pointer-events-none"),a.classList.remove("translate-x-0","pointer-events-auto"),e.classList.add("hidden"))}function ke(){const a=document.getElementById("global-backdrop");a&&a.addEventListener("click",()=>{H()}),document.addEventListener("keydown",e=>{e.key==="Escape"&&H(),(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"&&(e.preventDefault(),O())})}function H(a=!0){["dossier-main","dossier-breaking","download-app-modal","auth-modal","user-profile-modal"].forEach(n=>{const s=document.getElementById(n);s&&(s.classList.add("translate-y-full","pointer-events-none"),s.classList.remove("translate-y-0","pointer-events-auto","md:opacity-100","md:scale-100"),(n==="auth-modal"||n==="user-profile-modal")&&(s.classList.add("hidden","md:opacity-0","md:scale-95"),s.classList.remove("block")))}),X(),ce();const t=document.getElementById("global-backdrop");t&&t.classList.add("hidden"),R=null,a&&G({story:null})}function Le(){window.openAuthModal=I,window.openProfileModal=z,window.switchAuthTab=M,window.closeAllModals=H,window.switchSection=C,window.selectCategory=A,window.openDossierModal=B,window.openBookmarksDrawer=q,window.openSearchModal=O,window.handleShare=D,window.parmanu={openDossierModal:B,closeAllModals:H,openSearchModal:O,openBookmarksDrawer:q,selectCategory:A,switchSection:C,openAuthModal:I,openProfileModal:z,switchAuthTab:M,handleShare:D,loadCollabsFeed:j,removeBookmarkItem:async a=>{await x.removeBookmark(a),L("Removed bookmark"),q()}},window.toggleDossier=a=>{if(a==="dossier-main")B(R?R.id:"featured");else{const e=document.getElementById(a),t=document.getElementById("global-backdrop");e&&t&&(e.classList.remove("translate-y-full","pointer-events-none"),e.classList.add("translate-y-0","pointer-events-auto","md:opacity-100","md:scale-100"),t.classList.remove("hidden"))}}}function D(a){const e=a||document.title,t=window.location.href;navigator.share?navigator.share({title:e,text:"Verified story from Parmanu News & Creator Intelligence",url:t}).catch(()=>{}):navigator.clipboard.writeText(t).then(()=>{L("Story link copied to clipboard!")}).catch(()=>{L("Unable to copy link to clipboard")})}
