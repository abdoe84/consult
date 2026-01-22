// ============================
// State Management
// ============================

/**
 * Application state
 */
let currentUser = null;
let currentRequest = null;
let currentOffer = null;
let currentProject = null;
let actionsBound = false;

/**
 * Get current user
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Set current user
 */
export function setCurrentUser(user) {
  currentUser = user;
}

/**
 * Get current request
 */
export function getCurrentRequest() {
  return currentRequest;
}

/**
 * Set current request
 */
export function setCurrentRequest(request) {
  currentRequest = request;
}

/**
 * Get current offer
 */
export function getCurrentOffer() {
  return currentOffer;
}

/**
 * Set current offer
 */
export function setCurrentOffer(offer) {
  currentOffer = offer;
}

/**
 * Get current project
 */
export function getCurrentProject() {
  return currentProject;
}

/**
 * Set current project
 */
export function setCurrentProject(project) {
  currentProject = project;
}

/**
 * Check if actions are already bound
 */
export function areActionsBound() {
  return actionsBound;
}

/**
 * Mark actions as bound
 */
export function setActionsBound(value = true) {
  actionsBound = value;
}

/**
 * Check if current user is manager
 */
export function isManager() {
  return String(currentUser?.role || "").toUpperCase() === "MANAGER";
}

/**
 * Get offer status
 */
export function offerStatus() {
  return String(currentOffer?.status || "").toUpperCase();
}

/**
 * Generate auto-create key for session storage
 */
export function autoCreateKey(requestId) {
  return `AUTO_PROJECT_TRIED_${requestId}`;
}
