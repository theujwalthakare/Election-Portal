import {
  db,
  ref,
  push,
  set,
  onValue,
  get,
  remove,
  update
} from "./firebase.js";

const ADMIN_CREDENTIALS = {
  username: "emasadmin",
  password: "vote2025!"
};
const ADMIN_SESSION_KEY = "emasAdminSession";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 6; // 6 hours

const state = {
  positions: {},
  voters: {},
  votes: {},
  listenersAttached: false,
  currentPositionManaging: null,
  currentPositionEditing: null
};

const selectors = {
  lastSyncedAt: document.getElementById("last-synced-at"),
  stats: {
    voters: document.getElementById("stats-total-voters"),
    positions: document.getElementById("stats-total-positions"),
    candidates: document.getElementById("stats-total-candidates"),
    votes: document.getElementById("stats-total-votes")
  },
  positionsCount: document.getElementById("positions-count"),
  votesLastUpdated: document.getElementById("votes-last-updated"),
  positionsList: document.getElementById("positions-list"),
  votersList: document.getElementById("voters-list"),
  votesTableBody: document.getElementById("votes-table-body"),
  candidateSelect: document.getElementById("candidate-position"),
  candidateModal: document.getElementById("manage-candidates-modal"),
  candidateModalTitle: document.getElementById("manage-candidates-title"),
  candidateModalDescription: document.getElementById("manage-candidates-description"),
  candidateModalList: document.getElementById("manage-candidates-list"),
  editPositionModal: document.getElementById("edit-position-modal"),
  editPositionForm: document.getElementById("edit-position-form"),
  editPositionSlug: document.getElementById("edit-position-slug"),
  editPositionTitle: document.getElementById("edit-position-title"),
  editPositionIcon: document.getElementById("edit-position-icon"),
  editPositionSeats: document.getElementById("edit-position-seats"),
  editPositionDescription: document.getElementById("edit-position-description"),
  authModal: document.getElementById("admin-auth-modal"),
  mobileMenuButton: document.getElementById("mobile-menu-button"),
  mobileMenu: document.getElementById("mobile-menu"),
  menuOpenIcon: document.getElementById("menu-open-icon"),
  menuCloseIcon: document.getElementById("menu-close-icon"),
  addPositionForm: document.getElementById("add-position-form"),
  addCandidateForm: document.getElementById("add-candidate-form"),
  refreshButton: document.getElementById("refresh-dashboard"),
  exportVotesButton: document.getElementById("export-votes"),
  clearSessionButton: document.getElementById("clear-admin-session"),
  eraseElectionDataButton: document.getElementById("erase-election-data"),
  authForm: document.getElementById("admin-auth-form")
};

const positionsRef = ref(db, "positions");
const votesRef = ref(db, "votes");
const votersRef = ref(db, "voters");

const slugify = (text) => text
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9\s-]/g, "")
  .replace(/\s+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "");

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const normaliseVoteEntry = (entry) => {
  if (!entry || typeof entry !== "object") return [];
  if (Array.isArray(entry)) {
    return entry.flatMap((item) => normaliseVoteEntry(item));
  }
  if (Object.prototype.hasOwnProperty.call(entry, "candidateId")) {
    return [entry];
  }
  return Object.values(entry).flatMap((item) => normaliseVoteEntry(item));
};

const countVotesInCollection = (votesByRoll) => {
  return Object.values(votesByRoll || {}).reduce((sum, entry) => {
    return sum + normaliseVoteEntry(entry).length;
  }, 0);
};

const ensureIcons = () => {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
};

function toggleMobileMenu() {
  const isMenuOpen = !selectors.mobileMenu.classList.contains("hidden");
  selectors.mobileMenu.classList.toggle("hidden");
  selectors.menuOpenIcon.classList.toggle("hidden", !isMenuOpen);
  selectors.menuCloseIcon.classList.toggle("hidden", isMenuOpen);
}

