/**
 * @file captivePortalScript.js
 * @description Client-side logic for a captive portal configuration interface
 *              that allows users to map actions to buttons on a controller,
 *              organized by Sip/Puff (SP) sensor channels. Supports creating,
 *              saving, loading, and deleting named configuration profiles which
 *              are persisted on the device via a REST API.
 *
 * Key Details to Note:
 *  - "SP" (Sip/Puff) sensors: up to 3 input sensors (SP1, SP2, SP3) that a
 *    user selects to scope which sensor a button binding belongs to.
 *  - "Bindings": a mapping of button IDs to action strings, grouped per sensor.
 *  - "Profile": a named, saveable configuration object containing all bindings.
 *  - Popups: modal overlays driven by a CSS "show" class toggled via JS.
 */
 
// ─── State Variables ───────────────────────────────────────────────────────────
 
/** @type {string} The ID of the controller button currently being configured. */
let currentButton = '';
 
/** @type {string|null} The currently active Sip/Puff sensor ID (e.g. "SP1"), or null if none selected. */
let selectedSP = null;
 
/** @type {string} Display label for the active configuration (used in the UI title area). */
let currentConfig = "New Configuration"
 
/** @type {string} The name of the profile that was most recently saved or loaded. */
let currentProfile = ""
 
/**
 * @type {{
 *   name: string,
 *   bindings: {
 *     SP1: Object.<string, string>,
 *     SP2: Object.<string, string>,
 *     SP3: Object.<string, string>
 *   }
 * }}
 * The in-memory configuration object. `bindings` maps each SP sensor ID to
 * a dictionary of { buttonId: actionString } pairs.
 */
let config = {
    name: "",
    bindings: {
        SP1: {},
        SP2: {},
        SP3: {}
    }
};
 
/** @type {string[]} List of profile names retrieved from the device. */
let profileList = [];
 
/** @type {string[]} Reserved for future use: pinned/favorite profile names. */
let favorites = [];
 
/** @constant {number} Maximum number of profiles that can be stored on the device. */
const MAX_PROFILES = 20;
 
/** @constant {number} Maximum number of profiles that can be marked as favorites. */
const MAX_FAVORITES = 3
 
// ─── Initialization ────────────────────────────────────────────────────────────
 
/**
 * Runs once the page has fully loaded.
 * - (Commented out) Fetches the saved profile list from the device.
 * - Attaches click-outside-to-close behavior to all popup overlays, so that
 *   clicking on the dark backdrop (but not the inner content box) dismisses the popup.
 */
window.onload = function () {
    //fetchProfileList();
 
    // Close any popup when the user clicks its backdrop (the popup element itself,
    // not any child element inside it).
    document.querySelectorAll('.popup').forEach(popup => {
        popup.addEventListener('click', function (e) {
            // If user clicks the dark background (not the inner content)
            if (e.target === popup) {
                popup.classList.remove('show');
            }
        });
    });
};
 
// ─── Dropdown Menu ─────────────────────────────────────────────────────────────
 
/**
 * Toggles the visibility of the main dropdown navigation menu.
 * Uses the CSS "show" class on the #dropdownMenu element.
 */
function toggleDropdown() {
    const menu = document.getElementById('dropdownMenu');
    menu.classList.toggle('show');
}
 
/**
 * Global click handler that closes the dropdown menu when the user clicks
 * anywhere outside the dropdown toggle button.
 * @param {MouseEvent} e - The window-level click event.
 */
window.onclick = function(e) {
    if (!e.target.matches('.dropdown-btn')) {
        const menu = document.getElementById('dropdownMenu');
        if (menu.classList.contains('show')) {
            menu.classList.remove('show');
        }
    }
}
 
/**
 * Handles a selection from the main dropdown menu.
 * Closes the dropdown, then routes to the appropriate action:
 *  - 'new'  → Opens the new-configuration popup and resets the config object.
 *  - 'load' → Opens the profile-selector popup.
 *  - 'save' → Opens the naming/save popup.
 *
 * @param {string} option - The menu action identifier ('new' | 'load' | 'save').
 */
function handleMenuOption(option) {
    toggleDropdown();
    switch(option) {
        case 'new':
            openPopup('newConfigPopup');
            Object.keys(config).forEach(key => delete config[key]);
            currentConfig = "New Configuration"
            break;
        case 'load':
            openPopup('profileSelector');
            break;
        case 'save':
            openPopup('namingbox');
            break;
    }
}
 
