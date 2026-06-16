// Application State
const state = {
    releases: [],
    filteredReleases: [],
    filters: {
        search: '',
        category: 'All',
        sort: 'newest'
    },
    counts: {
        All: 0,
        Feature: 0,
        Fix: 0,
        Issue: 0,
        Deprecation: 0,
        Change: 0,
        Other: 0
    }
};

// Color mapping for types (used for card accent border)
const accentColors = {
    Feature: 'var(--color-feature)',
    Fix: 'var(--color-fix)',
    Issue: 'var(--color-issue)',
    Deprecation: 'var(--color-deprecation)',
    Change: 'var(--color-change)',
    Other: 'var(--color-other)',
    Update: 'var(--color-other)'
};

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const sortSelect = document.getElementById('sort-select');
const categoryPills = document.getElementById('category-pills');
const notesGrid = document.getElementById('notes-grid');
const loadingSkeletons = document.getElementById('loading-skeletons');
const emptyState = document.getElementById('empty-state');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const errorRetryBtn = document.getElementById('error-retry-btn');
const toastContainer = document.getElementById('toast-container');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const tweetSubmitBtn = document.getElementById('tweet-submit-btn');
const previewBadge = document.getElementById('preview-badge');
const previewDate = document.getElementById('preview-date');
const previewDesc = document.getElementById('preview-desc');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleases();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    refreshBtn.addEventListener('click', () => fetchReleases(true));
    errorRetryBtn.addEventListener('click', () => fetchReleases(true));
    
    // Search
    searchInput.addEventListener('input', (e) => {
        state.filters.search = e.target.value.trim();
        clearSearchBtn.style.display = state.filters.search ? 'block' : 'none';
        applyFilters();
    });
    
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.filters.search = '';
        clearSearchBtn.style.display = 'none';
        applyFilters();
        searchInput.focus();
    });
    
    // Sort
    sortSelect.addEventListener('change', (e) => {
        state.filters.sort = e.target.value;
        applyFilters();
    });
    
    // Category pills
    categoryPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;
        
        // Remove active class from all pills
        categoryPills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        // Add active class to clicked pill
        pill.classList.add('active');
        
        state.filters.category = pill.dataset.category;
        applyFilters();
    });
    
    // Clear all filters from empty state
    clearFiltersBtn.addEventListener('click', () => {
        resetFilters();
    });
    
    // Modal events
    modalCloseBtn.addEventListener('click', closeTweetModal);
    modalCancelBtn.addEventListener('click', closeTweetModal);
    
    // Close modal on click outside card
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetModal();
        }
    });
    
    // Tweet textarea live counter
    tweetTextarea.addEventListener('input', () => {
        updateCharCount();
    });
}

// Reset all filters to default
function resetFilters() {
    searchInput.value = '';
    state.filters.search = '';
    clearSearchBtn.style.display = 'none';
    
    state.filters.category = 'All';
    categoryPills.querySelectorAll('.pill').forEach(p => {
        if (p.dataset.category === 'All') p.classList.add('active');
        else p.classList.remove('active');
    });
    
    sortSelect.value = 'newest';
    state.filters.sort = 'newest';
    
    applyFilters();
}

