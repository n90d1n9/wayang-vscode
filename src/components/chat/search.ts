export class Search {
    render(state: any): string {
       return `
      <div class="search-container" id="searchContainer" style="display: none;">
          <input type="text" class="search-input" id="searchInput" 
                 placeholder="Search conversation history..." />
          <div class="search-results" id="searchResults"></div>
      </div>`;
    }
}