function initialiseAuthGate() {
  const existing = getActiveSession();
  if (existing) {
    hideAuthModal();
    attachRealtimeListeners();
  } else {
    showAuthModal();
  }
}

function getActiveSession() {
  const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (session.expiresAt && session.expiresAt > Date.now()) {
      return session;
    }
  } catch (error) {
    console.warn("Failed to parse admin session", error);
  }
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
  return null;
}

function startSession(username) {
  const session = {
    username,
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION_MS
  };
  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

function showAuthModal() {
  selectors.authModal.classList.remove("hidden");
  ensureIcons();
}

function hideAuthModal() {
  selectors.authModal.classList.add("hidden");
}

function attachRealtimeListeners() {
  if (state.listenersAttached) return;
  state.listenersAttached = true;

  onValue(positionsRef, (snapshot) => {
    state.positions = snapshot.val() || {};
    renderPositions();
    renderCandidateSelect();
    updateStats();
  });

  onValue(votersRef, (snapshot) => {
    state.voters = snapshot.val() || {};
    renderVoters();
    updateStats();
  });

  onValue(votesRef, (snapshot) => {
    state.votes = snapshot.val() || {};
    renderVotes();
    updateStats();
    selectors.votesLastUpdated.textContent = formatDateTime(Date.now());
    selectors.lastSyncedAt.textContent = formatDateTime(Date.now());
  });
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const username = document.getElementById("admin-username").value.trim();
  const password = document.getElementById("admin-password").value.trim();

  if (!username || !password) {
    await Swal.fire({
      icon: "warning",
      title: "Missing credentials",
      text: "Enter both username and password to continue.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
    return;
  }

  if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
    await Swal.fire({
      icon: "error",
      title: "Access denied",
      text: "The credentials you entered are incorrect.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
    return;
  }

  startSession(username);
  hideAuthModal();
  attachRealtimeListeners();

  await Swal.fire({
    icon: "success",
    title: "Welcome back",
    text: "Admin dashboard unlocked.",
    timer: 1500,
    showConfirmButton: false,
    background: "#0f172a",
    color: "#e2e8f0"
  });
}

async function handleAddPosition(event) {
  event.preventDefault();

  const titleInput = document.getElementById("position-title");
  const iconInput = document.getElementById("position-icon");
  const seatsInput = document.getElementById("position-seats");
  const descriptionInput = document.getElementById("position-description");

  const title = titleInput.value.trim();
  const icon = iconInput.value.trim() || "shield";
  const seatsRaw = seatsInput.value.trim();
  const description = descriptionInput.value.trim();

  if (!title) {
    await Swal.fire({
      icon: "warning",
      title: "Title required",
      text: "Please provide a position title.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
    return;
  }

  const slug = slugify(title);
  if (!slug) {
    await Swal.fire({
      icon: "warning",
      title: "Invalid title",
      text: "Title must contain letters or numbers.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
    return;
  }

  const parsedSeats = Number.parseInt(seatsRaw, 10);
  const availableSeats = Number.isFinite(parsedSeats) ? parsedSeats : 1;
  if (availableSeats < 1) {
    await Swal.fire({
      icon: "warning",
      title: "Invalid seat count",
      text: "Available seats must be at least 1.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
    return;
  }

  const existing = await get(ref(db, `positions/${slug}`));
  if (existing.exists()) {
    await Swal.fire({
      icon: "info",
      title: "Position exists",
      text: "A position with a similar name already exists.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
    return;
  }

  const payload = {
    slug,
    title,
    icon,
    description,
    availableSeats,
    createdAt: Date.now()
  };

  await set(ref(db, `positions/${slug}`), payload);

  selectors.addPositionForm.reset();
  seatsInput.value = "1";
  ensureIcons();

  await Swal.fire({
    icon: "success",
    title: "Position created",
    text: `${title} is now available for candidates.`,
    timer: 1800,
    showConfirmButton: false,
    background: "#0f172a",
    color: "#e2e8f0"
  });
}

async function handleAddCandidate(event) {
  event.preventDefault();

  const positionId = selectors.candidateSelect.value;
  const nameInput = document.getElementById("candidate-name");
  const imageInput = document.getElementById("candidate-image");
  const manifestoInput = document.getElementById("candidate-manifesto");

  const name = nameInput.value.trim();
  if (!positionId) {
    await Swal.fire({
      icon: "warning",
      title: "Select position",
      text: "Please choose a position first.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
    return;
  }

  if (!name) {
    await Swal.fire({
      icon: "warning",
      title: "Name required",
      text: "Candidate name cannot be empty.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
    return;
  }

  const candidateRef = push(ref(db, `positions/${positionId}/candidates`));
  const candidateId = candidateRef.key;

  const image = imageInput.value.trim() || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
  const manifesto = manifestoInput.value.trim();

  const payload = {
    id: candidateId,
    name,
    image,
    manifesto,
    createdAt: Date.now()
  };

  await set(candidateRef, payload);

  selectors.addCandidateForm.reset();
  selectors.candidateSelect.value = positionId;

  await Swal.fire({
    icon: "success",
    title: "Candidate added",
    text: `${name} is now listed under ${state.positions[positionId]?.title ?? "the selected position"}.`,
    timer: 1800,
    showConfirmButton: false,
    background: "#0f172a",
    color: "#e2e8f0"
  });
}

function renderCandidateSelect() {
  const entries = Object.entries(state.positions);
  selectors.candidateSelect.innerHTML = '<option value="">Select a position</option>';
  entries.forEach(([slug, position]) => {
    const option = document.createElement("option");
    option.value = slug;
    option.textContent = position.title ?? slug;
    selectors.candidateSelect.appendChild(option);
  });
}

function computeCandidateCount(position) {
  if (!position?.candidates) return 0;
  return Object.keys(position.candidates).length;
}

function renderPositions() {
  const entries = Object.entries(state.positions);
  selectors.positionsCount.textContent = `${entries.length} ${entries.length === 1 ? "item" : "items"}`;

  if (entries.length === 0) {
    selectors.positionsList.innerHTML = '<p class="text-sm text-gray-500">Positions you create will appear here. Use the form above to add your first leadership role.</p>';
    ensureIcons();
    return;
  }

  selectors.positionsList.innerHTML = entries
    .map(([slug, position]) => {
      const candidateCount = computeCandidateCount(position);
      const topCandidates = position.candidates ? Object.values(position.candidates).slice(0, 3) : [];
      const createdAt = formatDateTime(position.createdAt);
      const seatCount = Number(position.availableSeats) || 1;
      const seatLabel = seatCount === 1 ? "seat" : "seats";
      return `
        <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
            <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-3">
                    <span class="bg-red-600/10 text-red-400 p-3 rounded-xl">
                        <i data-lucide="${position.icon || "badge-check"}" class="w-5 h-5"></i>
                    </span>
                    <div>
                        <h4 class="text-lg font-semibold text-white">${position.title ?? slug}</h4>
                        <p class="text-xs text-gray-500">Created ${createdAt}</p>
                    </div>
                </div>
        <div class="flex flex-col items-end gap-1">
          <span class="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-gray-300">${candidateCount} candidate${candidateCount === 1 ? "" : "s"}</span>
          <span class="text-[11px] text-gray-400">${seatCount} ${seatLabel}</span>
        </div>
            </div>
            ${position.description ? `<p class="mt-3 text-sm text-gray-400">${position.description}</p>` : ""}
      <p class="mt-2 text-xs text-gray-500">Seat capacity: ${seatCount} ${seatLabel}.</p>
            <div class="mt-4 flex flex-wrap items-center gap-2">
                ${topCandidates.map(candidate => `<span class="bg-slate-800/70 text-gray-300 text-xs px-2.5 py-1 rounded-full">${candidate.name}</span>`).join("") || '<span class="text-xs text-gray-500">No candidates yet</span>'}
            </div>
            <div class="mt-5 flex flex-wrap gap-3">
        <button class="inline-flex items-center gap-2 text-sm font-semibold text-gray-200 bg-slate-800/80 hover:bg-slate-800 px-4 py-2 rounded-lg transition" data-action="edit" data-position="${slug}">
          <i data-lucide="pencil" class="w-4 h-4"></i>
          Edit details
        </button>
                <button class="inline-flex items-center gap-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition" data-action="manage" data-position="${slug}">
                    <i data-lucide="users" class="w-4 h-4"></i>
                    Manage candidates
                </button>
                <button class="inline-flex items-center gap-2 text-sm font-semibold text-red-400 bg-slate-800/80 hover:bg-slate-800 px-4 py-2 rounded-lg transition" data-action="delete" data-position="${slug}" data-title="${position.title ?? slug}">
                    <i data-lucide="trash" class="w-4 h-4"></i>
                    Delete position
                </button>
            </div>
        </div>
      `;
    })
    .join("\n");

  ensureIcons();
}

function renderVoters() {
  const entries = Object.values(state.voters)
    .map((voter) => ({
      ...voter,
      registeredAt: voter.registeredAt ?? 0
    }))
    .sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0))
    .slice(0, 12);

  if (entries.length === 0) {
    selectors.votersList.innerHTML = '<p class="text-sm text-gray-500">No voters have registered yet.</p>';
    return;
  }

  selectors.votersList.innerHTML = entries
    .map((voter) => `
      <div class="border border-slate-800 rounded-xl p-4 bg-slate-900/60 flex items-start justify-between gap-3">
          <div>
              <p class="text-sm font-semibold text-white">${voter.name ?? "Unknown voter"}</p>
              <p class="text-xs text-gray-500">${voter.roll ?? "--"}</p>
          </div>
          <span class="text-[11px] text-gray-500">${formatDateTime(voter.registeredAt)}</span>
      </div>
    `)
    .join("\n");
}

function renderVotes() {
  const positionEntries = Object.entries(state.votes);

  if (positionEntries.length === 0) {
    selectors.votesTableBody.innerHTML = '<tr><td colspan="3" class="py-6 text-center text-gray-600">Votes will appear as soon as students cast them.</td></tr>';
    return;
  }

  const rows = [];
  positionEntries.forEach(([positionKey, votesByRoll]) => {
    const tally = {};
    Object.values(votesByRoll || {}).forEach((voteEntry) => {
      normaliseVoteEntry(voteEntry).forEach((vote) => {
        const candidateKey = vote.candidateId || vote.candidateName || "unknown";
        if (!tally[candidateKey]) {
          tally[candidateKey] = {
            total: 0,
            candidateName: vote.candidateName || "Unknown",
            candidateId: candidateKey
          };
        }
        tally[candidateKey].total += 1;
      });
    });

    const sorted = Object.values(tally).sort((a, b) => b.total - a.total);
    const positionTitle = state.positions[positionKey]?.title ?? positionKey;

    if (sorted.length === 0) {
      rows.push(`
        <tr>
          <td class="py-3 pr-4 text-gray-300">${positionTitle}</td>
          <td class="py-3 pr-4 text-gray-500">No votes yet</td>
          <td class="py-3 text-gray-500">0</td>
        </tr>
      `);
    } else {
      sorted.forEach((entry) => {
        rows.push(`
          <tr>
            <td class="py-3 pr-4 text-gray-300">${positionTitle}</td>
            <td class="py-3 pr-4 text-gray-200">${entry.candidateName}</td>
            <td class="py-3 text-white font-semibold">${entry.total}</td>
          </tr>
        `);
      });
    }
  });

  selectors.votesTableBody.innerHTML = rows.join("\n");
}

function updateStats() {
  const totalVoters = Object.keys(state.voters).length;
  const totalPositions = Object.keys(state.positions).length;
  const totalCandidates = Object.values(state.positions).reduce((sum, position) => {
    return sum + computeCandidateCount(position);
  }, 0);
  const totalVotes = Object.values(state.votes).reduce((sum, votesByRoll) => {
    return sum + countVotesInCollection(votesByRoll);
  }, 0);

  selectors.stats.voters.textContent = totalVoters;
  selectors.stats.positions.textContent = totalPositions;
  selectors.stats.candidates.textContent = totalCandidates;
  selectors.stats.votes.textContent = totalVotes;
}

function openEditPosition(positionKey) {
  const position = state.positions[positionKey];
  if (!position) return;

  state.currentPositionEditing = positionKey;
  selectors.editPositionSlug.value = positionKey;
  selectors.editPositionTitle.value = position.title ?? positionKey;
  selectors.editPositionIcon.value = position.icon ?? "";
  selectors.editPositionSeats.value = String(position.availableSeats ?? 1);
  selectors.editPositionDescription.value = position.description ?? "";

  selectors.editPositionModal.classList.remove("hidden");
  ensureIcons();
}

window.closeEditPositionModal = function closeEditPositionModal() {
  selectors.editPositionModal.classList.add("hidden");
  selectors.editPositionForm.reset();
  selectors.editPositionSeats.value = "1";
  state.currentPositionEditing = null;
};

function openCandidateManager(positionKey) {
  state.currentPositionManaging = positionKey;
  const position = state.positions[positionKey];
  const seatCount = Number(position?.availableSeats) || 1;
  selectors.candidateModalTitle.textContent = position?.title ?? positionKey;
  const descriptionParts = [];
  if (position?.description) {
    descriptionParts.push(position.description);
  }
  descriptionParts.push(`${seatCount} available ${seatCount === 1 ? "seat" : "seats"}.`);
  selectors.candidateModalDescription.textContent = descriptionParts.join(" • ");

  const candidates = position?.candidates ? Object.values(position.candidates) : [];

  if (candidates.length === 0) {
    selectors.candidateModalList.innerHTML = '<p class="text-sm text-gray-500">No candidates registered yet. Use the form on the dashboard to add one.</p>';
  } else {
    selectors.candidateModalList.innerHTML = candidates
      .map((candidate) => `
        <div class="border border-slate-800 rounded-xl p-4 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div class="flex items-start gap-4">
                <img src="${candidate.image}" alt="${candidate.name}" class="w-16 h-16 rounded-full object-cover border border-slate-800">
                <div>
                    <p class="text-base font-semibold text-white">${candidate.name}</p>
                    ${candidate.manifesto ? `<p class="text-sm text-gray-400 mt-1">${candidate.manifesto}</p>` : ""}
                    <p class="text-[11px] text-gray-500 mt-2">Added ${formatDateTime(candidate.createdAt)}</p>
                </div>
            </div>
            <button class="inline-flex items-center gap-2 text-sm font-semibold text-red-400 bg-slate-800/70 hover:bg-slate-800 px-4 py-2 rounded-lg transition" data-action="delete-candidate" data-position="${positionKey}" data-candidate="${candidate.id}" data-name="${candidate.name}">
                <i data-lucide="trash" class="w-4 h-4"></i>
                Remove
            </button>
        </div>
      `)
      .join("\n");
  }

  selectors.candidateModal.classList.remove("hidden");
  ensureIcons();
}

window.closeCandidateManager = function closeCandidateManager() {
  selectors.candidateModal.classList.add("hidden");
  selectors.candidateModalList.innerHTML = "";
  state.currentPositionManaging = null;
};

async function handleUpdatePosition(event) {
  event.preventDefault();

  const slug = selectors.editPositionSlug.value;
  if (!slug) {
    window.closeEditPositionModal();
    return;
  }

  const title = selectors.editPositionTitle.value.trim();
  const iconRaw = selectors.editPositionIcon.value.trim();
  const seatsRaw = selectors.editPositionSeats.value.trim();
  const description = selectors.editPositionDescription.value.trim();

  if (!title) {
    await Swal.fire({
      icon: "warning",
      title: "Title required",
      text: "Please provide a position title.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
    return;
  }

  const parsedSeats = Number.parseInt(seatsRaw, 10);
  if (!Number.isFinite(parsedSeats) || parsedSeats < 1) {
    await Swal.fire({
      icon: "warning",
      title: "Invalid seat count",
      text: "Available seats must be at least 1.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
    return;
  }

  const icon = iconRaw || state.positions[slug]?.icon || "shield";

  try {
    await update(ref(db, `positions/${slug}`), {
      title,
      icon,
      availableSeats: parsedSeats,
      description,
      updatedAt: Date.now()
    });

    window.closeEditPositionModal();

    await Swal.fire({
      icon: "success",
      title: "Position updated",
      text: `${title} has been updated successfully.`,
      timer: 1600,
      showConfirmButton: false,
      background: "#0f172a",
      color: "#e2e8f0"
    });
  } catch (error) {
    console.error("Failed to update position", error);
    await Swal.fire({
      icon: "error",
      title: "Update failed",
      text: "Something went wrong while saving changes. Please try again.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
  }
}

async function deletePosition(positionKey, positionTitle) {
  const confirmation = await Swal.fire({
    icon: "warning",
    title: `Delete ${positionTitle}?`,
    text: "This will remove the position, its candidates, and all associated votes.",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#4b5563",
    confirmButtonText: "Delete",
    background: "#0f172a",
    color: "#e2e8f0"
  });

  if (!confirmation.isConfirmed) return;

  await remove(ref(db, `positions/${positionKey}`));
  await remove(ref(db, `votes/${positionKey}`));

  await Swal.fire({
    icon: "success",
    title: "Position removed",
    text: `${positionTitle} has been deleted.`,
    timer: 1800,
    showConfirmButton: false,
    background: "#0f172a",
    color: "#e2e8f0"
  });
}

async function deleteCandidate(positionKey, candidateId, candidateName) {
  const confirmation = await Swal.fire({
    icon: "warning",
    title: `Remove ${candidateName}?`,
    text: "This candidate will be removed from the election and their votes cleared.",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#4b5563",
    confirmButtonText: "Remove",
    background: "#0f172a",
    color: "#e2e8f0"
  });

  if (!confirmation.isConfirmed) return;

  const votesSnapshot = await get(ref(db, `votes/${positionKey}`));
  if (votesSnapshot.exists()) {
    const votes = votesSnapshot.val();
    const removals = [];
    Object.entries(votes).forEach(([roll, voteEntry]) => {
      if (voteEntry && typeof voteEntry === "object" && !Array.isArray(voteEntry) && !Object.prototype.hasOwnProperty.call(voteEntry, "candidateId")) {
        if (Object.prototype.hasOwnProperty.call(voteEntry, candidateId)) {
          const candidateKeys = Object.keys(voteEntry);
          if (candidateKeys.length <= 1) {
            removals.push(remove(ref(db, `votes/${positionKey}/${roll}`)));
          } else {
            removals.push(remove(ref(db, `votes/${positionKey}/${roll}/${candidateId}`)));
          }
        }
        return;
      }
      if (voteEntry?.candidateId === candidateId) {
        removals.push(remove(ref(db, `votes/${positionKey}/${roll}`)));
      }
    });
    await Promise.all(removals);
  }

  await remove(ref(db, `positions/${positionKey}/candidates/${candidateId}`));

  await Swal.fire({
    icon: "success",
    title: "Candidate removed",
    text: `${candidateName} has been unlisted from ${state.positions[positionKey]?.title ?? "the position"}.`,
    timer: 1600,
    showConfirmButton: false,
    background: "#0f172a",
    color: "#e2e8f0"
  });

  if (state.currentPositionManaging === positionKey) {
    openCandidateManager(positionKey);
  }
}

async function handleEraseElectionData() {
  const confirmation = await Swal.fire({
    icon: "warning",
    title: "Erase all election data?",
    html: "This will delete <strong>all voters and votes</strong> while keeping positions and candidates. This action cannot be undone.",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#4b5563",
    confirmButtonText: "Erase data",
    background: "#0f172a",
    color: "#e2e8f0"
  });

  if (!confirmation.isConfirmed) return;

  try {
    await Promise.all([
      remove(votersRef),
      remove(votesRef)
    ]);

    await Swal.fire({
      icon: "success",
      title: "Election data cleared",
      text: "All voter registrations and vote records have been erased.",
      timer: 1800,
      showConfirmButton: false,
      background: "#0f172a",
      color: "#e2e8f0"
    });
  } catch (error) {
    console.error("Failed to erase election data", error);
    await Swal.fire({
      icon: "error",
      title: "Erase failed",
      text: "Could not remove election data. Please try again.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
  }
}

function exportVotesAsCsv() {
  const rows = [["Position", "Candidate", "Roll Number", "Voter Name", "Timestamp"]];

  Object.entries(state.votes).forEach(([positionKey, votesByRoll]) => {
    Object.entries(votesByRoll || {}).forEach(([roll, voteEntry]) => {
      normaliseVoteEntry(voteEntry).forEach((vote) => {
        rows.push([
          state.positions[positionKey]?.title ?? positionKey,
          vote.candidateName ?? vote.candidateId ?? "Unknown",
          roll,
          vote.voterName ?? "",
          formatDateTime(vote.timestamp)
        ]);
      });
    });
  });

  if (rows.length === 1) {
    Swal.fire({
      icon: "info",
      title: "No votes yet",
      text: "Once votes start coming in you can export them as CSV.",
      background: "#0f172a",
      color: "#e2e8f0"
    });
    return;
  }

  const csvContent = rows
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `emas-votes-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function handlePositionsListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, position: positionKey, title } = button.dataset;

  if (action === "manage" && positionKey) {
    openCandidateManager(positionKey);
    return;
  }

  if (action === "edit" && positionKey) {
    openEditPosition(positionKey);
    return;
  }

  if (action === "delete" && positionKey) {
    deletePosition(positionKey, title || positionKey);
  }
}

function handleCandidateModalClick(event) {
  const button = event.target.closest("button[data-action='delete-candidate']");
  if (!button) return;
  const { position: positionKey, candidate: candidateId, name } = button.dataset;
  if (positionKey && candidateId) {
    deleteCandidate(positionKey, candidateId, name || "this candidate");
  }
}

function handleRefresh() {
  selectors.lastSyncedAt.textContent = formatDateTime(Date.now());
  Swal.fire({
    icon: "success",
    title: "Refreshed",
    text: "Realtime data refreshed.",
    timer: 1200,
    showConfirmButton: false,
    background: "#0f172a",
    color: "#e2e8f0"
  });
}

function handleSignOut() {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
  window.location.reload();
}

function initialiseEvents() {
  selectors.mobileMenuButton?.addEventListener("click", toggleMobileMenu);
  document.querySelectorAll('#mobile-menu a').forEach((link) => {
    link.addEventListener("click", () => {
      selectors.mobileMenu.classList.add("hidden");
      selectors.menuOpenIcon.classList.remove("hidden");
      selectors.menuCloseIcon.classList.add("hidden");
    });
  });

  selectors.authForm.addEventListener("submit", handleAuthSubmit);
  selectors.addPositionForm.addEventListener("submit", handleAddPosition);
  selectors.addCandidateForm.addEventListener("submit", handleAddCandidate);
  selectors.editPositionForm.addEventListener("submit", handleUpdatePosition);
  selectors.positionsList.addEventListener("click", handlePositionsListClick);
  selectors.candidateModalList.addEventListener("click", handleCandidateModalClick);
  selectors.refreshButton.addEventListener("click", handleRefresh);
  selectors.exportVotesButton.addEventListener("click", exportVotesAsCsv);
  selectors.clearSessionButton.addEventListener("click", handleSignOut);
  selectors.eraseElectionDataButton.addEventListener("click", handleEraseElectionData);
}

function bootstrap() {
  ensureIcons();
  initialiseEvents();
  initialiseAuthGate();
}

bootstrap();
