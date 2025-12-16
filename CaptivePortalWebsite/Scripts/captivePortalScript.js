
    let currentButton = '';
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
                break;
            case 'load':
                alert('Load configuration feature would open a file picker here.');
                break;
            case 'save':
                alert('Configuration saved:\n' + JSON.stringify(config, null, 2));
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

    function saveConfiguration() {
        const action = document.getElementById('actionInput').value;
        if (action) {
            config[currentButton] = action;
            alert(`${currentButton} configured to: ${action}`);
        }
        closePopup();
    }

    function switchController(controller){

        //TODO: make it switch controller diagrams.

        closePopup('newConfigPopup');
    }

    // Close popup with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closePopup();
        }
    });