// ─── Popup / Modal Management ──────────────────────────────────────────────────
 
/**
 * Opens the binding configuration popup for a specific controller button.
 * Pre-fills the action input with any existing binding for the currently
 * selected SP sensor and button.
 *
 * @param {string} buttonId - The ID of the controller button being configured
 *                            (e.g. "btnA", "btnB"). Stored in `currentButton`
 *                            so that saveBinding() knows which button to update.
 */
function openBindingPopup(buttonId) {
    currentButton = buttonId; //This will be used in the saveBinding function when they click save.
    document.getElementById('popupHeader').textContent = `Configure ${buttonId} (${selectedSP || "No Sensor"})`;
    try {
        document.getElementById('actionInput').value = config.bindings[selectedSP][buttonId] || '';
    } catch (error) {
         alert("Select a Sip/Puff sensor first.");
         return;
    }
    openPopup('bindingbox');
}
 
/**
 * Shows a popup overlay by adding the "show" CSS class to it.
 *
 * @param {string} popupType - The ID of the popup element to open
 *                             (e.g. 'bindingbox', 'namingbox', 'profileSelector').
 */
function openPopup(popupType){
    document.getElementById(popupType).classList.add('show');
}
 
/**
 * Hides a popup overlay by removing the "show" CSS class.
 * If 'all' is passed, every element with class "popup" is closed.
 * Otherwise, closes only the specified popup and also clears the action input field.
 *
 * @param {string} popupType - The ID of the popup to close, or 'all' to close every popup.
 */
function closePopup(popupType) {
    if (popupType === 'all') {
        const popups = document.getElementsByClassName('popup');
        for (let i = 0; i < popups.length; i++) {
            popups[i].classList.remove('show');
        }
        return;
    }
    else{
        document.getElementById(popupType).classList.remove('show');
        document.getElementById('actionInput').value = '';
    }
}
 
// ─── Binding Management ────────────────────────────────────────────────────────
 
/**
 * Reads the action text from the binding popup input and writes it into the
 * in-memory `config.bindings` object under the active SP sensor and button.
 * Also applies visual CSS classes to the button element to indicate it has been
 * configured and which sensor it belongs to. Closes the binding popup on success.
 *
 * Guards:
 *  - Alerts and returns early if no SP sensor is selected.
 */
function saveBinding() {
    if (!selectedSP) {
        alert("Select a Sip/Puff sensor first.");
        return;
    }
 
    const action = document.getElementById('actionInput').value;
 
    // Ensure the sensor's binding bucket exists before writing to it.
    if (!config.bindings[selectedSP]) {
        config.bindings[selectedSP] = {};
    }
    config.bindings[selectedSP][currentButton] = action;
 
    console.log(`${selectedSP} ${action} configured to: ${currentButton}`);
 
    // Visually mark the button as configured with a sensor-specific color class.
    const button = document.getElementById(currentButton);
    button.classList.add("configured");
    if(selectedSP === "SP1") button.classList.add("sp1-bind");
    if(selectedSP === "SP2") button.classList.add("sp2-bind");
    if(selectedSP === "SP3") button.classList.add("sp3-bind");
    closePopup('bindingbox');
}
 
// ─── Profile Persistence ───────────────────────────────────────────────────────
 
/**
 * Validates the name entered in the save-profile popup, then sends the current
 * configuration to the device via `sendConfigToTP()`. On success, re-fetches
 * the profile list to keep the dropdown in sync, then closes the naming popup.
 *
 * Guards:
 *  - Alerts if the name field is empty.
 *  - Alerts if the profile list is full and the name is not an existing profile
 *    (i.e. an update would be allowed, but a new entry would exceed MAX_PROFILES).
 */
function saveConfiguration(){
    const newName = document.getElementById("nameInput").value.trim();
    if (!newName) {
        alert("Enter a name.");
        return;
    }
    if (!profileList.includes(newName) && profileList.length >= MAX_PROFILES) {
        alert("Maximum profiles reached.");
        return;
    }
    currentProfile = newName;
    config.name = newName;
    sendConfigToTP()
        .then(() => {
            // Always re-sync from device
            return fetchProfileList();
        })
        .then(() => {
            closePopup('namingbox');
            document.getElementById("nameInput").value = "";
        })
        .catch(err => {
            alert("Failed to save profile.");
            console.error(err);
        });
}
 
