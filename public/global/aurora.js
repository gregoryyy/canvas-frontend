/* copyright 2025 Unlost GmbH. All rights reserved. */
document.addEventListener('DOMContentLoaded', function () {
    const cont = document.getElementById('auroraContainer');

    for (let i = 1; i <= 24; i++) {
        let aurora = document.createElement('span');
        aurora.className = `aur aur_${i}`;
        aurora.style.boxShadow = generateBoxShadow();
        // Random margin top between -50px to 50px
        aurora.style.marginTop = `${Math.random() * 200 - 50}px`;
        aurora.style.animation = `topup ${4 * (2000 + Math.random() * 3000)}ms infinite linear`;
        cont.appendChild(aurora);
    }

    function generateBoxShadow() {
        // Generate more vibrant colors for higher contrast against white
        // const hue = Math.floor(Math.random() * 360);
        // hue values: 0 red, 40 orange, 60 yellow, 120 green, 180 turquoise, 200-220 blue, 280 violet, 320 pink
        var hue = Math.floor(Math.random() * 30 + 160);
        // let the sun shine in
        // 70% to 100%
        var saturation = 55 + Math.floor(Math.random() * 30);
        // 50% to 60%
        var  lightness = 70 + Math.floor(Math.random() * 10);
        const weather = Math.random();
        if (weather  > 0.95) {
            hue -= 110;
            saturation += 20;
        }
        if (weather < .2) {
            saturation /= 2;
            lightness = (lightness + 100) / 2;
        }
        return `hsl(${hue}, ${saturation}%, ${lightness}%) 0px 0px 8vw 4vw`;
    }
});