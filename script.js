const state = {
  endpoint: "/api/ffvb-live",
  data: null,
  viewMode: "team",
  selectedWeekKey: null,
  selectedTeam: null,
  showEmptyMatches: false,
  showUpcomingOnly: false,
};

const els = {
  siteShell: document.querySelector("#site-shell"),
  title: document.querySelector("#page-title"),
  season: document.querySelector("#season-name"),
  lastSync: document.querySelector("#last-sync"),
  teamsCount: document.querySelector("#teams-count"),
  matchesCount: document.querySelector("#matches-count"),
  status: document.querySelector("#status-line"),
  matchesSectionNote: document.querySelector("#matches-section-note"),
  sourceLink: document.querySelector("#source-link"),
  standingsHead: document.querySelector("#standings-head"),
  standingsBody: document.querySelector("#standings-body"),
  standingsSummary: document.querySelector("#standings-summary"),
  matchesRoot: document.querySelector("#matches-root"),
  reloadButton: document.querySelector("#reload-button"),
  tabRanking: document.querySelector("#tab-ranking"),
  tabSeason: document.querySelector("#tab-season"),
  rankingPanel: document.querySelector("#ranking-panel"),
  seasonPanel: document.querySelector("#season-panel"),
  secondaryFilterLabel: document.querySelector("#secondary-filter-label"),
  secondaryFilter: document.querySelector("#secondary-filter"),
  showEmptyMatches: document.querySelector("#show-empty-matches"),
  showUpcomingOnly: document.querySelector("#show-upcoming-only"),
  viewByMatchday: document.querySelector("#view-by-matchday"),
  viewByTeam: document.querySelector("#view-by-team"),
  seeDetailedStandings: document.querySelector("#see-detailed-standings"),
  matchesSection: document.querySelector("#matches-section"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseCompetitionMeta(title, sourceUrl) {
  const cleanTitle = String(title || "").trim();
  const poolMatch = cleanTitle.match(/Poule\s+([A-Z0-9]+)/i);
  const seasonMatch = String(sourceUrl || "").match(/saison=([^&]+)/i);
  const season = seasonMatch ? decodeURIComponent(seasonMatch[1]) : "2025/2026";

  return {
    season,
    pool: poolMatch ? `Poule ${poolMatch[1].toUpperCase()}` : "Poule officielle",
    phase: "Phase régulière",
  };
}

function parseDate(dateString, timeString = "12:00") {
  const dateMatch = String(dateString).match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!dateMatch) {
    return null;
  }

  const [, day, month, year] = dateMatch;
  const [hours = "12", minutes = "00"] = String(timeString).split(":");
  const fullYear = Number(year) + 2000;

  return new Date(fullYear, Number(month) - 1, Number(day), Number(hours), Number(minutes));
}

function getInitials(name) {
  const words = String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!words.length) {
    return "??";
  }

  return words.map((word) => word[0]).join("").toUpperCase();
}

function isPlaceholderTeam(name) {
  return String(name || "").trim().toLowerCase() === "xxxxx";
}

function isMissingOpponentMatch(match) {
  return isPlaceholderTeam(match.home_team) || isPlaceholderTeam(match.away_team);
}

function isUpcomingMatch(match) {
  const parsedDate = parseDate(match.date, match.time === "00:01" ? "23:59" : match.time);
  if (!parsedDate) {
    return false;
  }

  return parsedDate >= new Date();
}

function shouldDisplayMatch(match) {
  if (!state.showEmptyMatches && isMissingOpponentMatch(match)) {
    return false;
  }

  if (state.showUpcomingOnly && !isUpcomingMatch(match)) {
    return false;
  }

  return true;
}

function getMatchStatus(match) {
  const hasScore = match.home_score !== "" && match.away_score !== "";
  const homePlaceholder = isPlaceholderTeam(match.home_team);
  const awayPlaceholder = isPlaceholderTeam(match.away_team);

  if (homePlaceholder && awayPlaceholder) {
    return { label: "Exempt", tone: "muted" };
  }

  if (homePlaceholder || awayPlaceholder) {
    return { label: "À compléter", tone: "muted" };
  }

  if (hasScore) {
    return { label: "Terminé", tone: "success" };
  }

  if (match.time === "00:01") {
    return { label: "Horaire à confirmer", tone: "warning" };
  }

  return { label: "À jouer", tone: "info" };
}

