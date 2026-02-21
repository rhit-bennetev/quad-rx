
    let currentButton = '';
    let currentConfig = "New Configuration"
    const config = {};
    let profileList = [];
    let favorites = [];
    const MAX_PROFILES = 20;
    const MAX_FAVORITES = 3

    window.onload = function () {
        fetchProfileList();
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
                openNewConfig()
                Object.keys(config).forEach(key => delete config[key]);
                currentConfig = "New Configuration"
                break;
            case 'load':
                openPopup('profileSelector')
                break;
            case 'save':
                nameConfiguration();
                break;
        }
    }

    function openBindingPopup(buttonName) {
        currentButton = buttonName;
        document.getElementById('popupHeader').textContent = `Configure ${buttonName}`;
        document.getElementById('actionInput').value = config[buttonName] || '';
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
            config[currentButton] = action;
            console.log(`${currentButton} configured to: ${action}`);
        }
        closePopup('bindingbox');
    }

    function nameConfiguration(){
        document.getElementById('namingbox').classList.add('show');
        //document.getElementById('nameInput').placeholder = currentConfig

    }

    function saveConfiguration(){
        const newName = document.getElementById("nameInput").value;
        if (!newName) return alert("Enter a name.");

        if (!profileList.includes(newName) && profileList.length >= MAX_PROFILES) {
            return alert("Maximum of 20 profiles reached. Delete one first.");
        }
        currentConfig = newName;
        console.log(`Saved New Configuration as ${currentConfig}`)
        sendConfigToTP();
        closePopup('namingbox');
    }

    function sendConfigToTP() {
        fetch("/saveProfile", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                profile: currentConfig,
                bindings: config
            })
        })
        .then(res => {
            if (!res.ok) throw new Error("Save failed");
            console.log("Profile saved!");
        })
        .catch(err => console.error(err));
    }

    function loadSelectedProfile() {
        const profileName = document.getElementById("profileDropdown").value;
        if (!profileName) return alert("Select a profile first.");

        loadConfigFromTP(profileName);
    }

    function loadConfigFromTP(profileName) {
        fetch(`/loadConfig?profile=${profileName}`)
            .then(res => res.json())
            .then(data => {
                Object.assign(config, data);
                applyConfigToUI();
            })
            .catch(err => console.error("Error loading config:", err));
    }

    function deleteSelectedProfile() {
        const profileName = document.getElementById("profileDropdown").value;
        if (!profileName) return alert("Select a profile first.");

        deleteProfile(profileName);
        closePopup()
    }

    function deleteProfile(profileName) {
        fetch(`/deleteProfile?profile=${profileName}`, {
            method: "DELETE"
        })
        .then(res => res.json())
        .then(data => console.log(data))
        .catch(err => console.error(err));
    }

    function applyConfigToUI() {
        for (const button in config) {
            const el = document.getElementById(button);
            if (el) {
                el.value = config[button];
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
            .then(res => res.json())
            .then(data => {
                profileList = data.profiles || [];
                favorites = data.favorites || [];

                populateSelector();
                console.log("Profiles loaded:", profileList);
            })
            .catch(err => console.error("Failed loading profile list:", err));
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