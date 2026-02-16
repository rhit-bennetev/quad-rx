
    let currentButton = '';
    let currentConfig = "New Configuration"
    const config = {};

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
                //TODO: Some method to pick config to load
                //currentConfig = someconfig
                loadConfigFromTP();
                break;
            case 'save':
                nameConfiguration();
                break;
        }
    }

    function openPopup(buttonName) {
        currentButton = buttonName;
        document.getElementById('popupHeader').textContent = `Configure ${buttonName}`;
        document.getElementById('actionInput').value = config[buttonName] || '';
        document.getElementById('bindingbox').classList.add('show');
    }

    function openNewConfig(){
        document.getElementById('newConfigPopup').classList.add('show');
    }

    function closePopup(popupType) {
        document.getElementById(popupType).classList.remove('show');
        document.getElementById('actionInput').value = '';
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
        if(currentConfig != "New Configuration"){
            //TODO: Add function to delete old profile with current name before saving new one
        }
        currentConfig = document.getElementById('nameInput').value;
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

    function loadConfigFromTP(profileName) {
        fetch(`/loadConfig?profile=${profileName}`)
            .then(res => res.json())
            .then(data => {
                Object.assign(config, data);
                applyConfigToUI();
            })
            .catch(err => console.error("Error loading config:", err));
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

    // Close popup with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closePopup();
        }
    });