/**
 * POSTs the current in-memory configuration to the device's /saveProfile endpoint.
 * The payload includes the profile name and all SP-to-button bindings.
 *
 * @returns {Promise<Object>} Resolves with the parsed JSON response from the device,
 *                            or rejects if the network request fails or the server
 *                            returns a non-OK status.
 */
function sendConfigToTP() {
    return fetch("/saveProfile", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            profile: currentProfile,
            bindings: config.bindings
        })
    })
    .then(res => {
        if (!res.ok) throw new Error("Save failed");
        return res.json();
    });
}
 
/**
 * Reads the currently selected value from the profile dropdown and calls
 * `loadConfigFromTP()` to fetch and apply that profile from the device.
 * Closes the profile-selector popup after initiating the load.
 *
 * Guards:
 *  - Alerts if no profile is selected in the dropdown.
 */
function loadSelectedProfile() {
    const profileName = document.getElementById("profileDropdown").value;
    if (!profileName) return alert("Select a profile first.");
 
    loadConfigFromTP(profileName);
    closePopup('profileSelector');
}
 
/**
 * Fetches a named configuration profile from the device via GET /loadConfig,
 * applies the returned bindings to the in-memory `config` object, and updates
 * the UI to reflect the loaded state.
 *
 * Kept separate from `loadSelectedProfile()` so that the favorites feature
 * (future work) can also trigger a profile load directly by name.
 *
 * @param {string} profileName - The name of the profile to load from the device.
 */
function loadConfigFromTP(profileName) {
    fetch(`/loadConfig?profile=${encodeURIComponent(profileName)}`)
    .then(res => {
        if (!res.ok) throw new Error("Load failed");
        return res.json();
    })
    .then(data => {
        config.bindings = data.bindings;
        currentProfile = profileName;
        applyConfigToUI()
    })
    .catch(err => {
        console.error("Load error:", err);
    });
}
 
/**
 * Deletes the profile currently selected in the profile dropdown from the device
 * via DELETE /deleteProfile, then re-fetches the profile list and closes the
 * profile-selector popup.
 *
 * Guards:
 *  - Alerts if no profile is selected in the dropdown.
 */
function deleteSelectedProfile() {
    const profileName = document.getElementById("profileDropdown").value;
 
    if (!profileName) {
        alert("Select a profile first.");
        return;
    }
 
    fetch(`/deleteProfile?profile=${encodeURIComponent(profileName)}`, {
        method: "DELETE"
    })
    .then(res => {
        if (!res.ok) throw new Error("Delete failed");
        return res.json();
    })
    .then(() => {
        return fetchProfileList();
    })
    .then(() => {
        closePopup('profileSelector');
    })
    .catch(err => {
        console.error("Delete error:", err);
    });
}
 
/**
 * Deletes a profile by name directly (without relying on the dropdown selection).
 * Note: This function may not be needed — the UI currently uses `deleteSelectedProfile()`
 * instead. Kept for potential programmatic use (e.g. bulk operations or future favorites management).
 *
 * @param {string} profileName - The name of the profile to delete.
 */
//This may not be needed
function deleteProfile(profileName) {
    fetch(`/deleteProfile?profile=${profileName}`, {
        method: "DELETE"
    })
    .then(res => res.json())
    .then(data => console.log(data))
    .catch(err => console.error(err));
}
 
// ─── Controller / New Configuration ───────────────────────────────────────────
 
/**
 * Handles selection of a new controller type from the new-configuration popup.
 * Updates the controller display area's background image to the selected controller's
 * image, then closes the popup.
 *
 * If the selected button has no associated image path (data-image attribute is absent),
 * the controller is not yet supported and an alert is shown instead.
 *
 * @param {HTMLElement} button - The button element that was clicked, expected to have
 *                               a `data-image` attribute containing the controller image path.
 *
 * @todo Implement `configureOverlay()` to reposition configurable buttons
 *       over the newly selected controller image.
 */