function getMatchMeta(match) {
  const details = [];

  if (match.code) {
    details.push(match.code);
  }

  if (match.location) {
    details.push(match.location);
  }

  if (match.referee) {
    details.push(`Arbitre: ${match.referee}`);
  } else if (!match.home_score && match.points_score && !/\d{2,3}-\d{2,3}/.test(match.points_score)) {
    details.push(match.points_score);
  }

  return details;
}

function getMatchCenterDetail(match, hasScore) {
  const hasSetDetails = String(match.sets || "").trim() !== "";

  if (hasScore && hasSetDetails) {
    return match.sets;
  }

  if (hasScore) {
    return "Résultat validé";
  }

  if (match.time === "00:01") {
    return "Programmation en attente";
  }

  return "Avant-match";
}

function isCompactPendingMatch(match) {
  return getMatchStatus(match).label === "À compléter";
}

function renderCompactPendingCard(match, contextLabel) {
  const details = getMatchMeta(match);

  return `
    <article class="match-card match-card-compact">
      <div class="match-card-top match-card-top-compact">
        <div class="match-date match-date-inline">
          <strong>${escapeHtml(match.date || "Date à confirmer")}</strong>
          <span>${escapeHtml(match.time === "00:01" ? "Horaire à confirmer" : match.time || "Horaire à venir")}</span>
        </div>
        <span class="detail-pill detail-pill-soft">${escapeHtml(contextLabel)}</span>
      </div>

      <div class="pending-inline-layout">
        <div class="pending-team pending-team-home">
          <div class="pending-team-copy">
            <strong>${escapeHtml(match.home_team || "Équipe à confirmer")}</strong>
          </div>
        </div>

        <div class="pending-status-core">
          <span class="pending-status-pill">Match non joué</span>
        </div>

        <div class="pending-team pending-team-away">
          <div class="pending-team-copy">
            <strong>${escapeHtml(match.away_team || "Équipe à confirmer")}</strong>
          </div>
        </div>
      </div>

      ${
        details.length
          ? `
            <div class="match-card-meta">
              ${details
                .map((detail) => `<span class="detail-pill">${escapeHtml(detail)}</span>`)
                .join("")}
            </div>
          `
          : ""
      }
    </article>
  `;
}

function getVisibleGroups(groups) {
  return groups
    .map((group) => ({
      ...group,
      matches: (group.matches || []).filter((match) => shouldDisplayMatch(match)),
    }))
    .filter((group) => group.matches.length > 0);
}

function getWeekStart(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + diff);
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatWeekLabel(startDate, endDate) {
  return `Semaine du ${formatShortDate(startDate)} au ${formatLongDate(endDate)}`;
}

function getWeekBuckets(groups) {
  const weekMap = new Map();

  for (const group of getVisibleGroups(groups)) {
    for (const match of group.matches) {
      const parsedDate = parseDate(match.date, match.time === "00:01" ? "12:00" : match.time);
      if (!parsedDate) {
        continue;
      }

      const weekStart = getWeekStart(parsedDate);
      const weekEnd = addDays(weekStart, 6);
      const key = weekStart.toISOString().slice(0, 10);

      if (!weekMap.has(key)) {
        weekMap.set(key, {
          key,
          startDate: weekStart,
          endDate: weekEnd,
          label: formatWeekLabel(weekStart, weekEnd),
          matches: [],
        });
      }

      weekMap.get(key).matches.push({
        ...match,
        groupLabel: group.label,
      });
    }
  }

  return [...weekMap.values()]
    .sort((a, b) => a.startDate - b.startDate)
    .map((bucket) => {
      const grouped = new Map();

      for (const match of bucket.matches) {
        if (!grouped.has(match.groupLabel)) {
          grouped.set(match.groupLabel, []);
        }
        grouped.get(match.groupLabel).push(match);
      }

      return {
        ...bucket,
        groups: [...grouped.entries()].map(([label, matches]) => ({ label, matches })),
      };
    });
}

