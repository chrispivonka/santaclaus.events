// Runs in <head> before the page paints so a saved light/dark choice doesn't flash.
// It also marks the page as having JavaScript, so scroll-in animations only hide content when they can reveal it.
document.documentElement.classList.add('js');
try {
    var t = localStorage.getItem('site-theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
