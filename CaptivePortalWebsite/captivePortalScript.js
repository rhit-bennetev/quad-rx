
    let currentButton = '';
    let selectedSP = null;
    let currentConfig = "New Configuration"
    let currentProfile = ""
    let config = {
        name: "",
        bindings: {
            SP1: {},
            SP2: {},
            SP3: {}
        }
    };
    let profileList = [];
    let favorites = [];
    const MAX_PROFILES = 20;
    const MAX_FAVORITES = 3

    window.onload = function () {
        //fetchProfileList();

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
        if (!selectedSP) {
            alert("Select a Sip/Puff sensor first.");
            return;
        }

        const action = document.getElementById('actionInput').value;

        if (!config.bindings[selectedSP]) {
            config.bindings[selectedSP] = {};
        }
        config.bindings[selectedSP][currentButton] = action;

        console.log(`${selectedSP} ${action} configured to: ${currentButton}`);
        const button = document.getElementById(currentButton);
        button.classList.add("configured");
        if(selectedSP === "SP1") button.classList.add("sp1-bind");
        if(selectedSP === "SP2") button.classList.add("sp2-bind");
        if(selectedSP === "SP3") button.classList.add("sp3-bind");
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
            config.bindings = data.bindings;
            currentProfile = profileName;
            applyConfigToUI()
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
                populateSelector();
            })
            .catch(err => {
                console.error("Profile list error:", err);
                profileList = [];
                populateSelector();
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

    function applyConfigToUI(){
        document.querySelectorAll('[id]').forEach(el=>{
            el.classList.remove("configured");
        });

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

    function selectSipPuff(id){
        document.querySelectorAll('.sp-select').forEach(el => {
            el.classList.remove('sp-active');
        });

        const el = document.getElementById(id);
        document.body.classList.remove("sp1-active","sp2-active","sp3-active");

        if(selectedSP == id){
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

    // Close popup with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closePopup('all');
        }
    });