function getDefaultWeekKey(groups) {
  const buckets = getWeekBuckets(groups);
  const now = new Date();

  const nextUpcoming = buckets.find((bucket) =>
    bucket.matches.some((match) => {
      const parsedDate = parseDate(match.date, match.time);
      return parsedDate && parsedDate >= now;
    }),
  );

  if (nextUpcoming) {
    return nextUpcoming.key;
  }

  return buckets.at(-1)?.key ?? null;
}

function getAllTeams(data) {
  const teamSet = new Set();

  for (const group of data.matches.groups || []) {
    for (const match of group.matches || []) {
      if (!shouldDisplayMatch(match)) {
        continue;
      }
      if (match.home_team && !isPlaceholderTeam(match.home_team)) {
        teamSet.add(match.home_team);
      }
      if (match.away_team && !isPlaceholderTeam(match.away_team)) {
        teamSet.add(match.away_team);
      }
    }
  }

  return [...teamSet].sort((a, b) => a.localeCompare(b, "fr"));
}

function renderTeam(name, side) {
  const safeName = escapeHtml(name || "Équipe à confirmer");
  const placeholder = isPlaceholderTeam(name);
  const teamClass = placeholder ? "team team-placeholder" : "team";

  return `
    <div class="${teamClass} team-${side}">
      <span class="team-name">${safeName}</span>
    </div>
  `;
}