// Fetch Releases from API
async function fetchReleases(force = false) {
    showLoading(true);
    hideError();
    
    if (force) {
        refreshIcon.classList.add('spinning');
        refreshBtn.disabled = true;
    }
    
    try {
        const url = `/api/releases${force ? '?force=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            state.releases = data.releases;
            calculateCounts();
            applyFilters();
            
            if (force) {
                showToast('Release notes refreshed successfully!', 'success');
            }
        } else {
            throw new Error(data.error || 'Failed to fetch release notes.');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showError(`Could not load release notes: ${error.message}`);
        showToast('Failed to load release notes.', 'error');
    } finally {
        showLoading(false);
        if (force) {
            refreshIcon.classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }
}

// Show/Hide Loading state
function showLoading(isLoading) {
    if (isLoading) {
        loadingSkeletons.style.display = 'grid';
        notesGrid.style.display = 'none';
        emptyState.style.display = 'none';
    } else {
        loadingSkeletons.style.display = 'none';
    }
}

// Show/Hide Error banner
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
}

function hideError() {
    errorMessage.style.display = 'none';
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 50);
    
    // Remove after 3.5s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Calculate category counts
function calculateCounts() {
    // Reset counts
    Object.keys(state.counts).forEach(key => state.counts[key] = 0);
    
    state.releases.forEach(item => {
        state.counts.All++;
        
        const type = item.type;
        if (type in state.counts) {
            state.counts[type]++;
        } else {
            state.counts.Other++;
        }
    });
    
    // Update count labels in UI
    document.getElementById('count-all').textContent = state.counts.All;
    document.getElementById('count-feature').textContent = state.counts.Feature;
    document.getElementById('count-fix').textContent = state.counts.Fix;
    document.getElementById('count-issue').textContent = state.counts.Issue;
    document.getElementById('count-deprecation').textContent = state.counts.Deprecation;
    document.getElementById('count-change').textContent = state.counts.Change;
    document.getElementById('count-other').textContent = state.counts.Other;
}

// Apply Search, Category and Sort filters
function applyFilters() {
    let result = [...state.releases];
    
    // 1. Filter by category
    const category = state.filters.category;
    if (category !== 'All') {
        if (category === 'Other') {
            const knownCategories = ['Feature', 'Fix', 'Issue', 'Deprecation', 'Change'];
            result = result.filter(item => !knownCategories.includes(item.type));
        } else {
            result = result.filter(item => item.type === category);
        }
    }
    
    // 2. Filter by search keyword
    const searchQuery = state.filters.search.toLowerCase();
    if (searchQuery) {
        result = result.filter(item => {
            const inText = item.text_content.toLowerCase().includes(searchQuery);
            const inType = item.type.toLowerCase().includes(searchQuery);
            const inDate = item.date.toLowerCase().includes(searchQuery);
            return inText || inType || inDate;
        });
    }
    
    // 3. Sort
    if (state.filters.sort === 'newest') {
        // Feed is typically sorted newest first, but let's be explicit
        result.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
        result.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    state.filteredReleases = result;
    renderReleases();
}

// Render release cards in the grid
function renderReleases() {
    notesGrid.innerHTML = '';
    
    if (state.filteredReleases.length === 0) {
        notesGrid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    notesGrid.style.display = 'grid';
    
    state.filteredReleases.forEach(item => {
        const card = document.createElement('article');
        card.className = 'release-card';
        
        // Map types to lowercase for CSS classes
        const typeClass = item.type.toLowerCase();
        const cardAccent = accentColors[item.type] || accentColors.Other;
        card.style.setProperty('--accent-color', cardAccent);
        
        // Determine correct badge class
        const badgeClass = ['feature', 'fix', 'issue', 'deprecation', 'change'].includes(typeClass) 
            ? `badge-${typeClass}` 
            : 'badge-other';
            
        // Build card HTML
        card.innerHTML = `
            <div>
                <div class="card-header">
                    <span class="badge ${badgeClass}">${item.type}</span>
                    <span class="date-badge">
                        <i class="fa-regular fa-calendar"></i>
                        <span>${item.date}</span>
                    </span>
                </div>
                
                <div class="card-body">
                    ${item.content}
                </div>
            </div>
            
            <div class="card-footer">
                <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="card-source-link">
                    <span>Source Doc</span>
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
                
                <button class="btn btn-sm btn-twitter tweet-btn">
                    <i class="fa-brands fa-x-twitter"></i>
                    <span>Tweet</span>
                </button>
            </div>
        `;
        
        // Add Tweet button listener
        const tweetBtn = card.querySelector('.tweet-btn');
        tweetBtn.addEventListener('click', () => openTweetModal(item));
        
        notesGrid.appendChild(card);
    });
}

// Close Tweet modal wrapper for event handler check
function closeTweetModalHelper(e) {
    if (e.target === tweetModal) {
        closeTweetModal();
    }
}

// Open the Tweet composer modal
function openTweetModal(item) {
    // Populate Modal preview card
    previewBadge.className = `badge badge-${item.type.toLowerCase()}`;
    previewBadge.textContent = item.type;
    previewDate.textContent = item.date;
    previewDesc.textContent = item.text_content;
    
    // Generate draft tweet text
    // Rule: Any URL is counted as exactly 23 characters by Twitter/X
    const linkLengthInTweet = 23;
    const hashtags = " #BigQuery #GoogleCloud";
    const prefix = `BigQuery ${item.type} (${item.date}): `;
    
    // 280 - prefix - link - hashtags - extra spaces
    const maxTextLen = 280 - prefix.length - linkLengthInTweet - hashtags.length - 2;
    
    let bodyText = item.text_content.replace(/\s+/g, ' '); // normalize whitespace
    if (bodyText.length > maxTextLen) {
        bodyText = bodyText.substring(0, maxTextLen - 3) + "...";
    }
    
    const draftContent = `${prefix}${bodyText} ${item.link}${hashtags}`;
    
    tweetTextarea.value = draftContent;
    state.activeTweetLink = item.link;
    
    // Open Modal
    tweetModal.style.display = 'flex';
    setTimeout(() => {
        tweetModal.classList.add('active');
        tweetTextarea.focus();
        // Select composer text to make it easy to edit
        tweetTextarea.setSelectionRange(prefix.length, prefix.length + bodyText.length);
        updateCharCount();
    }, 50);
    
    // Setup submit listener for this specific update
    tweetSubmitBtn.onclick = () => submitTweet();
}

// Close the Tweet modal
function closeTweetModal() {
    tweetModal.classList.remove('active');
    setTimeout(() => {
        tweetModal.style.display = 'none';
    }, 250);
}

// Update character counter based on X/Twitter rules
function updateCharCount() {
    const currentText = tweetTextarea.value;
    const link = state.activeTweetLink || '';
    
    // Calculate length accounting for URL counted as 23 characters
    let calculatedLength = currentText.length;
    
    if (link && currentText.includes(link)) {
        // Subtract link actual length, and add 23
        calculatedLength = currentText.length - link.length + 23;
    }
    
    charCounter.textContent = `${calculatedLength} / 280`;
    
    // Colors and states based on limit
    if (calculatedLength > 280) {
        charCounter.className = 'char-count error';
        tweetSubmitBtn.disabled = true;
    } else if (calculatedLength > 260) {
        charCounter.className = 'char-count warning';
        tweetSubmitBtn.disabled = false;
    } else {
        charCounter.className = 'char-count';
        tweetSubmitBtn.disabled = false;
    }
}

// Submit tweet (open intent URL in new tab)
function submitTweet() {
    const text = tweetTextarea.value.trim();
    if (!text) return;
    
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(intentUrl, '_blank');
    
    closeTweetModal();
    showToast('Draft opened in X / Twitter!', 'success');
}
