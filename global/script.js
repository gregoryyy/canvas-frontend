/* copyright 2025 Unlost GmbH. All rights reserved. */
window.onload = function () {
    document.querySelector('.hamburger').addEventListener('click', function () {
        this.classList.toggle('active');
        document.querySelector('.menu').classList.toggle('active');
    });
};
