
    let currentButton = '';
    let currentConfig = "New Configuration"
    let config = {
        name: "",
        bindings: {}
    };
    let profileList = [];
    let favorites = [];
    const MAX_PROFILES = 20;
    const MAX_FAVORITES = 3

    window.onload = function () {
        fetchProfileList();

        document.querySelectorAll('.popup').forEach(popup => {
            popup.addEventListener('click', function (e) {
                // If user clicks the dark background (not the inner content)
                if (e.target === popup) {
                    popup.classList.remove('show');
                }
            });
        });
    };

    function toggleDropdown() {
        const menu = document.getElementById('dropdownMenu');
        menu.classList.toggle('show');
    }

    // Close dropdown when clicking outside
    window.onclick = function(e) {
        if (!e.target.matches('.dropdown-btn')) {
            const menu = document.getElementById('dropdownMenu');
            if (menu.classList.contains('show')) {
                menu.classList.remove('show');
            }
        }
    }

    function handleMenuOption(option) {
        toggleDropdown();
        switch(option) {
            case 'new':
                //openNewConfig()
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

    function openBindingPopup(buttonName) {
        currentButton = buttonName;
        document.getElementById('popupHeader').textContent = `Configure ${buttonName}`;
        document.getElementById('actionInput').value = config.bindings[buttonName] || '';
        openPopup('bindingbox');
    }

    function openPopup(popupType){
        document.getElementById(popupType).classList.add('show');
    }

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

    function saveBinding() {
        const action = document.getElementById('actionInput').value;
        if (action) {
            config.bindings[currentButton] = action;
            console.log(`${currentButton} configured to: ${action}`);
        }
        closePopup('bindingbox');
    }

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

    function loadSelectedProfile() {
        const profileName = document.getElementById("profileDropdown").value;
        if (!profileName) return alert("Select a profile first.");

        loadConfigFromTP(profileName);
        closePopup('profileSelector');
    }

    //Kept seperate because the favorites will eventually need.
    function loadConfigFromTP(profileName) {
        fetch(`/loadConfig?profile=${encodeURIComponent(profileName)}`)
        .then(res => {
            if (!res.ok) throw new Error("Load failed");
            return res.json();
        })
        .then(data => {
            config.bindings = data;
            currentProfile = profileName;
            applyConfigToUI();
        })
        .catch(err => {
            console.error("Load error:", err);
        });
    }

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

    //This may not be needed
    function deleteProfile(profileName) {
        fetch(`/deleteProfile?profile=${profileName}`, {
            method: "DELETE"
        })
        .then(res => res.json())
        .then(data => console.log(data))
        .catch(err => console.error(err));
    }

    function applyConfigToUI() {
        for (const button in config.bindings) {
            const el = document.getElementById(button);
            if (el) {
                el.value = config.bindings[button];
            }
        }
    }

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
                populateDropdown();
            })
            .catch(err => {
                console.error("Profile list error:", err);
                profileList = [];
                populateDropdown();
            });
    }

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

    // Close popup with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closePopup('all');
        }
    });