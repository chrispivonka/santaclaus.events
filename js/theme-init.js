// Runs in <head> before the page paints so a saved light/dark choice doesn't flash.
try { var t = localStorage.getItem('site-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}
