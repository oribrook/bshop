// DOM Elements
const usersList = document.getElementById("usersList");
const conversationView = document.getElementById("conversationView");
const loading = document.getElementById("loading");
const emptyState = document.getElementById("emptyState");
const authOverlay = document.getElementById("authOverlay");
const tokenInput = document.getElementById("tokenInput");
const submitToken = document.getElementById("submitToken");
const authError = document.getElementById("authError");
const refreshButton = document.getElementById("refreshButton");

// State
let users = [];
let selectedUserId = null;
let isMobile = window.innerWidth <= 768;
let token = null;
const STORE_ID = 1;
const TOKEN_STORAGE_KEY = "chat_board_token";

// Format date to local time
function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Format relative time
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return "זה עתה";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `לפני ${minutes} ${minutes === 1 ? "דקה" : "דקות"}`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `לפני ${hours} ${hours === 1 ? "שעה" : "שעות"}`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `לפני ${days} ${days === 1 ? "יום" : "ימים"}`;
  } else {
    return formatDate(dateString);
  }
}

// Get last message preview
function getLastMessagePreview(messages) {
  if (!messages || messages.length === 0) return "";
  const lastMessage = messages[messages.length - 1];
  return (
    lastMessage.content.substring(0, 50) +
    (lastMessage.content.length > 50 ? "..." : "")
  );
}

// Save token to localStorage
function saveToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

// Get token from localStorage
function getTokenFromStorage() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

// Validate token function
async function validateToken(inputToken) {
  try {
    const response = await fetch(
      "https://bbot.genericgs.com/chat-board/end-users/all",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: inputToken,
          store_id: STORE_ID,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Token invalid");
    }

    // Token is valid
    token = inputToken;
    saveToken(token);
    hideAuthOverlay();

    // Process the data
    const data = await response.json();
    users = data;
    renderUsersList();

    return true;
  } catch (error) {
    console.error("Token validation error:", error);
    return false;
  }
}

// Fetch data from API
async function fetchData(showLoadingIndicator = true) {
  if (!token) {
    showAuthOverlay();
    return;
  }

  if (showLoadingIndicator) {
    loading.style.display = "block";
  }

  // Start refresh animation if it's a manual refresh
  if (!showLoadingIndicator) {
    refreshButton.classList.add("spinning");
  }

  try {
    const response = await fetch(
      "https://bbot.genericgs.com/chat-board/end-users/all",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          store_id: STORE_ID,
        }),
      }
    );

    if (!response.ok) {
      // If token is no longer valid
      if (response.status === 401 || response.status === 403) {
        // Clear invalid token
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        token = null;
        showAuthOverlay();
        throw new Error("Token invalid");
      }
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    users = data;

    // Check if selected user has new messages
    if (selectedUserId) {
      const updatedSelectedUser = data.find(
        (user) => user.id === selectedUserId
      );
      const currentSelectedUser = users.find(
        (user) => user.id === selectedUserId
      );

      if (
        updatedSelectedUser &&
        currentSelectedUser &&
        updatedSelectedUser.messages.length !==
        currentSelectedUser.messages.length
      ) {
        renderConversation(updatedSelectedUser);
      }
    }

    renderUsersList();
  } catch (error) {
    console.error("Error:", error);
    loading.innerHTML = `
      <div class="error-message">
          נכשל בטעינת נתונים. אנא נסה שוב מאוחר יותר.
          <p>${error.message}</p>
      </div>
    `;
  } finally {
    // Stop refresh animation
    refreshButton.classList.remove("spinning");
    if (showLoadingIndicator) {
      loading.style.display = "none";
    }
  }
}

// Show auth overlay
function showAuthOverlay() {
  authOverlay.style.display = "flex";
}

// Hide auth overlay
function hideAuthOverlay() {
  authOverlay.style.display = "none";
}

// Render users list
function renderUsersList() {
  loading.style.display = "none";

  if (!users || users.length === 0) {
    usersList.innerHTML = `
      <div class="button-container">
        <h2 style="padding: 16px;">שיחות</h2>
        <button class="refresh-button" id="refreshButton" title="רענן">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>
      <div class="empty-state"><h3>לא נמצאו שיחות</h3></div>
    `;

    // Re-attach the refresh button event listener
    document
      .getElementById("refreshButton")
      .addEventListener("click", handleRefreshClick);
    return;
  }

  // Sort users by last message time (newest first)
  users.sort((a, b) => {
    return new Date(b.last_msg_time) - new Date(a.last_msg_time);
  });

  usersList.innerHTML = `
    <div class="button-container">
      <h2 style="padding: 16px;">שיחות</h2>
      <button class="refresh-button" id="refreshButton" title="רענן">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
      </button>
    </div>
  `;

  users.forEach((user) => {
    const userItem = document.createElement("div");
    userItem.className = `user-item ${user.id === selectedUserId ? "active" : ""
      }`;
    userItem.dataset.id = user.id;

    const lastMessagePreview = getLastMessagePreview(user.messages);
    const lastMessageTime = formatRelativeTime(user.last_msg_time);

    userItem.innerHTML = `
      <div class="user-info">
          <div class="user-phone">${user.phone_number}</div>
          <div class="last-message-time">${lastMessageTime}</div>
      </div>
      <div class="message-preview">${lastMessagePreview}</div>
    `;

    userItem.addEventListener("click", () => {
      selectUser(user.id);
    });

    usersList.appendChild(userItem);
  });

  // Re-attach the refresh button event listener
  document
    .getElementById("refreshButton")
    .addEventListener("click", handleRefreshClick);
}

