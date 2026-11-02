const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#username-search");
const searchButton = document.querySelector("#search-button");
const statusMessage = document.querySelector("#status-message");
const resultCount = document.querySelector("#result-count");
const resultsHeading = document.querySelector("#results-heading");
const explorerLayout = document.querySelector("#explorer-layout");
const userResults = document.querySelector("#user-results");
const profilePanel = document.querySelector("#profile-panel");

let activeRequest = 0;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function setStatus(message = "", state = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message${state ? ` ${state}` : ""}`;
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  const data = await response.json();

  if (!response.ok) {
    if (
      response.status === 403 &&
      response.headers.has("x-ratelimit-remaining")
    ) {
      throw new Error(
        "GitHub's unauthenticated API limit has been reached. Please try again later.",
      );
    }
    throw new Error(
      data.message || `GitHub returned an error (${response.status}).`,
    );
  }

  return data;
}

function renderUsers(users) {
  userResults.innerHTML = users
    .map(
      (user) => `
        <button class="user-card" type="button" data-login="${escapeHtml(user.login)}" aria-pressed="false">
          <img src="${escapeHtml(user.avatar_url)}" alt="" loading="lazy" />
          <span class="user-card-copy">
            <span class="user-card-name">${escapeHtml(user.login)}</span>
            <span class="user-card-login">View profile ↗</span>
          </span>
        </button>
      `,
    )
    .join("");

  userResults.querySelectorAll(".user-card").forEach((card) => {
    card.addEventListener("click", () => {
      const requestId = ++activeRequest;
      loadProfile(card.dataset.login, requestId);
    });
  });
}

function safeWebsite(value) {
  if (!value) return "";
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderMeta(profile) {
  const items = [];
  if (profile.location) {
    items.push(`
      <span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>
        ${escapeHtml(profile.location)}
      </span>
    `);
  }
  if (profile.company) {
    items.push(`<span>${escapeHtml(profile.company)}</span>`);
  }
  if (profile.created_at) {
    const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
    items.push(`
      <span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>
        Joined ${escapeHtml(joined)}
      </span>
    `);
  }
  const website = safeWebsite(profile.blog);
  if (website) {
    items.push(
      `<span><a class="profile-login" href="${escapeHtml(website)}" target="_blank" rel="noreferrer">Website ↗</a></span>`,
    );
  }
  return items.join("");
}

function renderRepositories(repositories, errorMessage = "") {
  if (errorMessage) {
    return `<p class="repo-empty">${escapeHtml(errorMessage)}</p>`;
  }
  if (!repositories.length) {
    return '<p class="repo-empty">No public repositories to show yet.</p>';
  }

  return repositories
    .map(
      (repo) => `
        <a class="repo-card" href="${escapeHtml(repo.html_url)}" target="_blank" rel="noreferrer">
          <span class="repo-name">${escapeHtml(repo.name)}</span>
          <span class="repo-description">${escapeHtml(repo.description || "No description provided.")}</span>
          <span class="repo-stats">
            ${
              repo.language
                ? `<span><i class="language-dot"></i>${escapeHtml(repo.language)}</span>`
                : ""
            }
            <span>★ ${formatNumber(repo.stargazers_count)}</span>
            <span>⑂ ${formatNumber(repo.forks_count)}</span>
          </span>
        </a>
      `,
    )
    .join("");
}

function setSelectedUser(login) {
  userResults.querySelectorAll(".user-card").forEach((card) => {
    card.setAttribute("aria-pressed", String(card.dataset.login === login));
  });
}

async function loadProfile(login, requestId) {
  if (!login) return;
  setSelectedUser(login);
  profilePanel.innerHTML =
    '<p class="repo-empty" role="status">Loading profile and repositories…</p>';

  const profileUrl = `https://api.github.com/users/${encodeURIComponent(login)}`;
  const reposUrl = `${profileUrl}/repos?sort=updated&per_page=6`;
  const [profileResult, reposResult] = await Promise.allSettled([
    requestJson(profileUrl),
    requestJson(reposUrl),
  ]);

  if (requestId !== activeRequest) return;
  if (profileResult.status === "rejected") {
    profilePanel.innerHTML = `<p class="repo-empty">${escapeHtml(profileResult.reason.message)}</p>`;
    return;
  }

  const profile = profileResult.value;
  const repos = reposResult.status === "fulfilled" ? reposResult.value : [];
  const reposError =
    reposResult.status === "rejected"
      ? `Could not load repositories: ${reposResult.reason.message}`
      : "";
  const displayName = profile.name || profile.login;

  profilePanel.innerHTML = `
    <div class="profile-header">
      <img class="profile-avatar" src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(displayName)}'s avatar" />
      <div class="profile-title">
        <h3>${escapeHtml(displayName)}</h3>
        <a class="profile-login" href="${escapeHtml(profile.html_url)}" target="_blank" rel="noreferrer">@${escapeHtml(profile.login)} ↗</a>
      </div>
    </div>
    ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ""}
    <div class="profile-meta">
      <span>${formatNumber(profile.followers)} followers</span>
      <span>${formatNumber(profile.following)} following</span>
      <span>${formatNumber(profile.public_repos)} public repos</span>
      ${renderMeta(profile)}
    </div>
    <div class="repo-heading">
      <h4>Recent repositories</h4>
      <span>UPDATED RECENTLY</span>
    </div>
    <div class="repo-list">${renderRepositories(repos, reposError)}</div>
  `;
}

async function searchUsers(query) {
  const requestId = ++activeRequest;
  searchButton.disabled = true;
  setStatus("Searching GitHub…", "loading");
  explorerLayout.hidden = true;
  resultCount.textContent = "";
  resultsHeading.textContent = `Results for “${query}”`;

  try {
    const params = new URLSearchParams({ q: query, per_page: "8" });
    const data = await requestJson(
      `https://api.github.com/search/users?${params}`,
    );
    if (requestId !== activeRequest) return;

    if (!data.items.length) {
      setStatus(`No GitHub users found for “${query}”. Try another search.`);
      return;
    }

    renderUsers(data.items);
    explorerLayout.hidden = false;
    resultCount.textContent = `${formatNumber(data.total_count)} matching users`;
    setStatus("");
    loadProfile(data.items[0].login, requestId);
  } catch (error) {
    if (requestId === activeRequest) {
      setStatus(
        error.message || "Something went wrong while searching GitHub.",
        "error",
      );
    }
  } finally {
    if (requestId === activeRequest) searchButton.disabled = false;
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (query) searchUsers(query);
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    searchInput.value = button.textContent.trim();
    searchUsers(searchInput.value);
  });
});
