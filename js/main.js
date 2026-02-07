document.addEventListener('DOMContentLoaded', () => {
    // --- Sticky Header Logic ---
    const header = document.querySelector('.site-header');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // --- Copy IP Functionality ---
    const ipBox = document.getElementById('ip-box');
    const copyBtn = document.getElementById('copy-btn');
    const tooltip = document.getElementById('copy-tooltip');
    const serverIP = 'play.orjus.ru';

    function copyIp() {
        navigator.clipboard.writeText(serverIP).then(() => {
            showTooltip();

            // Visual feedback on icon
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

            setTimeout(() => {
                copyBtn.innerHTML = originalIcon;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = serverIP;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("Copy");
            textArea.remove();
            showTooltip();
        });
    }

    function showTooltip() {
        tooltip.classList.add('show');
        setTimeout(() => {
            tooltip.classList.remove('show');
        }, 2000);
    }

    if (ipBox) {
        ipBox.addEventListener('click', copyIp);
    }
    window.copyIp = copyIp;

    // --- Scroll Animations ---
    const observerOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
    });

    // --- Theme Switcher ---
    const settingsBtn = document.getElementById('settings-btn');
    const themePanel = document.getElementById('theme-panel');

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        themePanel.classList.toggle('active');
        settingsBtn.style.transform = themePanel.classList.contains('active') ? 'rotate(90deg)' : 'rotate(0deg)';
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!themePanel.contains(e.target) && !settingsBtn.contains(e.target)) {
            themePanel.classList.remove('active');
            settingsBtn.style.transform = 'rotate(0deg)';
        }
    });

    // Global theme setter
    window.setTheme = function (themeName) {
        // Remove existing theme classes from root
        const themeClasses = ['theme-purple', 'theme-blue', 'theme-red', 'theme-orange'];
        document.documentElement.classList.remove(...themeClasses);

        if (themeName !== 'default') {
            document.documentElement.classList.add(`theme-${themeName}`);
        }

        // Save preference
        localStorage.setItem('orjus-theme', themeName);
    }

    // Load saved theme
    const savedTheme = localStorage.getItem('orjus-theme');
    if (savedTheme) {
        window.setTheme(savedTheme);
    }

    // --- Smooth Scroll (Polyfill/Enhancement for navigation) ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            // Only acts on page anchors
            const targetId = this.getAttribute('href');
            if (targetId === '#' || !targetId.startsWith('#')) return;

            e.preventDefault();
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // --- Mobile Menu ---
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            mainNav.classList.toggle('active');
            document.body.style.overflow = mainNav.classList.contains('active') ? 'hidden' : '';
        });

        // Close menu when clicking a link
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                mainNav.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }
});