function selectUser(userId) {
  selectedUserId = userId;
  const selectedUser = users.find((user) => user.id === userId);

  // Update active class
  document.querySelectorAll(".user-item").forEach((item) => {
    item.classList.remove("active");
  });

  const activeItem = document.querySelector(
    `.user-item[data-id="${userId}"]`
  );
  if (activeItem) {
    activeItem.classList.add("active");
  }

  // Always hide the empty state when a user is selected
  emptyState.style.display = "none";

  // Show conversation view and hide users list on mobile
  if (isMobile) {
    usersList.classList.add("hide");
    conversationView.classList.add("active");
  }

  if (!selectedUser.messages || selectedUser.messages.length === 0) {
    emptyState.style.display = "flex";
    return;
  }

  renderConversation(selectedUser);
}

// Render conversation
function renderConversation(user) {
  if (!user) {
    conversationView.innerHTML =
      '<div class="empty-state"><h3>משתמש לא נמצא</h3></div>';
    return;
  }

  emptyState.style.display = "none";

  let backButton = "";
  if (isMobile) {
    backButton = `
      <button class="back-button" id="backButton">
          → חזרה לשיחות
      </button>
    `;
  }

  const formattedMessages = formatMessages(user.messages);

  conversationView.innerHTML = `
    <div class="conversation-header">
      <div class="header-right">
        ${backButton}
        <h2>טלפון: ${user.phone_number}</h2>
      </div>
      <div class="header-left">
        <button class="refresh-button" id="conversationRefreshButton" title="רענן שיחה">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="conversation-body" id="conversationBody">
      ${formattedMessages}
    </div>
  `;

  // Add back button event listener
  const backButtonEl = document.getElementById("backButton");
  if (backButtonEl) {
    backButtonEl.addEventListener("click", () => {
      // Show user list and hide conversation view
      usersList.classList.remove("hide");
      conversationView.classList.remove("active");

      // Reset the empty state display to handle the case
      // when there's no conversation selected
      if (!selectedUserId) {
        emptyState.style.display = "flex";
      }
    });
  }

  // Add conversation refresh button event listener
  const conversationRefreshButton = document.getElementById(
    "conversationRefreshButton"
  );
  if (conversationRefreshButton) {
    conversationRefreshButton.addEventListener(
      "click",
      handleRefreshClick
    );
  }

  // Scroll to bottom of conversation
  const conversationBody = document.getElementById("conversationBody");
  conversationBody.scrollTop = conversationBody.scrollHeight;
}

// Handle refresh button click
function handleRefreshClick() {
  fetchData(false); // false means don't show the main loading indicator
}
// Format messages for display
function formatMessages(messages) {
  if (!messages || messages.length === 0) {
    return '<div class="empty-message">לא נמצאו הודעות</div>';
  }

  // Sort messages by created time
  messages.sort((a, b) => {
    return new Date(a.created) - new Date(b.created);
  });

  let html = "";
  let currentSender = null;
  let messageGroup = "";

  messages.forEach((message, index) => {
    const formattedTime = formatDate(message.created);
    const isClient = message.sent_by === "client";
    const messageClass = isClient ? "message-client" : "message-business";

    // Replace newline characters with <br> tags for proper line breaks
    const formattedContent = message.content.replace(/\n/g, '<br>');

    // If sender changed or this is the first message, start a new group
    if (message.sent_by !== currentSender || index === 0) {
      // Add previous message group to HTML if it exists
      if (messageGroup) {
        html += `<div class="message-group">${messageGroup}</div>`;
        messageGroup = "";
      }
      currentSender = message.sent_by;
    }

    // Add message to current group
    messageGroup += `
      <div class="message ${messageClass}">
          <div class="message-content">${formattedContent}</div>
          <div class="message-time">${formattedTime}</div>
      </div>
    `;

    // If this is the last message, add the group to HTML
    if (index === messages.length - 1) {
      html += `<div class="message-group">${messageGroup}</div>`;
    }
  });

  return html;
}
// Check if device is mobile
function checkIfMobile() {
  isMobile = window.innerWidth <= 768;
}

// Submit token from form
function submitTokenHandler() {
  const inputToken = tokenInput.value.trim();

  if (!inputToken) {
    authError.textContent = "אנא הזן מפתח גישה";
    return;
  }

  authError.textContent = "";

  validateToken(inputToken)
    .then((isValid) => {
      if (!isValid) {
        authError.textContent = "מפתח גישה שגוי";
      }
    })
    .catch((error) => {
      authError.textContent = "אירעה שגיאה. אנא נסה שוב.";
      console.error("Token submission error:", error);
    });
}

// Initialize
function init() {
  checkIfMobile();

  // Event listeners
  submitToken.addEventListener("click", submitTokenHandler);
  refreshButton.addEventListener("click", handleRefreshClick);

  tokenInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      submitTokenHandler();
    }
  });

  // Add window resize event listener
  window.addEventListener("resize", checkIfMobile);

  // Check for token in localStorage
  token = getTokenFromStorage();

  if (token) {
    // Try to fetch data with stored token
    fetchData();
  } else {
    // Show auth overlay
    showAuthOverlay();
  }
}

// Start the app
init();
