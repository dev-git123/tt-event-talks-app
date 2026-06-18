document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const spinnerIcon = refreshBtn.querySelector('.spinner-icon');
    const searchInput = document.getElementById('search-input');
    const filterChips = document.querySelectorAll('.filter-chip');
    const notesList = document.getElementById('notes-list');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMsg = document.getElementById('error-msg');
    const emptyState = document.getElementById('empty-state');
    const retryBtn = document.getElementById('retry-btn');
    
    // Tweet Drawer Elements
    const tweetDrawer = document.getElementById('tweet-drawer');
    const closeDrawerBtn = document.getElementById('close-drawer');
    const previewTag = document.getElementById('preview-tag');
    const previewTitle = document.getElementById('preview-title');
    const previewDate = document.getElementById('preview-date');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const tweetBtn = document.getElementById('tweet-btn');
    
    // Application State
    let releaseNotes = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let selectedNoteId = null;

    // Load initial data
    fetchReleaseNotes();

    // Event Listeners
    refreshBtn.addEventListener('click', fetchReleaseNotes);
    retryBtn.addEventListener('click', fetchReleaseNotes);
    
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderNotes();
    });

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            renderNotes();
        });
    });

    closeDrawerBtn.addEventListener('click', () => {
        tweetDrawer.classList.remove('open');
    });

    tweetTextarea.addEventListener('input', updateCharCount);

    tweetBtn.addEventListener('click', () => {
        const text = encodeURIComponent(tweetTextarea.value);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    });

    // Core Fetch Function
    async function fetchReleaseNotes() {
        showState('loading');
        refreshBtn.disabled = true;
        spinnerIcon.classList.add('spinning');

        try {
            const response = await fetch('/api/release-notes');
            const result = await response.json();

            if (result.status === 'success') {
                releaseNotes = result.data.map(note => {
                    const tag = categorizeNote(note);
                    return { ...note, category: tag };
                });
                renderNotes();
            } else {
                throw new Error(result.message || 'Unknown server error');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            errorMsg.textContent = error.message || 'Could not fetch release notes feed.';
            showState('error');
        } finally {
            refreshBtn.disabled = false;
            spinnerIcon.classList.remove('spinning');
        }
    }

    // Helper: Categorize release notes by parsing content/title
    function categorizeNote(note) {
        const text = (note.title + ' ' + note.content).toLowerCase();
        if (text.includes('feature') || text.includes('new') || text.includes('introduced') || text.includes('support for')) {
            return 'feature';
        }
        if (text.includes('deprecat') || text.includes('discontinue') || text.includes('sunset')) {
            return 'deprecation';
        }
        return 'change'; // Default category
    }

    // Helper: Format Dates
    function formatDate(dateStr) {
        if (!dateStr) return 'Recent Update';
        try {
            const date = new Date(dateStr);
            if (isNaN(date)) return dateStr;
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    }

    // Toggle different layout states (loading, error, success, empty)
    function showState(state) {
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        emptyState.classList.add('hidden');
        notesList.classList.add('hidden');

        if (state === 'loading') {
            loadingState.classList.remove('hidden');
        } else if (state === 'error') {
            errorState.classList.remove('hidden');
        } else if (state === 'empty') {
            emptyState.classList.remove('hidden');
        } else if (state === 'success') {
            notesList.classList.remove('hidden');
        }
    }

    // Render Filtered and Searched Notes
    function renderNotes() {
        const filtered = releaseNotes.filter(note => {
            const matchesFilter = currentFilter === 'all' || note.category === currentFilter;
            const matchesSearch = note.title.toLowerCase().includes(searchQuery) || 
                                  note.content.toLowerCase().includes(searchQuery);
            return matchesFilter && matchesSearch;
        });

        if (filtered.length === 0) {
            showState('empty');
            return;
        }

        showState('success');
        notesList.innerHTML = '';

        filtered.forEach(note => {
            const card = document.createElement('article');
            card.className = `note-card ${selectedNoteId === note.id ? 'selected' : ''}`;
            card.dataset.id = note.id;
            
            const formattedDate = formatDate(note.updated);
            
            card.innerHTML = `
                <div class="note-header">
                    <span class="tag ${note.category}">${note.category}</span>
                    <span class="note-date">${formattedDate}</span>
                </div>
                <h3>${escapeHtml(note.title)}</h3>
                <div class="note-body">${note.content}</div>
            `;

            card.addEventListener('click', () => selectNote(note));
            notesList.appendChild(card);
        });
    }

    // Select a note and prepare the tweet composer
    function selectNote(note) {
        selectedNoteId = note.id;
        
        // Update selection UI
        document.querySelectorAll('.note-card').forEach(card => {
            if (card.dataset.id === note.id) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Set composer preview
        previewTag.className = `tag ${note.category}`;
        previewTag.textContent = note.category;
        previewTitle.textContent = note.title;
        previewDate.textContent = formatDate(note.updated);

        // Auto compose tweet (limit title length if necessary to fit link and tags)
        const hashtag = '#BigQuery #GoogleCloud';
        const docLink = note.link || 'https://cloud.google.com/bigquery/docs/release-notes';
        
        // Clean title for tweet
        let cleanTitle = note.title.trim();
        if (cleanTitle.length > 180) {
            cleanTitle = cleanTitle.substring(0, 177) + '...';
        }
        
        const defaultTweet = `New BigQuery Update: ${cleanTitle}\n\nRead more: ${docLink}\n${hashtag}`;
        
        tweetTextarea.value = defaultTweet;
        updateCharCount();
        
        // Open drawer (for mobile screens and desktop styling)
        tweetDrawer.classList.add('open');
    }

    // Update Tweet Char Count and disable state
    function updateCharCount() {
        const text = tweetTextarea.value;
        const remaining = 280 - text.length;
        charCounter.textContent = remaining;

        // Visual alerts for length
        charCounter.className = 'char-counter';
        if (remaining <= 20 && remaining >= 0) {
            charCounter.classList.add('warning');
        } else if (remaining < 0) {
            charCounter.classList.add('danger');
        }

        // Enable button if not empty and within character limit
        tweetBtn.disabled = text.trim() === '' || remaining < 0;
    }

    // Utility to escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    }
});