function switchController(button){
    const imagePath = button.dataset.image;
    if (!imagePath){
        closePopup('newConfigPopup');
        alert("Oops! This controller is not currently configurable.")
        return;
    }
    const controller = document.getElementById("controller");
    controller.style.backgroundImage = `url("${imagePath}")`;
 
    //TODO:Create configureOverlay() function that moves buttons onto new images
 
    closePopup('newConfigPopup');
}
 
// ─── Profile List / Dropdown Population ───────────────────────────────────────
 
/**
 * GETs the list of saved profile names from the device at /listProfiles.
 * Updates the module-level `profileList` array and then calls `populateSelector()`
 * to rebuild the dropdown. On failure, resets `profileList` to an empty array
 * and still calls `populateSelector()` to show the empty state.
 */
function fetchProfileList() {
    fetch("/listProfiles")
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch profiles");
            return res.json();
        })
        .then(data => {
            if (!Array.isArray(data)) {
                throw new Error("Invalid profile data");
            }
 
            profileList = data;
            populateSelector();
        })
        .catch(err => {
            console.error("Profile list error:", err);
            profileList = [];
            populateSelector();
        });
}
 
/**
 * Rebuilds the profile <select> dropdown from the current `profileList` array.
 * Clears any existing options and inserts a default placeholder option followed
 * by one <option> element per profile name.
 */
function populateSelector() {
    const dropdown = document.getElementById("profileDropdown");
    dropdown.innerHTML = `<option value="">-- Select Profile --</option>`;
 
    profileList.forEach(profile => {
        const option = document.createElement("option");
        option.value = profile;
        option.textContent = profile;
        dropdown.appendChild(option);
    });
}
 
// ─── UI State Synchronization ──────────────────────────────────────────────────
 
/**
 * Reflects the in-memory `config.bindings` onto the DOM after a profile is loaded.
 * First strips all "configured" and sensor-specific binding classes from every
 * element that has an ID, then re-applies them based on the current config so
 * the UI exactly mirrors the loaded profile.
 */
function applyConfigToUI(){
    // Clear all existing binding indicators from every ID'd element.
    document.querySelectorAll('[id]').forEach(el=>{
        el.classList.remove("configured");
    });
 
    // Re-apply configured + sensor-color classes for each bound button.
    for(const sp in config.bindings){
        for(const button in config.bindings[sp]){
            const el = document.getElementById(button);
            if(el){
                el.classList.add("configured");
                if(sp === "SP1") el.classList.add("sp1-bind");
                if(sp === "SP2") el.classList.add("sp2-bind");
                if(sp === "SP3") el.classList.add("sp3-bind");
            }
        }
    }
}
 
// ─── Sip/Puff Sensor Selection ─────────────────────────────────────────────────
 
/**
 * Toggles the active Sip/Puff sensor used for button binding.
 * Clicking the already-active sensor deselects it (sets `selectedSP` to null).
 * Clicking a different sensor switches the active sensor and updates the body
 * class so that CSS can highlight buttons bound to that sensor.
 *
 * Visual effects managed:
 *  - `.sp-active` class on the sensor UI element.
 *  - `.sp1-active` / `.sp2-active` / `.sp3-active` classes on `document.body`
 *    (used by CSS to tint bound button indicators with the correct sensor color).
 *
 * @param {string} id - The sensor ID to activate or deactivate ('SP1' | 'SP2' | 'SP3').
 */
function selectSipPuff(id){
    // Remove active highlight from all sensor UI elements.
    document.querySelectorAll('.sp-select').forEach(el => {
        el.classList.remove('sp-active');
    });
 
    const el = document.getElementById(id);
    document.body.classList.remove("sp1-active","sp2-active","sp3-active");
 
    if(selectedSP == id){
        // Clicking the active sensor again deselects it.
        selectedSP = null;
    }
    else{
        selectedSP = id;
        el.classList.toggle('sp-active');
        if (id === "SP1") document.body.classList.add("sp1-active");
        if (id === "SP2") document.body.classList.add("sp2-active");
        if (id === "SP3") document.body.classList.add("sp3-active");
    }
}
 
// ─── Keyboard Shortcuts ────────────────────────────────────────────────────────
 
/**
 * Global keydown handler: pressing Escape closes all open popups at once
 * by delegating to closePopup('all').
 */
// Close popup with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closePopup('all');
    }
});