function renderStandings(data) {
  const columns = data.standings.columns || [];
  const rows = data.standings.rows || [];

  els.standingsHead.innerHTML = `
    <tr>
      ${columns
        .map((column, index) => {
          const className = index === 1 ? "team-cell" : "";
          const label = column || "Pos.";
          return `<th class="${className}">${escapeHtml(label)}</th>`;
        })
        .join("")}
    </tr>
  `;

  els.standingsBody.innerHTML = rows
    .map((row, rowIndex) => {
      return `
        <tr>
          ${row
            .map((cell, index) => {
              if (index === 0) {
                return `
                  <td>
                    <span class="rank-chip rank-chip-${rowIndex < 3 ? "top" : "standard"}">
                      ${escapeHtml(cell.replace(".", ""))}
                    </span>
                  </td>
                `;
              }

              const className = index === 1 ? "team-cell" : "";
              if (index === 1) {
                return `
                  <td class="${className}">
                    <button
                      class="standings-team-link"
                      type="button"
                      data-team-link="${escapeHtml(cell)}"
                    >
                      ${escapeHtml(cell)}
                    </button>
                  </td>
                `;
              }

              return `<td class="${className}">${escapeHtml(cell)}</td>`;
            })
            .join("")}
        </tr>
      `;
    })
    .join("");

  els.standingsSummary.innerHTML = rows
    .slice(0, 5)
    .map((row, index) => {
      const rank = row[0]?.replace(".", "") || String(index + 1);
      const team = row[1] || "Équipe";
      const points = row[2] || "-";
      const played = row[3] || "-";

      return `
        <article class="summary-row">
          <span class="summary-rank">${escapeHtml(rank)}</span>
          <div class="summary-team">
            <strong>${escapeHtml(team)}</strong>
          </div>
          <strong class="summary-points">${escapeHtml(points)}</strong>
          <span class="summary-played">${escapeHtml(played)}</span>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-team-link]").forEach((button) => {
    button.addEventListener("click", () => {
      const team = button.getAttribute("data-team-link");
      if (!team || !state.data) {
        return;
      }

      state.selectedTeam = team;
      state.viewMode = "team";
      setActiveModuleTab("season");
      setActiveToolbarTab(els.viewByTeam);
      renderSecondaryFilter(state.data);
      renderMatches(state.data);
      scrollToSection(els.matchesSection, els.viewByTeam);
    });
  });
}

function renderSecondaryFilter(data) {
  if (!data) {
    return;
  }

  if (state.viewMode === "team") {
    const teams = getAllTeams(data);
    els.secondaryFilterLabel.textContent = "Sélectionnez l’équipe";
    els.secondaryFilter.innerHTML = [
      `<label class="team-select-field">
        <select class="team-select" id="team-select">
          <option value="all">Toutes les équipes</option>
          ${teams
            .map(
              (team) => `
                <option value="${escapeHtml(team)}" ${state.selectedTeam === team ? "selected" : ""}>
                  ${escapeHtml(team)}
                </option>
              `,
            )
            .join("")}
        </select>
      </label>`,
    ].join("");

    const select = document.querySelector("#team-select");
    if (select) {
      select.value = state.selectedTeam || "all";
      select.addEventListener("change", () => {
        state.selectedTeam = select.value;
        renderSecondaryFilter(data);
        renderMatches(state.data);
      });
    }

    return;
  }

  const buckets = getWeekBuckets(data.matches.groups || []);
  els.secondaryFilterLabel.textContent = "Période";

  if (!buckets.length) {
    els.secondaryFilter.innerHTML = "";
    return;
  }

  if (!state.selectedWeekKey || !buckets.some((bucket) => bucket.key === state.selectedWeekKey)) {
    state.selectedWeekKey = getDefaultWeekKey(data.matches.groups || []);
  }

  const currentIndex = Math.max(
    0,
    buckets.findIndex((bucket) => bucket.key === state.selectedWeekKey),
  );
  const currentBucket = buckets[currentIndex];

  els.secondaryFilter.innerHTML = `
    <div class="week-nav">
      <button
        class="week-nav-button"
        type="button"
        data-week-nav="prev"
        ${currentIndex === 0 ? "disabled" : ""}
        aria-label="Semaine précédente"
      >
        &#8592;
      </button>
      <div class="week-nav-labels">
        <strong>${escapeHtml(currentBucket.label)}</strong>
        <span>${escapeHtml(
          `${currentBucket.matches.length} matchs · ${[...new Set(currentBucket.groups.map((group) => group.label.replace("Journée ", "J")))].join(", ")}`,
        )}</span>
      </div>
      <button
        class="week-nav-button"
        type="button"
        data-week-nav="next"
        ${currentIndex === buckets.length - 1 ? "disabled" : ""}
        aria-label="Semaine suivante"
      >
        &#8594;
      </button>
    </div>
  `;

  els.secondaryFilter.querySelectorAll("[data-week-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.getAttribute("data-week-nav");
      const nextIndex = direction === "prev" ? currentIndex - 1 : currentIndex + 1;
      if (!buckets[nextIndex]) {
        return;
      }
      state.selectedWeekKey = buckets[nextIndex].key;
      renderSecondaryFilter(data);
      renderMatches(state.data);
    });
  });
}

function renderTeamMatches(data) {
  const groups = data.matches.groups || [];
  const selectedTeam = state.selectedTeam && state.selectedTeam !== "all" ? state.selectedTeam : null;
  const filteredMatches = groups.flatMap((group) =>
    group.matches
      .filter(
        (match) =>
          shouldDisplayMatch(match) &&
          (!selectedTeam ||
            match.home_team === selectedTeam ||
            match.away_team === selectedTeam),
      )
      .map((match) => ({ ...match, groupLabel: group.label })),
  );

  if (!filteredMatches.length) {
    els.matchesRoot.innerHTML =
      '<div class="empty-state">Aucun match trouvé pour cette équipe.</div>';
    return;
  }

  els.matchesSectionNote.textContent = selectedTeam
    ? `${selectedTeam} · ${filteredMatches.length} matchs trouvés.`
    : `${filteredMatches.length} matchs affichés pour l’ensemble des équipes.`;

  const matchCards = filteredMatches
    .map((match) => {
      const status = getMatchStatus(match);
      const hasScore = match.home_score !== "" && match.away_score !== "";
      const selectedIsHome = selectedTeam && match.home_team === selectedTeam;
      const focusLabel = selectedTeam
        ? selectedIsHome
          ? "Domicile"
          : "Extérieur"
        : match.groupLabel;

      if (isCompactPendingMatch(match)) {
        return renderCompactPendingCard(match, focusLabel);
      }

      const details = getMatchMeta(match);
      const metaText = details.join(" · ");

      return `
        <article class="match-card">
          <div class="match-card-top">
            <div class="match-date match-date-inline">
              <strong>${escapeHtml(match.date || "Date à confirmer")}</strong>
              <span>${escapeHtml(match.time === "00:01" ? "Horaire à confirmer" : match.time || "Horaire à venir")}</span>
            </div>
          </div>

          <div class="match-body">
            ${renderTeam(match.home_team, "home")}
            <div class="match-center">
              ${
                hasScore
                  ? `
                    <div class="score-block score-block-final">
                      <strong>${escapeHtml(match.home_score)}</strong>
                      <span>-</span>
                      <strong>${escapeHtml(match.away_score)}</strong>
                    </div>
                  `
                  : `
                    <div class="score-block score-block-pending">
                      <span>${escapeHtml(status.label)}</span>
                    </div>
                  `
              }
              <span class="match-points">${escapeHtml(getMatchCenterDetail(match, hasScore))}</span>
            </div>
            ${renderTeam(match.away_team, "away")}
          </div>

          <div class="match-card-bottom">
            <span class="detail-meta-text">${escapeHtml(metaText || "")}</span>
            <span class="detail-text">${escapeHtml(match.groupLabel)}</span>
          </div>
        </article>
      `;
    })
    .join("");

  els.matchesRoot.innerHTML = `<div class="match-cards-grid">${matchCards}</div>`;
}

function renderMatches(data) {
  if (state.viewMode === "team") {
    renderTeamMatches(data);
    return;
  }

  const buckets = getWeekBuckets(data.matches.groups || []);
  const activeBucket =
    buckets.find((bucket) => bucket.key === state.selectedWeekKey) || buckets[0];

  if (!activeBucket || !activeBucket.groups.length) {
    els.matchesRoot.innerHTML =
      '<div class="empty-state">Aucun match trouvé pour cette sélection.</div>';
    return;
  }

  state.selectedWeekKey = activeBucket.key;
  els.matchesSectionNote.textContent = `${activeBucket.matches.length} matchs affichés sur la période sélectionnée.`;

  els.matchesRoot.innerHTML = activeBucket.groups
    .map((group) => {
      const matchCards = group.matches
        .map((match) => {
          if (isCompactPendingMatch(match)) {
            return renderCompactPendingCard(match, group.label);
          }

          const status = getMatchStatus(match);
          const hasScore = match.home_score !== "" && match.away_score !== "";
          const scoreMarkup = hasScore
            ? `
                <div class="score-block score-block-final">
                  <strong>${escapeHtml(match.home_score)}</strong>
                  <span>-</span>
                  <strong>${escapeHtml(match.away_score)}</strong>
                </div>
              `
            : `
                <div class="score-block score-block-pending">
                  <span>${escapeHtml(status.label)}</span>
                </div>
              `;
          const details = getMatchMeta(match);
          const metaText = details.join(" · ");

          return `
            <article class="match-card">
              <div class="match-card-top">
                <div class="match-date match-date-inline">
                  <strong>${escapeHtml(match.date || "Date à confirmer")}</strong>
                  <span>${escapeHtml(match.time === "00:01" ? "Horaire à confirmer" : match.time || "Horaire à venir")}</span>
                </div>
              </div>

              <div class="match-body">
                ${renderTeam(match.home_team, "home")}
                <div class="match-center">
                  ${scoreMarkup}
                  <span class="match-points">${escapeHtml(getMatchCenterDetail(match, hasScore))}</span>
                </div>
                ${renderTeam(match.away_team, "away")}
              </div>

              <div class="match-card-bottom">
                <span class="detail-meta-text">${escapeHtml(metaText || "")}</span>
                ${
                  match.sets
                    ? `<span class="detail-text">${escapeHtml(match.sets)}</span>`
                    : '<span class="detail-text">Aucun détail de sets communiqué</span>'
                }
              </div>
            </article>
          `;
        })
        .join("");

      return `
        <section class="matchday-group">
          <div class="matchday-group-header">
            <div>
              <p class="section-label">Journée</p>
              <h3>${escapeHtml(group.label)}</h3>
            </div>
            <span class="matchday-count">${group.matches.length} affiches</span>
          </div>
          <div class="match-cards-grid">${matchCards}</div>
        </section>
      `;
    })
    .join("");
}

function setActiveToolbarTab(tab) {
  [els.viewByMatchday, els.viewByTeam].forEach((button) => {
    button.classList.toggle("active", button === tab);
    button.setAttribute("aria-selected", button === tab ? "true" : "false");
  });
}

function setActiveModuleTab(tabName) {
  const rankingActive = tabName === "ranking";
  els.siteShell.dataset.primaryTab = rankingActive ? "ranking" : "season";
  els.tabRanking.classList.toggle("active", rankingActive);
  els.tabSeason.classList.toggle("active", !rankingActive);
  els.tabRanking.setAttribute("aria-selected", rankingActive ? "true" : "false");
  els.tabSeason.setAttribute("aria-selected", rankingActive ? "false" : "true");
  els.rankingPanel.hidden = !rankingActive;
  els.seasonPanel.hidden = rankingActive;
  els.rankingPanel.classList.toggle("tab-panel-active", rankingActive);
  els.seasonPanel.classList.toggle("tab-panel-active", !rankingActive);
}

function scrollToSection(section, tab) {
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  if (tab) {
    setActiveToolbarTab(tab);
  }
}

function populateMeta(data) {
  const meta = parseCompetitionMeta(data.competition, data.source_url);
  const totalMatches = data.matches.total_matches || 0;
  const teams = data.standings.rows.length || 0;

  els.title.textContent = data.title;
  els.season.textContent = meta.season;
  els.lastSync.textContent = data.fetched_at;
  els.teamsCount.textContent = String(teams);
  els.matchesCount.textContent = String(totalMatches);
  els.sourceLink.href = data.source_url;
  els.status.textContent = "";
}

async function loadData() {
  els.status.textContent = "";
  els.reloadButton.disabled = true;

  try {
    const response = await fetch(`${state.endpoint}?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    state.data = data;

    if (!state.selectedTeam) {
      state.selectedTeam = "all";
    }
    if (!state.selectedWeekKey) {
      state.selectedWeekKey = getDefaultWeekKey(data.matches.groups || []);
    }

    populateMeta(data);
    renderStandings(data);
    renderSecondaryFilter(data);
    renderMatches(data);
  } catch (error) {
    els.status.textContent = "";
    els.matchesRoot.innerHTML =
      '<div class="empty-state">Impossible de charger les données FFVB.</div>';
    els.standingsSummary.innerHTML =
      '<div class="empty-state">Le classement n’a pas pu être récupéré.</div>';
  } finally {
    els.reloadButton.disabled = false;
  }
}

els.reloadButton.addEventListener("click", loadData);
els.viewByMatchday.addEventListener("click", () => {
  if (!state.data) {
    return;
  }
  state.viewMode = "matchday";
  setActiveToolbarTab(els.viewByMatchday);
  state.selectedWeekKey = getDefaultWeekKey(state.data.matches.groups || []);
  renderSecondaryFilter(state.data);
  renderMatches(state.data);
  scrollToSection(els.matchesSection, els.viewByMatchday);
});
els.viewByTeam.addEventListener("click", () => {
  if (!state.data) {
    return;
  }
  state.viewMode = "team";
  setActiveToolbarTab(els.viewByTeam);
  renderSecondaryFilter(state.data);
  renderMatches(state.data);
  scrollToSection(els.matchesSection, els.viewByTeam);
});
els.showEmptyMatches.addEventListener("change", () => {
  if (!state.data) {
    return;
  }
  state.showEmptyMatches = els.showEmptyMatches.checked;
  state.selectedWeekKey = getDefaultWeekKey(state.data.matches.groups || []);
  renderSecondaryFilter(state.data);
  renderMatches(state.data);
});
els.showUpcomingOnly.addEventListener("change", () => {
  if (!state.data) {
    return;
  }
  state.showUpcomingOnly = els.showUpcomingOnly.checked;
  state.selectedWeekKey = getDefaultWeekKey(state.data.matches.groups || []);
  renderSecondaryFilter(state.data);
  renderMatches(state.data);
});
els.tabRanking.addEventListener("click", () => {
  setActiveModuleTab("ranking");
});
els.tabSeason.addEventListener("click", () => {
  setActiveModuleTab("season");
});
els.seeDetailedStandings.addEventListener("click", () => {
  setActiveModuleTab("ranking");
  scrollToSection(els.rankingPanel);
});

setActiveModuleTab("ranking");
loadData();
